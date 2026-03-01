/**
 * @module FileEditorMonacoPage
 *
 * Monaco Editor-powered file editor page.
 * Route: /ssh/sftp/edit-monaco?tabId=xxx&path=/remote/file
 *
 * Replaces the hand-rolled textarea editor with the reusable
 * MonacoEditor module — all find/replace, go-to-line, undo/redo,
 * syntax highlighting, bracket matching etc. are built-in.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiCore } from "@/lib/api";
import { __config } from "@/lib/config";
import {
    Loader2, Save, WrapText, RefreshCw, Info, X, Palette, Check, FolderTree,
    Columns2, XIcon,
} from "lucide-react";
import FileIcon from "@/components/FileIcon";
import { cachedIconUrl } from "@/lib/iconCache";
import { getIconForFile } from "vscode-icons-js";
import {
    MonacoEditor,
    ALL_BUILTIN_PLUGINS,
    detectLanguage,
    createGhostTextPlugin,
    createNotificationPlugin,
    showEditorNotification,
    loadEditorSettings,
    EditorFileTree,
} from "@/modules/monaco-editor";
import type { MonacoEditorInstance, AICompletionProvider } from "@/modules/monaco-editor";
import { SocketContext } from "@/context/socket-context";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";

/* ── Constants ─────────────────────────────────────────────── */

const ICON_CDN =
    "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons";

/** Monaco theme options with display metadata */
const MONACO_THEMES = [
    { id: "one-dark",    name: "One Dark",          colors: ["#61afef", "#282c34", "#abb2bf"] },
    { id: "dracula",     name: "Dracula",           colors: ["#bd93f9", "#282a36", "#f8f8f2"] },
    { id: "github-dark", name: "GitHub Dark",       colors: ["#58a6ff", "#0d1117", "#c9d1d9"] },
    { id: "monokai",     name: "Monokai",           colors: ["#a6e22e", "#272822", "#f8f8f2"] },
    { id: "nord",        name: "Nord",              colors: ["#88c0d0", "#2e3440", "#d8dee9"] },
    { id: "vs-dark",     name: "VS Dark (Default)", colors: ["#569cd6", "#1e1e1e", "#d4d4d4"] },
] as const;

type ThemeId = (typeof MONACO_THEMES)[number]["id"];

/* ── Editor Tab model ──────────────────────────────────────── */
interface EditorTab {
    id: string;
    filePath: string;
    fileName: string;
    content: string | null;
    originalContent: string;
    modified: boolean;
    loading: boolean;
    error: string | null;
}

/** Splits: each split group has a list of tab ids and an active tab id */
interface SplitGroup {
    id: string;
    tabIds: string[];
    activeTabId: string | null;
}

let tabIdCounter = 0;
function newTabId() { return `tab-${++tabIdCounter}-${Date.now()}`; }


/* ── Component ─────────────────────────────────────────────── */

export default function FileEditorMonacoPage() {
    const [params] = useSearchParams();
    const filePath  = params.get("path") ?? "";
    const sessionId = params.get("sessionId") ?? params.get("tabId") ?? "";
    const hostUser  = params.get("user") ?? "";
    const fileName  = filePath.split("/").pop() ?? "untitled";
    const lang      = detectLanguage(filePath || fileName);

    // Extract directory from remote path for terminal cwd
    const terminalCwd = useMemo(() => {
        if (!filePath) return "/";
        const dir = filePath.replace(/\/[^/]*$/, "");
        return dir || "/";
    }, [filePath]);

    /* ── State ──────────────────────────────────────────────── */
    const [initialContent, setInitialContent] = useState<string | null>(null);
    const [loading, setLoading]           = useState(true);
    const [saving, setSaving]             = useState(false);
    const [error, setError]               = useState<string | null>(null);
    const [modified, setModified]         = useState(false);
    const [lastSaved, setLastSaved]       = useState<Date | null>(null);
    const [wordWrap, setWordWrap]         = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [cursorLine, setCursorLine]     = useState(1);
    const [cursorCol, setCursorCol]       = useState(1);
    const [themeId, setThemeId]           = useState<ThemeId>(
        () => (localStorage.getItem("monaco-editor-theme") as ThemeId) ?? "one-dark",
    );

    /* ── Refs ───────────────────────────────────────────────── */
    const editorRef          = useRef<MonacoEditorInstance | null>(null);
    const originalContentRef = useRef("");
    const themePickerBtnRef  = useRef<HTMLButtonElement>(null);
    /** Tracks the latest editor content without triggering re-renders */
    const contentRef         = useRef("");
    /** Per-tab content refs keyed by tab id */
    const tabContentRefs     = useRef<Record<string, string>>({});

    const { socket } = useContext(SocketContext);
    const treePanelRef = useRef<ImperativePanelHandle>(null);

    /* ── File tree state ────────────────────────────────────── */
    const [treeFiles, setTreeFiles] = useState<any[]>([]);
    const [treeDir, setTreeDir] = useState(() => {
        // Start the tree at the parent directory of the current file
        if (!filePath) return "/";
        const dir = filePath.replace(/\/[^/]*$/, "");
        return dir || "/";
    });
    const [treeCollapsed, setTreeCollapsed] = useState(false);

    // Fetch directory listing on treeDir change
    useEffect(() => {
        if (!socket || !treeDir) return;
        socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: treeDir });
    }, [socket, treeDir]);

    // Listen for file list events
    useEffect(() => {
        if (!socket) return;
        const onFileList = (data: { path?: string; result?: any[] }) => {
            if (data.result) {
                setTreeFiles(data.result);
            }
        };
        socket.on(SocketEventConstants.SFTP_FILES_LIST, onFileList);
        return () => { socket.off(SocketEventConstants.SFTP_FILES_LIST, onFileList); };
    }, [socket]);

    const handleTreeNavigate = useCallback((path: string) => {
        setTreeDir(path);
    }, []);

    const handleTreeRefresh = useCallback(() => {
        if (!socket || !treeDir) return;
        socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: treeDir });
    }, [socket, treeDir]);

    /* ── Tabs & Split state ─────────────────────────────────── */
    const initialTabId = useMemo(() => newTabId(), []);
    const [tabs, setTabs] = useState<Record<string, EditorTab>>(() => ({
        [initialTabId]: {
            id: initialTabId,
            filePath,
            fileName,
            content: null,
            originalContent: "",
            modified: false,
            loading: true,
            error: null,
        },
    }));
    const [splitGroups, setSplitGroups] = useState<SplitGroup[]>(() => [
        { id: "group-1", tabIds: [initialTabId], activeTabId: initialTabId },
    ]);
    const [activeGroupId, setActiveGroupId] = useState("group-1");

    // Convenience: active group's tab
    const activeGroup = splitGroups.find((g) => g.id === activeGroupId) ?? splitGroups[0];
    const activeTabId = activeGroup?.activeTabId;
    const activeTab = activeTabId ? tabs[activeTabId] : null;

    /** Open a file as a new editor tab (or focus if already open) */
    const openFileInTab = useCallback((fullPath: string, groupId?: string) => {
        const name = fullPath.split("/").pop() ?? "untitled";
        const gId = groupId ?? activeGroupId;

        // Check if already open in any group
        const existingTab = Object.values(tabs).find((t) => t.filePath === fullPath);
        if (existingTab) {
            // Focus the existing tab
            setSplitGroups((prev) =>
                prev.map((g) => {
                    if (g.tabIds.includes(existingTab.id)) {
                        setActiveGroupId(g.id);
                        return { ...g, activeTabId: existingTab.id };
                    }
                    return g;
                }),
            );
            return;
        }

        const id = newTabId();
        const newTab: EditorTab = {
            id,
            filePath: fullPath,
            fileName: name,
            content: null,
            originalContent: "",
            modified: false,
            loading: true,
            error: null,
        };
        setTabs((prev) => ({ ...prev, [id]: newTab }));
        setSplitGroups((prev) =>
            prev.map((g) =>
                g.id === gId
                    ? { ...g, tabIds: [...g.tabIds, id], activeTabId: id }
                    : g,
            ),
        );
        setActiveGroupId(gId);

        // Fetch content for the new tab
        ApiCore.fetchFileContent(sessionId, fullPath)
            .then((data) => {
                if (!data.status) throw new Error(data.message || "Failed to load file");
                setTabs((prev) => ({
                    ...prev,
                    [id]: {
                        ...prev[id],
                        content: data.result,
                        originalContent: data.result,
                        loading: false,
                    },
                }));
                tabContentRefs.current[id] = data.result;
            })
            .catch((e) => {
                setTabs((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], loading: false, error: e?.message ?? "Failed to load" },
                }));
            });
    }, [tabs, activeGroupId, sessionId]);

    /** Close a tab (initial tab from URL cannot be closed) */
    const closeTab = useCallback((tabId: string) => {
        if (tabId === initialTabId) return; // initial tab is pinned
        delete tabContentRefs.current[tabId];
        setTabs((prev) => {
            const next = { ...prev };
            delete next[tabId];
            return next;
        });
        setSplitGroups((prev) => {
            return prev
                .map((g) => {
                    if (!g.tabIds.includes(tabId)) return g;
                    const newTabIds = g.tabIds.filter((id) => id !== tabId);
                    let newActive = g.activeTabId === tabId
                        ? newTabIds[Math.max(0, g.tabIds.indexOf(tabId) - 1)] ?? newTabIds[0] ?? null
                        : g.activeTabId;
                    return { ...g, tabIds: newTabIds, activeTabId: newActive };
                })
                .filter((g) => g.tabIds.length > 0); // Remove empty groups
        });
    }, []);

    /** Split the active tab into a new group */
    const splitTabToNewGroup = useCallback((tabId: string) => {
        const tab = tabs[tabId];
        if (!tab) return;
        const newGroupId = `group-${Date.now()}`;
        const newId = newTabId();
        const clonedTab: EditorTab = {
            ...tab,
            id: newId,
        };
        setTabs((prev) => ({ ...prev, [newId]: clonedTab }));
        tabContentRefs.current[newId] = tabContentRefs.current[tabId] ?? tab.content ?? "";
        setSplitGroups((prev) => [
            ...prev,
            { id: newGroupId, tabIds: [newId], activeTabId: newId },
        ]);
        setActiveGroupId(newGroupId);
    }, [tabs]);

    /** Switch active tab in a group */
    const switchTab = useCallback((groupId: string, tabId: string) => {
        // Before switching, save current content to ref
        if (activeTabId && editorRef.current) {
            tabContentRefs.current[activeTabId] = editorRef.current.getValue();
        }
        setSplitGroups((prev) =>
            prev.map((g) => (g.id === groupId ? { ...g, activeTabId: tabId } : g)),
        );
        setActiveGroupId(groupId);
    }, [activeTabId]);

    // Wire handleTreeFileOpen to use internal tabs
    const handleTreeFileOpen = useCallback((fullPath: string, _name: string) => {
        openFileInTab(fullPath);
    }, [openFileInTab]);

    // AI completion provider from persisted settings
    const [aiProvider, setAIProvider] = useState<AICompletionProvider>(
        () => loadEditorSettings().aiCompletionProvider,
    );

    // Memoize plugins — ghost text is only included when selected
    const ghostTextPlugin = useMemo(
        () => createGhostTextPlugin({ endpoint: __config.API_URL }),
        [],
    );
    const notificationPlugin = useMemo(
        () => createNotificationPlugin({ socket }),
        [socket],
    );
    const plugins = useMemo(
        () => [
            ...ALL_BUILTIN_PLUGINS,
            ...(aiProvider === "ghost-text" ? [ghostTextPlugin] : []),
            notificationPlugin,
        ],
        [ghostTextPlugin, notificationPlugin, aiProvider],
    );

    // Handle AI provider change from settings panel
    const handleAIProviderChange = useCallback((provider: AICompletionProvider) => {
        setAIProvider(provider);
    }, []);

    /* ── Document title + favicon ───────────────────────────── */
    const currentFileName = activeTab?.fileName ?? fileName;
    const currentFilePath = activeTab?.filePath ?? filePath;
    useEffect(() => {
        document.title = `${currentFileName} — Terminus Editor`;
        const iconFile = getIconForFile(currentFileName);
        const rawUrl   = iconFile ? `${ICON_CDN}/${iconFile}` : `${ICON_CDN}/default_file.svg`;

        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        const previousHref = link?.href;
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }

        // Use cached icon URL
        let cancelled = false;
        cachedIconUrl(rawUrl).then((url) => {
            if (!cancelled && link) link.href = url;
        });

        return () => {
            cancelled = true;
            document.title = "Terminus";
            if (link && previousHref) link.href = previousHref;
        };
    }, [currentFileName]);

    /* ── Fetch file content ─────────────────────────────────── */
    const fetchContent = useCallback(async () => {
        if (!sessionId || !filePath || !hostUser) {
            setError(!sessionId ? "Missing sessionId in URL" : !filePath ? "Missing file path in URL" : "Missing host user in URL");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await ApiCore.fetchFileContent(sessionId, filePath);
            if (!data.status) throw new Error(data.message || "Failed to load file content");
            contentRef.current = data.result;
            originalContentRef.current = data.result;
            setInitialContent(data.result);
            setModified(false);
            // Also update the initial tab
            tabContentRefs.current[initialTabId] = data.result;
            setTabs((prev) => ({
                ...prev,
                [initialTabId]: {
                    ...prev[initialTabId],
                    content: data.result,
                    originalContent: data.result,
                    loading: false,
                },
            }));
            // If editor is already mounted (reload), push content into the model directly
            if (editorRef.current) {
                editorRef.current.setValue(data.result);
            }
        } catch (e: any) {
            setError(e?.message ?? "Failed to load file");
        } finally {
            setLoading(false);
        }
    }, [sessionId, filePath]);

    useEffect(() => { fetchContent(); }, [fetchContent]);

    /* ── Save file ──────────────────────────────────────────── */
    const handleSave = useCallback(async (value?: string) => {
        if (!sessionId || saving) return;
        const tab = activeTab;
        const saveFilePath = tab?.filePath ?? filePath;
        const saveFileName = tab?.fileName ?? fileName;
        const toSave = value ?? (activeTabId ? tabContentRefs.current[activeTabId] : undefined) ?? contentRef.current;
        setSaving(true);
        try {
            await ApiCore.saveFileContent(sessionId, saveFilePath, toSave);
            setModified(false);
            originalContentRef.current = toSave;
            if (activeTabId) {
                setTabs((prev) => ({
                    ...prev,
                    [activeTabId]: { ...prev[activeTabId], modified: false, originalContent: toSave },
                }));
            }
            setLastSaved(new Date());
            showEditorNotification(`${saveFileName} saved successfully`, "success", {
                source: "File System",
                timeout: 3000,
            });
        } catch (e: any) {
            showEditorNotification(
                `Failed to save ${saveFileName}`,
                "error",
                {
                    source: "File System",
                    detail: e?.message ?? "Could not save the file",
                    timeout: 6000,
                },
            );
        } finally {
            setSaving(false);
        }
    }, [sessionId, saving, activeTab, activeTabId, filePath, fileName]);

    /* ── Monaco callbacks ───────────────────────────────────── */
    const handleChange = useCallback((value: string) => {
        contentRef.current = value;
        if (activeTabId) {
            tabContentRefs.current[activeTabId] = value;
            const tab = tabs[activeTabId];
            const isModified = value !== (tab?.originalContent ?? originalContentRef.current);
            setModified(isModified);
            if (tab) {
                setTabs((prev) => ({
                    ...prev,
                    [activeTabId]: { ...prev[activeTabId], modified: isModified },
                }));
            }
        } else {
            setModified(value !== originalContentRef.current);
        }
    }, [activeTabId, tabs]);

    const handleEditorMount = useCallback((editor: MonacoEditorInstance) => {
        editorRef.current = editor;
    }, []);

    /* ── Theme switcher ─────────────────────────────────────── */
    const handleThemeChange = (id: ThemeId) => {
        setThemeId(id);
        localStorage.setItem("monaco-editor-theme", id);
        setShowThemePicker(false);
    };

    const lineCount = (initialContent ?? "").split("\n").length;

    /* ── Status bar: last saved time ─────────────────────────── */
    const statusBarItems = useMemo(() => {
        if (!lastSaved) return [];
        const fmt = lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return [
            {
                id: "last-saved",
                text: `Saved ${fmt}`,
                tooltip: `Last saved at ${lastSaved.toLocaleString()}`,
                alignment: "right" as const,
                priority: 100,
            },
        ];
    }, [lastSaved]);

    /* ── Shortcut groups for help modal ─────────────────────── */
    const shortcutGroups = [
        {
            title: "File",
            items: [
                { keys: "Ctrl+S", desc: "Save file" },
                { keys: "Ctrl+F", desc: "Find" },
                { keys: "Ctrl+H", desc: "Find & Replace" },
                { keys: "Ctrl+G", desc: "Go to Line" },
                { keys: "Ctrl+P", desc: "Quick Open (Command Palette)" },
            ],
        },
        {
            title: "Editing",
            items: [
                { keys: "Ctrl+Z", desc: "Undo" },
                { keys: "Ctrl+Shift+Z", desc: "Redo" },
                { keys: "Ctrl+X", desc: "Cut line / selection" },
                { keys: "Ctrl+C", desc: "Copy line / selection" },
                { keys: "Ctrl+Shift+K", desc: "Delete line" },
                { keys: "Ctrl+D", desc: "Select next occurrence" },
                { keys: "Ctrl+/", desc: "Toggle line comment" },
                { keys: "Ctrl+Shift+A", desc: "Toggle block comment" },
            ],
        },
        {
            title: "Navigation",
            items: [
                { keys: "Alt+Up", desc: "Move line up" },
                { keys: "Alt+Down", desc: "Move line down" },
                { keys: "Alt+Shift+Up", desc: "Copy line up" },
                { keys: "Alt+Shift+Down", desc: "Copy line down" },
                { keys: "Ctrl+Shift+\\", desc: "Jump to bracket" },
            ],
        },
        {
            title: "Multi-cursor",
            items: [
                { keys: "Alt+Click", desc: "Add cursor" },
                { keys: "Ctrl+Alt+Up", desc: "Add cursor above" },
                { keys: "Ctrl+Alt+Down", desc: "Add cursor below" },
                { keys: "Ctrl+Shift+L", desc: "Select all occurrences" },
            ],
        },
    ];

    /* ── Error state ────────────────────────────────────────── */
    if (error && initialContent === null) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
                <div className="text-center space-y-3">
                    <p className="text-sm text-red-400">{error}</p>
                    <p className="text-xs text-gray-500">
                        Check the URL parameters and try again.
                    </p>
                    <button
                        onClick={fetchContent}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 transition-colors mt-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                </div>
            </div>
        );
    }

    /* ── Loading state ──────────────────────────────────────── */
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-sm text-gray-300">Loading {fileName}…</span>
                </div>
            </div>
        );
    }

    /* ── Main render ────────────────────────────────────────── */
    return (
        <div className="h-screen w-full overflow-hidden flex flex-col bg-[#1e1e1e]">

            {/* ── Toolbar ─────────────────────────────────────── */}
            <div className="flex items-center justify-between px-3 py-1.5 shrink-0 select-none bg-[#252526] border-b border-[#3c3c3c]">
                {/* Left: file info */}
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span className="flex items-center space-x-1">
                        <FileIcon name={currentFileName} isDirectory={false} className="w-4 h-4" />
                        <span className="text-[13px] font-medium truncate text-gray-200">
                            {currentFileName}
                        </span>
                    </span>
                    {(activeTab?.modified ?? modified) && (
                        <span
                            className="w-2 h-2 rounded-full shrink-0 bg-orange-400"
                            title="Unsaved changes"
                        />
                    )}
                    <span className="text-[11px] font-mono truncate hidden sm:inline text-gray-500">
                        {currentFilePath}
                    </span>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Reload */}
                    <button
                        onClick={fetchContent}
                        disabled={loading}
                        title="Reload file from server"
                        className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>

                    {/* Word wrap toggle */}
                    <button
                        onClick={() => setWordWrap((w) => !w)}
                        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                        className="p-1.5 rounded-md transition-colors"
                        style={{
                            background: wordWrap ? "#3c3c3c" : "transparent",
                            color: wordWrap ? "#d4d4d4" : "#808080",
                        }}
                    >
                        <WrapText className="w-3.5 h-3.5" />
                    </button>

                    {/* Theme picker */}
                    <div className="relative">
                        <button
                            ref={themePickerBtnRef}
                            onClick={() => setShowThemePicker((v) => !v)}
                            title="Change theme"
                            className="p-1.5 rounded-md transition-colors"
                            style={{
                                color: showThemePicker ? "#d4d4d4" : "#808080",
                                background: showThemePicker ? "#3c3c3c" : "transparent",
                            }}
                        >
                            <Palette className="w-3.5 h-3.5" />
                        </button>

                        {showThemePicker && (() => {
                            const btnRect     = themePickerBtnRef.current?.getBoundingClientRect();
                            const dropdownTop = btnRect ? btnRect.bottom + 4 : 40;
                            const dropdownRight = btnRect
                                ? window.innerWidth - btnRect.right
                                : 8;
                            return (
                                <div
                                    className="fixed z-[9999] w-52 p-1.5 rounded-lg shadow-2xl shadow-black/50 max-h-64 overflow-y-auto bg-[#252526] border border-[#3c3c3c]"
                                    style={{ top: dropdownTop, right: dropdownRight }}
                                >
                                    {MONACO_THEMES.map((t) => {
                                        const isActive = t.id === themeId;
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => handleThemeChange(t.id)}
                                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors"
                                                style={{
                                                    color: isActive ? "#d4d4d4" : "#808080",
                                                    background: isActive ? "#3c3c3c" : "transparent",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#3c3c3c";
                                                    e.currentTarget.style.color = "#d4d4d4";
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isActive) {
                                                        e.currentTarget.style.background = "transparent";
                                                        e.currentTarget.style.color = "#808080";
                                                    }
                                                }}
                                            >
                                                <span className="flex gap-0.5 shrink-0">
                                                    {t.colors.map((c, i) => (
                                                        <span
                                                            key={i}
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{ background: c }}
                                                        />
                                                    ))}
                                                </span>
                                                <span className="flex-1 text-left">{t.name}</span>
                                                {isActive && (
                                                    <Check className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Shortcuts help */}
                    <button
                        onClick={() => setShowShortcuts(true)}
                        title="Keyboard Shortcuts"
                        className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200"
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>

                    {/* Save */}
                    <button
                        onClick={() => handleSave()}
                        disabled={saving || !(activeTab?.modified ?? modified)}
                        className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium px-3 py-1.5 rounded-md transition-colors ml-1 bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        {saving ? "Saving…" : "Save"}
                    </button>

                    {/* Split editor */}
                    {activeTabId && (
                        <button
                            onClick={() => splitTabToNewGroup(activeTabId)}
                            title="Split Editor Right"
                            className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200 ml-0.5"
                        >
                            <Columns2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── File Tree + Tab Bar + Split Editor ──────── */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    {/* File tree panel (always rendered, collapsible) */}
                    <ResizablePanel
                        ref={treePanelRef}
                        defaultSize={18}
                        minSize={12}
                        maxSize={35}
                        collapsible
                        collapsedSize={3}
                        onCollapse={() => setTreeCollapsed(true)}
                        onExpand={() => setTreeCollapsed(false)}
                        className="h-full"
                    >
                        {treeCollapsed ? (
                            <div className="flex items-start justify-center h-full bg-[#252526] pt-2">
                                <button
                                    onClick={() => treePanelRef.current?.expand()}
                                    className="p-1 rounded-md hover:bg-[#37373d] transition-colors"
                                    title="Show Explorer"
                                >
                                    <FolderTree className="h-4 w-4 text-gray-500" />
                                </button>
                            </div>
                        ) : (
                            <EditorFileTree
                                currentDir={treeDir}
                                files={treeFiles}
                                onFileOpen={handleTreeFileOpen}
                                onNavigate={handleTreeNavigate}
                                onRefresh={handleTreeRefresh}
                                collapsed={treeCollapsed}
                                onCollapsedChange={(collapsed) => {
                                    if (collapsed) treePanelRef.current?.collapse();
                                    else treePanelRef.current?.expand();
                                }}
                                showHiddenFiles={false}
                            />
                        )}
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-[#3c3c3c] hover:bg-blue-500/40 transition-colors" />
                    {/* Editor area with split groups */}
                    <ResizablePanel defaultSize={82} className="h-full">
                        <ResizablePanelGroup direction="horizontal" className="h-full">
                            {splitGroups.map((group, gi) => {
                                const groupActiveTab = group.activeTabId ? tabs[group.activeTabId] : null;
                                const isActiveGroup = group.id === activeGroupId;
                                const editorContent = groupActiveTab
                                    ? (tabContentRefs.current[groupActiveTab.id] ?? groupActiveTab.content ?? "")
                                    : (initialContent ?? "");
                                const editorFilePath = groupActiveTab?.filePath ?? filePath;
                                const editorFileName = groupActiveTab?.fileName ?? fileName;
                                return (
                                    <React.Fragment key={group.id}>
                                        {gi > 0 && <ResizableHandle withHandle className="bg-[#3c3c3c] hover:bg-blue-500/40 transition-colors" />}
                                        <ResizablePanel minSize={20} className="h-full">
                                            <div className="flex flex-col h-full">
                                            {/* Tab bar */}
                                            <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c] shrink-0 overflow-x-auto tab-bar-scroll">
                                                {group.tabIds.map((tid) => {
                                                    const tab = tabs[tid];
                                                    if (!tab) return null;
                                                    const isActive = tid === group.activeTabId;
                                                    return (
                                                        <div
                                                            key={tid}
                                                            className={`group/tab flex items-center gap-1.5 px-3 py-1 cursor-pointer border-r border-[#3c3c3c] text-[12px] shrink-0 transition-colors ${
                                                                isActive
                                                                    ? "bg-[#1e1e1e] text-gray-200"
                                                                    : "text-gray-500 hover:text-gray-300 hover:bg-[#2a2d2e]"
                                                            }`}
                                                            onClick={() => switchTab(group.id, tid)}
                                                        >
                                                            <FileIcon name={tab.fileName} isDirectory={false} size={14} />
                                                            <span className="truncate max-w-[120px]">{tab.fileName}</span>
                                                            {tab.modified && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                                            )}
                                                            {tab.loading && (
                                                                <Loader2 className="w-3 h-3 animate-spin shrink-0 text-blue-400" />
                                                            )}
                                                            {tid !== initialTabId && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        closeTab(tid);
                                                                    }}
                                                                    className="ml-1 p-0.5 rounded opacity-0 group-hover/tab:opacity-100 hover:bg-[#3c3c3c] transition-all"
                                                                    title="Close"
                                                                >
                                                                    <XIcon className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Editor for active tab */}
                                            <div className="flex-1 overflow-hidden" onClick={() => setActiveGroupId(group.id)}>
                                                {groupActiveTab?.loading ? (
                                                    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
                                                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                                    </div>
                                                ) : groupActiveTab?.error ? (
                                                    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
                                                        <p className="text-sm text-red-400">{groupActiveTab.error}</p>
                                                    </div>
                                                ) : (
                                                    <MonacoEditor
                                                        key={group.activeTabId}
                                                        defaultValue={editorContent}
                                                        filePath={editorFilePath || editorFileName}
                                                        theme={themeId}
                                                        wordWrap={wordWrap ? "on" : "off"}
                                                        plugins={plugins}
                                                        onChange={handleChange}
                                                        onSave={handleSave}
                                                        onMount={handleEditorMount}
                                                        onCursorChange={(line, col) => {
                                                            setCursorLine(line);
                                                            setCursorCol(col);
                                                        }}
                                                        copilotEndpoint={`${__config.API_URL}/api/complete`}
                                                        onAIProviderChange={handleAIProviderChange}
                                                        enableLSP
                                                        lspBaseUrl={__config.API_URL}
                                                        showSidebar={isActiveGroup && gi === splitGroups.length - 1}
                                                        showStatusBar={isActiveGroup && gi === splitGroups.length - 1}
                                                        enableTerminal={isActiveGroup && gi === splitGroups.length - 1}
                                                        enableAutoClose
                                                        pluginDebounceMs={1200}
                                                        enableVsixDrop={isActiveGroup}
                                                        terminalUrl={`${__config.API_URL}/dedicated-terminal`}
                                                        terminalSessionId={sessionId}
                                                        terminalCwd={terminalCwd}
                                                        fontSize={14}
                                                        tabSize={2}
                                                        minimap={splitGroups.length === 1}
                                                        statusBarItems={statusBarItems}
                                                        options={{
                                                            renderWhitespace: "selection",
                                                            smoothScrolling: true,
                                                            cursorBlinking: "smooth",
                                                            cursorSmoothCaretAnimation: "on",
                                                            formatOnPaste: true,
                                                            linkedEditing: true,
                                                            mouseWheelZoom: true,
                                                            stickyScroll: { enabled: true },
                                                        }}
                                                        enableExtensions={isActiveGroup}
                                                        chatBaseUrl={__config.API_URL}
                                                        chatHostId={hostUser}
                                                        onChatApplyCode={(code) => {
                                                            const editor = editorRef.current;
                                                            if (editor) {
                                                                editor.setValue(code);
                                                                setModified(true);
                                                                showEditorNotification("AI suggestion applied", "success", {
                                                                    source: "AI Chat",
                                                                    timeout: 3000,
                                                                });
                                                            }
                                                        }}
                                                        onNotify={(msg, type) => {
                                                            showEditorNotification(msg, type as any, {
                                                                source: "Editor",
                                                                timeout: type === "error" ? 6000 : 3000,
                                                            });
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            </div>
                                        </ResizablePanel>
                                    </React.Fragment>
                                );
                            })}
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            {/* Theme picker backdrop */}
            {showThemePicker && (
                <div
                    className="fixed inset-0 z-[9998]"
                    onClick={() => setShowThemePicker(false)}
                />
            )}

            {/* ── Shortcuts help modal ────────────────────────── */}
            {showShortcuts && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowShortcuts(false)}
                >
                    <div
                        className="rounded-xl shadow-2xl shadow-black/50 w-[560px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col bg-[#252526] border border-[#3c3c3c]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[#3c3c3c]">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-400" />
                                <span className="text-[14px] font-semibold text-gray-200">
                                    Keyboard Shortcuts
                                </span>
                            </div>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto p-5 space-y-5">
                            {shortcutGroups.map((group) => (
                                <div key={group.title}>
                                    <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2 text-blue-400">
                                        {group.title}
                                    </h3>
                                    <div className="space-y-1">
                                        {group.items.map((item) => (
                                            <div
                                                key={item.keys}
                                                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[#1e1e1e] transition-colors"
                                            >
                                                <span className="text-[13px] text-gray-200">
                                                    {item.desc}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {item.keys.split("+").map((key, ki) => (
                                                        <span key={ki}>
                                                            <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm bg-[#1e1e1e] border border-[#3c3c3c] text-gray-200">
                                                                {key.trim()}
                                                            </kbd>
                                                            {ki < item.keys.split("+").length - 1 && (
                                                                <span className="text-[10px] mx-0.5 text-gray-500">
                                                                    +
                                                                </span>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Tips section */}
                            <div className="pt-4 border-t border-[#3c3c3c]">
                                <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2 text-green-400">
                                    Tips
                                </h3>
                                <ul className="space-y-1.5 text-[12px] text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="mt-0.5 text-blue-400">•</span>
                                        Ctrl+F opens Monaco's built-in find with regex, case-sensitive, and
                                        whole word options
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-0.5 text-blue-400">•</span>
                                        Ctrl+Shift+P opens the Command Palette for all available actions
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-0.5 text-blue-400">•</span>
                                        Use Alt+Click to place multiple cursors for simultaneous editing
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-0.5 text-blue-400">•</span>
                                        Ctrl+C/X with no selection copies/cuts the entire current line
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-0.5 text-blue-400">•</span>
                                        The minimap on the right gives a bird's-eye view of the full file
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-0.5 text-blue-400">•</span>
                                        Unsaved changes show an orange dot next to the filename
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-2.5 flex justify-end border-t border-[#3c3c3c]">
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="text-[12px] px-4 py-1.5 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab bar scrollbar styles */}
            <style>{`
                .tab-bar-scroll::-webkit-scrollbar { height: 3px; }
                .tab-bar-scroll::-webkit-scrollbar-track { background: transparent; }
                .tab-bar-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 2px; }
                .tab-bar-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
            `}</style>
        </div>
    );
}
