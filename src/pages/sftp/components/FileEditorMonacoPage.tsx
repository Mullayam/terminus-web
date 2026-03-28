/**
 * @module FileEditorMonacoPage
 *
 * Monaco Editor-powered file editor page.
 * Route: /ssh/sftp/edit-monaco?tabId=xxx&path=/remote/file
 *
 * Split into sub-components under `monaco-editor-parts/` to keep
 * this orchestrator lean and prevent unnecessary re-renders:
 *
 *   useEditorSftpTree  — dedicated SFTP socket + file-tree state
 *   EditorToolbar      — top bar (memoized)
 *   EditorTabBar       — per-group tab strip (memoized)
 *   FileTreePanel      — left sidebar tree (memoized)
 *   ThemePicker        — theme dropdown (memoized, inside toolbar)
 *   ShortcutsModal     — keyboard shortcuts dialog (memoized)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiCore } from "@/lib/api";
import { __config } from "@/lib/config";
import { Loader2, RefreshCw } from "lucide-react";
import { cachedIconUrl } from "@/lib/iconCache";
import { getIconForFile } from "vscode-icons-js";
import { useSFTPStore } from "@/store/sftpStore";
import {
    MonacoEditor,
    ALL_BUILTIN_PLUGINS,
    detectLanguage,
    createGhostTextPlugin,
    createNotificationPlugin,
    createInlineCommandPlugin,
    showEditorNotification,
    loadEditorSettings,
} from "@/modules/monaco-editor";
import type { MonacoEditorInstance, AICompletionProvider } from "@/modules/monaco-editor";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
    useEditorSftpTree,
    EditorToolbar,
    EditorTabBar,
    FileTreePanel,
    ShortcutsModal,
    type ThemeId,
    type EditorTab,
} from "./monaco-editor-parts";
import { EditorWelcomeDialog } from "@/components/EditorWelcomeDialog";
import { MONACO_THEMES } from "./monaco-editor-parts/ThemePicker";
import { useFileOperations } from "@/modules/monaco-editor/components/file-tree/useFileOperations";
import { getLoadedMonacoTheme } from "@/modules/monaco-editor/themes/monaco-themes-catalog";

/* ── Constants ─────────────────────────────────────────────── */

const ICON_CDN =
    "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons";

/** Lighten or darken a hex colour by `amount` (positive = lighter). */
function adjustBrightness(hex: string, amount: number): string {
    const c = hex.replace("#", "");
    const num = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
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
    const filePath = params.get("path") ?? "";
    const sessionId = params.get("sessionId") ?? params.get("tabId") ?? "";
    const hostUser = params.get("user") ?? "";
    const fileName = filePath.split("/").pop() ?? "untitled";
    const lang = detectLanguage(filePath || fileName);

    /* ── Mutable session-id ref (silently updated when old session disconnects) */
    const sessionIdRef = useRef(sessionId);
    // Keep ref in sync when URL changes normally
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    /**
     * Watch the SFTP store: if the session referenced in the URL is removed
     * (disconnected), silently swap the URL param to the currently-active
     * SFTP tab so a future page refresh will reconnect to the right session.
     * Uses history.replaceState to avoid any React re-render / page reload.
     */
    useEffect(() => {
        const unsub = useSFTPStore.subscribe((state, prev) => {
            const currentId = sessionIdRef.current;
            if (!currentId) return;

            // Session still exists → nothing to do
            if (state.sessions[currentId]) return;

            // Session was just removed (existed in prev, gone in current)
            if (!prev.sessions[currentId] && !state.sessions[currentId]) return;

            // Pick the active tab, or fall back to any remaining tab
            const newId =
                state.activeTabId && state.sessions[state.activeTabId]
                    ? state.activeTabId
                    : state.tabs[0]?.id ?? "";

            if (!newId || newId === currentId) return;

            // Silently update the URL (no React re-render)
            const url = new URL(window.location.href);
            if (url.searchParams.has("sessionId")) {
                url.searchParams.set("sessionId", newId);
            }
            if (url.searchParams.has("tabId")) {
                url.searchParams.set("tabId", newId);
            }
            window.history.replaceState(null, "", url.toString());
            sessionIdRef.current = newId;
        });
        return unsub;
    }, []);

    // Extract directory from remote path for terminal cwd
    const terminalCwd = useMemo(() => {
        if (!filePath) return "/";
        const dir = filePath.replace(/\/[^/]*$/, "");
        return dir || "/";
    }, [filePath]);

    /* ── State ──────────────────────────────────────────────── */
    const [initialContent, setInitialContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modified, setModified] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [wordWrap, setWordWrap] = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [cursorLine, setCursorLine] = useState(1);
    const [cursorCol, setCursorCol] = useState(1);
    const [themeId, setThemeId] = useState<ThemeId>(
        () => (localStorage.getItem("monaco-editor-theme") as ThemeId) ?? "one-dark",
    );

    /* ── Refs ───────────────────────────────────────────────── */
    const editorRef = useRef<MonacoEditorInstance | null>(null);
    const originalContentRef = useRef("");
    /** Tracks the latest editor content without triggering re-renders */
    const contentRef = useRef("");
    /** Per-tab content refs keyed by tab id */
    const tabContentRefs = useRef<Record<string, string>>({});

    /* ── File-tree hook (dedicated socket — isolated state) ── */
    const initialDir = useMemo(() => {
        if (!filePath) return "/";
        const dir = filePath.replace(/\/[^/]*$/, "");
        return dir || "/";
    }, [filePath]);

    const {
        socket: treeSocket,
        sftpSocketRef,
        editorSftpReady,
        treeFiles,
        treeDir,
        treeCollapsed,
        setTreeCollapsed,
        handleTreeNavigate,
        handleTreeRefresh,
        readFileViaSocket,
        writeFileViaSocket,
        connectToHost,
        editorSftpStatus,
        editorSftpError,
    } = useEditorSftpTree({ sessionId, initialDir, hostUser });

    /* ── File operations for context menu ───────────────────── */
    const fileOps = useFileOperations(sftpSocketRef, handleTreeRefresh ? () => handleTreeRefresh() : undefined);
 
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

        // Fetch content via socket (no HTTP download needed)
        readFileViaSocket(fullPath)
            .then((content) => {
                setTabs((prev) => ({
                    ...prev,
                    [id]: {
                        ...prev[id],
                        content,
                        originalContent: content,
                        loading: false,
                    },
                }));
                tabContentRefs.current[id] = content;
            })
            .catch((e) => {
                setTabs((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], loading: false, error: e?.message ?? "Failed to load" },
                }));
            });
    }, [tabs, activeGroupId, readFileViaSocket]);

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

    /** Close all tabs to the left of the given tab in its group */
    const closeTabsToLeft = useCallback((tabId: string) => {
        setSplitGroups((prev) =>
            prev.map((g) => {
                const idx = g.tabIds.indexOf(tabId);
                if (idx <= 0) return g;
                const toClose = g.tabIds.slice(0, idx).filter((id) => id !== initialTabId);
                toClose.forEach((id) => { delete tabContentRefs.current[id]; });
                const newTabIds = g.tabIds.filter((id) => !toClose.includes(id));
                return { ...g, tabIds: newTabIds, activeTabId: g.activeTabId };
            }),
        );
        setTabs((prev) => {
            const next = { ...prev };
            // Clean up removed tabs from state
            Object.keys(next).forEach((id) => {
                if (id === initialTabId || id === tabId) return;
                const inAnyGroup = splitGroups.some((g) => {
                    const idx = g.tabIds.indexOf(tabId);
                    const toClose = g.tabIds.slice(0, idx).filter((tid) => tid !== initialTabId);
                    return toClose.includes(id);
                });
                // Let the splitGroups update handle it
            });
            return next;
        });
    }, [initialTabId, splitGroups]);

    /** Close all tabs to the right of the given tab in its group */
    const closeTabsToRight = useCallback((tabId: string) => {
        setSplitGroups((prev) =>
            prev.map((g) => {
                const idx = g.tabIds.indexOf(tabId);
                if (idx < 0 || idx >= g.tabIds.length - 1) return g;
                const toClose = g.tabIds.slice(idx + 1).filter((id) => id !== initialTabId);
                toClose.forEach((id) => { delete tabContentRefs.current[id]; });
                const newTabIds = g.tabIds.filter((id) => !toClose.includes(id));
                const newActive = newTabIds.includes(g.activeTabId ?? "")
                    ? g.activeTabId
                    : newTabIds[newTabIds.length - 1] ?? null;
                return { ...g, tabIds: newTabIds, activeTabId: newActive };
            }),
        );
    }, [initialTabId]);

    /** Close all tabs in the active group (except pinned) */
    const closeAllTabs = useCallback(() => {
        setSplitGroups((prev) =>
            prev.map((g) => {
                if (g.id !== activeGroupId) return g;
                const toClose = g.tabIds.filter((id) => id !== initialTabId);
                toClose.forEach((id) => { delete tabContentRefs.current[id]; });
                const newTabIds = g.tabIds.filter((id) => id === initialTabId);
                return { ...g, tabIds: newTabIds, activeTabId: newTabIds[0] ?? null };
            }).filter((g) => g.tabIds.length > 0),
        );
    }, [activeGroupId, initialTabId]);

    /** Close all non-modified (saved) tabs in the active group (except pinned) */
    const closeSavedTabs = useCallback(() => {
        setSplitGroups((prev) =>
            prev.map((g) => {
                if (g.id !== activeGroupId) return g;
                const toClose = g.tabIds.filter((id) => {
                    if (id === initialTabId) return false;
                    const tab = tabs[id];
                    return tab && !tab.modified;
                });
                toClose.forEach((id) => { delete tabContentRefs.current[id]; });
                const newTabIds = g.tabIds.filter((id) => !toClose.includes(id));
                const newActive = newTabIds.includes(g.activeTabId ?? "")
                    ? g.activeTabId
                    : newTabIds[newTabIds.length - 1] ?? null;
                return { ...g, tabIds: newTabIds, activeTabId: newActive };
            }).filter((g) => g.tabIds.length > 0),
        );
    }, [activeGroupId, initialTabId, tabs]);

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

    // Ghost text endpoint — use settings value if set, else default API_URL
    const ghostTextEndpoint = loadEditorSettings().ghostTextEndpoint || __config.API_URL;

    // Memoize plugins — ghost text is only included when selected
    const ghostTextPlugin = useMemo(
        () => createGhostTextPlugin({ endpoint: ghostTextEndpoint }),
        [ghostTextEndpoint],
    );
    const notificationPlugin = useMemo(
        () => createNotificationPlugin({ socket: treeSocket ?? undefined }),
        [treeSocket],
    );
    const inlineCommandPlugin = useMemo(
        () => createInlineCommandPlugin({ endpoint: __config.API_URL }),
        [],
    );
    const plugins = useMemo(
        () => [
            ...ALL_BUILTIN_PLUGINS,
            ...(aiProvider === "ghost-text" ? [ghostTextPlugin] : []),
            notificationPlugin,
            inlineCommandPlugin,
        ],
        [ghostTextPlugin, notificationPlugin, inlineCommandPlugin, aiProvider],
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
        const rawUrl = iconFile ? `${ICON_CDN}/${iconFile}` : `${ICON_CDN}/default_file.svg`;

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
        if (!filePath) {
            setError("Missing file path in URL");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            let fileData: string;

            // Prefer editor's own SFTP socket when connected (survives old session disconnect)
            if (editorSftpReady) {
                fileData = await readFileViaSocket(filePath);
            } else if (sessionIdRef.current) {
                // Fallback to API with URL-based sessionId
                const data = await ApiCore.fetchFileContent(sessionIdRef.current, filePath);
                if (!data.status) throw new Error(data.message || "Failed to load file content");
                fileData = data.result;
            } else {
                throw new Error("No SFTP session available. Connect the editor SFTP to browse files.");
            }

            contentRef.current = fileData;
            originalContentRef.current = fileData;
            setInitialContent(fileData);
            setModified(false);
            tabContentRefs.current[initialTabId] = fileData;
            setTabs((prev) => ({
                ...prev,
                [initialTabId]: {
                    ...prev[initialTabId],
                    content: fileData,
                    originalContent: fileData,
                    loading: false,
                },
            }));
            // If editor is already mounted (reload), push content into the model directly
            if (editorRef.current) {
                editorRef.current.setValue(fileData);
            }
        } catch (e: any) {
            setError(e?.message ?? "Failed to load file");
        } finally {
            setLoading(false);
        }
    }, [filePath, editorSftpReady, readFileViaSocket]);

    useEffect(() => { fetchContent(); }, [fetchContent]);

    /* ── Save file ─────────────────────────────────────────── */
    const handleSave = useCallback(async (value?: string) => {
        if (saving) return;
        // Must have either editor SFTP or URL sessionId
        if (!editorSftpReady && !sessionIdRef.current) return;
        const tab = activeTab;
        const saveFilePath = tab?.filePath ?? filePath;
        const saveFileName = tab?.fileName ?? fileName;
        const toSave = value ?? (activeTabId ? tabContentRefs.current[activeTabId] : undefined) ?? contentRef.current;
        setSaving(true);
        try {
            // Prefer editor's own SFTP socket when connected
            if (editorSftpReady) {
                await writeFileViaSocket(saveFilePath, toSave);
            } else {
                await ApiCore.saveFileContent(sessionIdRef.current, saveFilePath, toSave);
            }
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
    }, [saving, activeTab, activeTabId, filePath, fileName, editorSftpReady, writeFileViaSocket]);

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

    /* ── Theme & toggles ───────────────────────────────────── */
    /** Apply CSS variables from theme colors so sidebar/tabbar/toolbar match */
    const applyThemeCssVars = useCallback((id: string) => {
        let bg: string | undefined;
        let fg: string | undefined;
        let accent: string | undefined;
        let isDark = true;

        // 1. Try the precomputed MONACO_THEMES list (built-in + monaco-themes package)
        const info = MONACO_THEMES.find((t) => t.id === id);
        if (info) {
            [bg, fg, accent] = info.displayColors;
            isDark = info.isDark;
        } else {
            // 2. Try extracting from a loaded theme definition (extension or custom)
            const loaded = getLoadedMonacoTheme(id);
            if (loaded) {
                bg = loaded.colors["editor.background"] ?? "#1e1e1e";
                fg = loaded.colors["editor.foreground"] ?? "#d4d4d4";
                accent = loaded.colors["editorCursor.foreground"] ?? loaded.colors["editor.foreground"] ?? "#569cd6";
                isDark = loaded.base === "vs-dark" || loaded.base === "hc-black";
            }
        }

        // Apply if we found any colours
        if (bg) {
            const sidebarBg = isDark ? adjustBrightness(bg, 8) : adjustBrightness(bg, -8);
            const borderColor = isDark ? adjustBrightness(bg, 20) : adjustBrightness(bg, -20);
            const hoverBg = isDark ? adjustBrightness(bg, 14) : adjustBrightness(bg, -14);

            // Status bar: prefer explicit theme color, then derive from bg (not accent)
            const themeDef = getLoadedMonacoTheme(id);
            const themeStatusBarBg = themeDef?.colors?.["statusBar.background"];
            const statusBarBg = themeStatusBarBg
                ? themeStatusBarBg
                : (isDark ? adjustBrightness(bg, 20) : adjustBrightness(bg, -20));
            const root = document.documentElement;
            root.style.setProperty("--editor-bg", bg);
            root.style.setProperty("--editor-fg", fg ?? "#d4d4d4");
            root.style.setProperty("--editor-accent", accent ?? "#569cd6");
            root.style.setProperty("--editor-sidebar-bg", sidebarBg);
            root.style.setProperty("--editor-border", borderColor);
            root.style.setProperty("--editor-hover-bg", hoverBg);
            root.style.setProperty("--editor-statusbar-bg", statusBarBg);
            root.style.setProperty("--editor-is-dark", isDark ? "1" : "0");

            // Scrollbar colours from theme (fall back to derived values)
            const themeDef2 = themeDef ?? getLoadedMonacoTheme(id);
            const scrollThumb = themeDef2?.colors?.["scrollbarSlider.background"]
              ?? (isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)");
            const scrollThumbHover = themeDef2?.colors?.["scrollbarSlider.hoverBackground"]
              ?? (isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)");
            const scrollTrack = isDark ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.05)";
            root.style.setProperty("--editor-scrollbar-thumb", scrollThumb);
            root.style.setProperty("--editor-scrollbar-thumb-hover", scrollThumbHover);
            root.style.setProperty("--editor-scrollbar-track", scrollTrack);
        }
    }, []);

    const handleThemeSelect = useCallback((id: ThemeId) => {
        setThemeId(id);
        localStorage.setItem("monaco-editor-theme", id);
        setShowThemePicker(false);
        applyThemeCssVars(id);
    }, [applyThemeCssVars]);

    /** Called when a theme is applied from inside MonacoEditor (e.g. right sidebar ThemeSidebar) */
    const handleExternalThemeApply = useCallback((id: string) => {
        setThemeId(id as ThemeId);
        localStorage.setItem("monaco-editor-theme", id);
        applyThemeCssVars(id);
    }, [applyThemeCssVars]);

    // Apply CSS vars on initial load
    useEffect(() => {
        applyThemeCssVars(themeId);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const toggleThemePicker = useCallback(() => setShowThemePicker((v) => !v), []);
    const toggleWordWrap = useCallback(() => setWordWrap((w) => !w), []);
    const openShortcuts = useCallback(() => setShowShortcuts(true), []);
    const closeShortcuts = useCallback(() => setShowShortcuts(false), []);

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

    /* ── Reload-from-server confirmation ─────────────────────── */
    const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

    const handleReloadFromServer = useCallback(() => {
        // If nothing is modified, reload immediately without prompting
        const isModified = (activeTab?.modified ?? modified);
        if (!isModified) {
            fetchContent();
            return;
        }
        setReloadConfirmOpen(true);
    }, [activeTab?.modified, modified, fetchContent]);

    const confirmReload = useCallback(() => {
        setReloadConfirmOpen(false);
        fetchContent();
    }, [fetchContent]);

    /* ── Stable toolbar callbacks ──────────────────────────── */
    const handleToolbarSave = useCallback(() => handleSave(), [handleSave]);
    const handleToolbarSplit = useCallback(() => {
        if (activeTabId) splitTabToNewGroup(activeTabId);
    }, [activeTabId, splitTabToNewGroup]);

    /* ── Error state ────────────────────────────────────────── */
    if (error && initialContent === null) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: "var(--editor-bg, #1e1e1e)" }}>
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
            <div className="flex items-center justify-center h-screen" style={{ background: "var(--editor-bg, #1e1e1e)" }}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-sm" style={{ color: "var(--editor-fg, #d4d4d4)" }}>Loading {fileName}…</span>
                </div>
            </div>
        );
    }

    /* ── Main render ────────────────────────────────────────── */
    return (
        <div className="h-screen w-full overflow-hidden flex flex-col editor-themed-scroll" style={{ background: "var(--editor-bg, #1e1e1e)", color: "var(--editor-fg, #d4d4d4)" }}>

            {/* Toolbar (memoized) */}
            <EditorToolbar
                currentFileName={currentFileName}
                currentFilePath={currentFilePath}
                modified={activeTab?.modified ?? modified}
                loading={loading}
                saving={saving}
                wordWrap={wordWrap}
                themeId={themeId}
                showThemePicker={showThemePicker}
                canSplit={!!activeTabId}
                onReload={handleReloadFromServer}
                onToggleWordWrap={toggleWordWrap}
                onToggleThemePicker={toggleThemePicker}
                onThemeSelect={handleThemeSelect}
                onShowShortcuts={openShortcuts}
                onSave={handleToolbarSave}
                onSplit={handleToolbarSplit}
            />

            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    {/* Left sidebar (memoized — tree state is isolated in hook) */}
                    <FileTreePanel
                        treeDir={treeDir}
                        treeFiles={treeFiles}
                        treeCollapsed={treeCollapsed}
                        onFileOpen={handleTreeFileOpen}
                        onNavigate={handleTreeNavigate}
                        onRefresh={handleTreeRefresh}
                        onCollapsedChange={setTreeCollapsed}
                        sftpStatus={editorSftpStatus}
                        sftpError={editorSftpError}
                        onConnect={connectToHost}
                        hostLabel={hostUser}
                        fileOps={fileOps}
                    />
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
                                        {gi > 0 && <ResizableHandle withHandle className="hover:bg-blue-500/40 transition-colors" style={{ background: "var(--editor-border, #3c3c3c)" }} />}
                                        <ResizablePanel minSize={20} className="h-full">
                                            <div className="flex flex-col h-full">
                                                {/* Tab bar (memoized) */}
                                                <EditorTabBar
                                                    tabIds={group.tabIds}
                                                    tabs={tabs}
                                                    activeTabId={group.activeTabId}
                                                    pinnedTabId={initialTabId}
                                                    groupId={group.id}
                                                    onSwitch={switchTab}
                                                    onClose={closeTab}
                                                    onCloseToLeft={closeTabsToLeft}
                                                    onCloseToRight={closeTabsToRight}
                                                    onCloseAll={closeAllTabs}
                                                    onCloseSaved={closeSavedTabs}
                                                    onSplitRight={splitTabToNewGroup}
                                                />
                                                {/* Editor for active tab */}
                                                <div className="flex-1 overflow-hidden" onClick={() => setActiveGroupId(group.id)}>
                                                    {groupActiveTab?.loading ? (
                                                        <div className="flex items-center justify-center h-full" style={{ background: "var(--editor-bg, #1e1e1e)" }}>
                                                            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                                        </div>
                                                    ) : groupActiveTab?.error ? (
                                                        <div className="flex items-center justify-center h-full" style={{ background: "var(--editor-bg, #1e1e1e)" }}>
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
                                                            onThemeApply={handleExternalThemeApply}
                                                            onCursorChange={(line, col) => {
                                                                setCursorLine(line);
                                                                setCursorCol(col);
                                                            }}
                                                            copilotEndpoint={`${__config.API_URL}/api/complete`}
                                                            aiCompletionsEndpoint={`${__config.API_URL}/api/completions`}
                                                            onAIProviderChange={handleAIProviderChange}
                                                            showSidebar={isActiveGroup && gi === splitGroups.length - 1}
                                                            showStatusBar={isActiveGroup && gi === splitGroups.length - 1}
                                                            enableTerminal={isActiveGroup && gi === splitGroups.length - 1}
                                                            enableAutoClose
                                                            enableLSP
                                                            lspBaseUrl="ws://localhost:9257"
                                                            documentUri={`file://${editorFilePath || editorFileName}`}
                                                            pluginDebounceMs={1200}
                                                            enableVsixDrop={isActiveGroup}
                                                            terminalUrl={`${__config.API_URL}/dedicated-terminal`}
                                                            terminalSessionId={sessionIdRef.current}
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

            {/* First-time welcome dialog */}
            <EditorWelcomeDialog />

            {/* Shortcuts modal (memoized, conditionally rendered) */}
            {showShortcuts && <ShortcutsModal onClose={closeShortcuts} />}

            {/* Reload confirmation dialog */}
            <AlertDialog open={reloadConfirmOpen} onOpenChange={setReloadConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reload file from server?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes. Reloading will discard all local edits and
                            replace the content with the latest version from the server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>No, keep my changes</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmReload}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            Yes, reload
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Tab bar scrollbar styles */}
            <style>{`
                .tab-bar-scroll::-webkit-scrollbar { height: 3px; }
                .tab-bar-scroll::-webkit-scrollbar-track { background: transparent; }
                .tab-bar-scroll::-webkit-scrollbar-thumb { background: var(--editor-scrollbar-thumb, #5a5a5a); border-radius: 2px; }
                .tab-bar-scroll::-webkit-scrollbar-thumb:hover { background: var(--editor-scrollbar-thumb-hover, #7a7a7a); }
            `}</style>
        </div>
    );
}
