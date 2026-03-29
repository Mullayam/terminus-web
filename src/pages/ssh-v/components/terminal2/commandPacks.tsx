/**
 * @module ssh-v/components/terminal2/commandPacks
 *
 * Independent context-engine command installer for the SSH terminal sidebar.
 * Lets users browse and install CLI command packs from @enjoys/context-engine
 * for ghost-text suggestions in the SSH terminal.
 *
 * When a file is clicked, it fetches the command JSON and displays
 * globalOptions + subcommands. A download button adds them to the
 * Commands section (persisted in Dexie IDB).
 *
 * Fully independent — no SFTP or Monaco editor dependency.
 */
import React, { useState, useCallback, useEffect } from "react";
import {
    Search,
    Download,
    Trash2,
    ChevronDown,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Package,
    RefreshCw,
    Terminal,
    FileText,
    ArrowLeft,
    Plus,
    Flag,
    Code,
} from "lucide-react";
import {
    fetchTerminalCommandsManifest,
    fetchCommandFiles,
    fetchJsonFile,
    buildCmdFileUrl,
    setStoredContextEngineVersion,
    type TerminalCommandContext,
} from "@/lib/context-engine/contextEngineApi";
import {
    saveCommandCategory,
    removeCommandCategory,
    getInstalledCategories,
} from "@/lib/context-engine/contextEngineStorage";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useCommandStore } from "@/store";
import { useTabStore } from "@/store/rightSidebarTabStore";

/* ── Types ─────────────────────────────────────────────────── */

type InstallState = Record<string, "installing" | "installed" | "error">;

/** Shape of a single command JSON from CDN */
interface CmdFileData {
    name: string;
    description: string;
    category?: string;
    globalOptions?: { name: string; short?: string; description: string; type?: string }[];
    subcommands?: { name: string; description: string; options?: { name: string; short?: string; description: string }[]; examples?: string[] }[];
}

/** Currently previewed file */
interface FilePreview {
    fileName: string;
    categoryName: string;
    data: CmdFileData | null;
    loading: boolean;
    error: string | null;
}

/* ── Component ─────────────────────────────────────────────── */

export default function CommandPacks() {
    const { colors } = useSessionTheme();
    const { addToAllCommands } = useCommandStore();
    const {
        setInstalledPacksCount,
        checkForUpdate,
        contextEngineVersion,
        latestContextEngineVersion,
        updateAvailable,
        dismissUpdate,
    } = useTabStore();
    const [categories, setCategories] = useState<TerminalCommandContext[]>([]);
    const [installedCats, setInstalledCats] = useState<Set<string>>(new Set());
    const [installState, setInstallState] = useState<InstallState>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [filePreview, setFilePreview] = useState<FilePreview | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [manifest, installedList] = await Promise.all([
                fetchTerminalCommandsManifest(),
                getInstalledCategories(),
            ]);
            setCategories(manifest.context ?? []);
            setInstalledCats(new Set(installedList.map((c) => c.id)));
            const state: InstallState = {};
            installedList.forEach((c) => { state[c.id] = "installed"; });
            setInstallState(state);
            setInstalledPacksCount(installedList.length);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load command packs");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        checkForUpdate().then(() => {
            // If user already has installed packs but no stored version (pre-existing install),
            // auto-store the latest version so future updates can be detected.
            const { contextEngineVersion: stored, latestContextEngineVersion: latest, installedPacksCount } = useTabStore.getState();
            if (!stored && latest && installedPacksCount > 0) {
                setStoredContextEngineVersion(latest);
            }
        });
    }, [loadData]);

    const handleInstall = useCallback(async (cat: TerminalCommandContext) => {
        setInstallState((s) => ({ ...s, [cat.category]: "installing" }));
        try {
            const files = await fetchCommandFiles(cat.files);
            await saveCommandCategory(
                {
                    id: cat.category,
                    category: cat.category,
                    context: cat.context,
                    files: cat.files,
                },
                files,
            );
            setInstalledCats((s) => {
                const n = new Set(s).add(cat.category);
                setInstalledPacksCount(n.size);
                return n;
            });
            setInstallState((s) => ({ ...s, [cat.category]: "installed" }));
            // Persist the CDN version on first install
            if (latestContextEngineVersion && !contextEngineVersion) {
                setStoredContextEngineVersion(latestContextEngineVersion);
            }
        } catch {
            setInstallState((s) => ({ ...s, [cat.category]: "error" }));
        }
    }, []);

    const handleUninstall = useCallback(async (id: string) => {
        await removeCommandCategory(id);
        setInstalledCats((s) => {
            const n = new Set(s);
            n.delete(id);
            setInstalledPacksCount(n.size);
            return n;
        });
        setInstallState((s) => { const n = { ...s }; delete n[id]; return n; });
    }, []);

    const toggleExpand = useCallback((id: string) => {
        setExpanded((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    }, []);

    /** Click on a file in the category → fetch and preview its command data */
    const handleFileClick = useCallback(async (fileName: string, categoryName: string) => {
        setFilePreview({ fileName, categoryName, data: null, loading: true, error: null });
        try {
            const data = await fetchJsonFile(buildCmdFileUrl(fileName)) as CmdFileData;
            setFilePreview({ fileName, categoryName, data, loading: false, error: null });
        } catch (e: any) {
            setFilePreview({ fileName, categoryName, data: null, loading: false, error: e?.message ?? "Failed to load" });
        }
    }, []);

    /** Download a single command file's options/subcommands into the Commands list */
    const handleDownloadToCommands = useCallback((data: CmdFileData) => {
        const parentName = data.name; // e.g. "ls", "git"
        const cmds: { name: string; command: string }[] = [];

        // Global options → commands: name=description, command="ls -a"
        if (data.globalOptions) {
            for (const opt of data.globalOptions) {
                cmds.push({
                    name: opt.description,
                    command: `${parentName} ${opt.name}`,
                });
            }
        }

        // Subcommands → commands: name=description, command="git clone"
        if (data.subcommands) {
            for (const sub of data.subcommands) {
                cmds.push({
                    name: sub.description,
                    command: `${parentName} ${sub.name}`,
                });
            }
        }

        // Add all to the command store (each is persisted to IDB)
        for (const cmd of cmds) {
            addToAllCommands(cmd);
        }
    }, [addToAllCommands]);

    const filtered = search
        ? categories.filter(
              (c) =>
                  c.category.toLowerCase().includes(search.toLowerCase()) ||
                  (c.context ?? []).some((ctx) => ctx.toLowerCase().includes(search.toLowerCase())),
          )
        : categories;

    const installedList = filtered.filter((c) => installedCats.has(c.category));
    const availableList = filtered.filter((c) => !installedCats.has(c.category));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.cyan }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center space-y-2">
                <p className="text-xs" style={{ color: colors.red }}>{error}</p>
                <button
                    onClick={loadData}
                    className="text-xs flex items-center gap-1 mx-auto hover:underline"
                    style={{ color: colors.blue }}
                >
                    <RefreshCw className="w-3 h-3" /> Retry
                </button>
            </div>
        );
    }

    /* ── File Preview View ── */
    if (filePreview) {
        return (
            <FilePreviewPanel
                preview={filePreview}
                colors={colors}
                onBack={() => setFilePreview(null)}
                onDownload={handleDownloadToCommands}
            />
        );
    }

    /* ── Category List View ── */
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 pt-3 pb-2 space-y-2">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" style={{ color: colors.cyan }} />
                    <span className="text-sm font-semibold" style={{ color: colors.foreground }}>
                        Command Packs
                    </span>
                    {contextEngineVersion && (
                        <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                            style={{ background: colors.foreground + "12", color: colors.foreground + "60" }}
                        >
                            v{contextEngineVersion}
                        </span>
                    )}
                    <button
                        onClick={loadData}
                        className="ml-auto p-1 rounded hover:opacity-80 transition-opacity"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3 h-3" style={{ color: colors.foreground + "80" }} />
                    </button>
                </div>
                <p className="text-[10px]" style={{ color: colors.foreground + "70" }}>
                    Install CLI command packs for ghost-text suggestions
                </p>

                {/* Update available banner */}
                {updateAvailable && latestContextEngineVersion && (
                    <div
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px]"
                        style={{ background: colors.yellow + "15", border: `1px solid ${colors.yellow}30` }}
                    >
                        <Package className="w-3.5 h-3.5 shrink-0" style={{ color: colors.yellow }} />
                        <span style={{ color: colors.foreground }}>
                            Update available:{" "}
                            <strong style={{ color: colors.yellow }}>v{latestContextEngineVersion}</strong>
                        </span>
                        <button
                            onClick={dismissUpdate}
                            className="ml-auto text-[10px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                            style={{ background: colors.yellow + "20", color: colors.yellow }}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Search */}
                <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                    style={{ background: colors.foreground + "10", border: `1px solid ${colors.foreground}15` }}
                >
                    <Search className="w-3 h-3 shrink-0" style={{ color: colors.foreground + "50" }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search command packs..."
                        className="bg-transparent outline-none w-full text-[11px]"
                        style={{ color: colors.foreground }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 themed-scrollbar">
                {/* Installed */}
                {installedList.length > 0 && (
                    <Section title="Installed" count={installedList.length} colors={colors}>
                        {installedList.map((cat) => (
                            <CategoryCard
                                key={cat.category}
                                cat={cat}
                                state={installState[cat.category]}
                                isExpanded={expanded.has(cat.category)}
                                onToggleExpand={() => toggleExpand(cat.category)}
                                onInstall={() => handleInstall(cat)}
                                onUninstall={() => handleUninstall(cat.category)}
                                onFileClick={(f) => handleFileClick(f, cat.category)}
                                colors={colors}
                            />
                        ))}
                    </Section>
                )}

                {/* Available */}
                {availableList.length > 0 && (
                    <Section title="Available" count={availableList.length} colors={colors}>
                        {availableList.map((cat) => (
                            <CategoryCard
                                key={cat.category}
                                cat={cat}
                                state={installState[cat.category]}
                                isExpanded={expanded.has(cat.category)}
                                onToggleExpand={() => toggleExpand(cat.category)}
                                onInstall={() => handleInstall(cat)}
                                onUninstall={() => handleUninstall(cat.category)}
                                onFileClick={(f) => handleFileClick(f, cat.category)}
                                colors={colors}
                            />
                        ))}
                    </Section>
                )}

                {filtered.length === 0 && (
                    <div className="text-center py-8 text-xs" style={{ color: colors.foreground + "50" }}>
                        No command packs found.
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Subcomponents ─────────────────────────────────────────── */

function Section({ title, count, colors, children }: {
    title: string;
    count: number;
    colors: any;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.foreground + "60" }}>
                <span>{title}</span>
                <span
                    className="px-1 rounded text-[9px]"
                    style={{ background: colors.foreground + "15" }}
                >
                    {count}
                </span>
            </div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function CategoryCard({ cat, state, isExpanded, onToggleExpand, onInstall, onUninstall, onFileClick, colors }: {
    cat: TerminalCommandContext;
    state?: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onInstall: () => void;
    onUninstall: () => void;
    onFileClick: (fileName: string) => void;
    colors: any;
}) {
    const isInstalled = state === "installed";
    const isInstalling = state === "installing";

    return (
        <div
            className="rounded-md text-[11px] overflow-hidden"
            style={{ background: colors.foreground + "08", border: `1px solid ${colors.foreground}12` }}
        >
            {/* Header */}
            <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button onClick={onToggleExpand} className="shrink-0">
                    {isExpanded
                        ? <ChevronDown className="w-3 h-3" style={{ color: colors.foreground + "60" }} />
                        : <ChevronRight className="w-3 h-3" style={{ color: colors.foreground + "60" }} />
                    }
                </button>
                <Terminal className="w-3 h-3 shrink-0" style={{ color: colors.cyan }} />
                <span className="font-medium truncate" style={{ color: colors.foreground }}>
                    {cat.category}
                </span>
                <span className="text-[9px] ml-auto mr-1" style={{ color: colors.foreground + "50" }}>
                    {cat.files.length} {cat.files.length === 1 ? "file" : "files"}
                </span>

                {isInstalled ? (
                    <button
                        onClick={onUninstall}
                        className="p-0.5 rounded hover:opacity-70 transition-opacity"
                        title="Uninstall"
                    >
                        <Trash2 className="w-3 h-3" style={{ color: colors.red }} />
                    </button>
                ) : isInstalling ? (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: colors.blue }} />
                ) : (
                    <button
                        onClick={onInstall}
                        className="p-0.5 rounded hover:opacity-70 transition-opacity"
                        title="Install"
                    >
                        <Download className="w-3 h-3" style={{ color: colors.green }} />
                    </button>
                )}
            </div>

            {/* Expand details */}
            {isExpanded && (
                <div
                    className="px-2 pb-2 space-y-1.5"
                    style={{ borderTop: `1px solid ${colors.foreground}10` }}
                >
                    {/* Context tags */}
                    {cat.context.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                            {cat.context.map((ctx, i) => (
                                <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded text-[9px]"
                                    style={{
                                        background: colors.blue + "15",
                                        color: colors.blue,
                                        border: `1px solid ${colors.blue}25`,
                                    }}
                                >
                                    {ctx}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* File list — clickable */}
                    <div className="space-y-0.5">
                        {cat.files.map((file, i) => (
                            <button
                                key={i}
                                onClick={() => onFileClick(file)}
                                className="flex items-center gap-1.5 text-[10px] w-full text-left rounded px-1 py-0.5 hover:opacity-80 transition-opacity"
                                style={{ color: colors.blue }}
                            >
                                <FileText className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate underline">{file}</span>
                            </button>
                        ))}
                    </div>

                    {isInstalled && (
                        <div className="flex items-center gap-1 text-[9px] pt-0.5" style={{ color: colors.green }}>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Installed — used for ghost-text suggestions</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── File Preview Panel ────────────────────────────────────── */

function FilePreviewPanel({ preview, colors, onBack, onDownload }: {
    preview: FilePreview;
    colors: any;
    onBack: () => void;
    onDownload: (data: CmdFileData) => void;
}) {
    const [downloaded, setDownloaded] = useState(false);

    if (preview.loading) {
        return (
            <div className="flex flex-col h-full">
                <PreviewHeader fileName={preview.fileName} colors={colors} onBack={onBack} />
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.cyan }} />
                </div>
            </div>
        );
    }

    if (preview.error || !preview.data) {
        return (
            <div className="flex flex-col h-full">
                <PreviewHeader fileName={preview.fileName} colors={colors} onBack={onBack} />
                <div className="p-4 text-center">
                    <p className="text-xs" style={{ color: colors.red }}>{preview.error ?? "No data"}</p>
                </div>
            </div>
        );
    }

    const { data } = preview;
    const globalOpts = data.globalOptions ?? [];
    const subCmds = data.subcommands ?? [];
    const totalEntries = globalOpts.length + subCmds.length;

    return (
        <div className="flex flex-col h-full">
            <PreviewHeader fileName={preview.fileName} colors={colors} onBack={onBack} />

            {/* Command info */}
            <div className="px-3 pb-2 space-y-1.5">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" style={{ color: colors.cyan }} />
                    <span className="text-sm font-bold" style={{ color: colors.foreground }}>
                        {data.name}
                    </span>
                </div>
                <p className="text-[10px]" style={{ color: colors.foreground + "70" }}>
                    {data.description}
                </p>

                {/* Download button */}
                <button
                    disabled={downloaded || totalEntries === 0}
                    onClick={() => { onDownload(data); setDownloaded(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{
                        background: downloaded ? colors.green + "20" : colors.green + "15",
                        color: downloaded ? colors.green : colors.foreground,
                        border: `1px solid ${downloaded ? colors.green + "40" : colors.foreground}20`,
                    }}
                >
                    {downloaded ? (
                        <><CheckCircle2 className="w-3 h-3" /> Added {totalEntries} commands</>
                    ) : (
                        <><Plus className="w-3 h-3" /> Add {totalEntries} commands to list</>
                    )}
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 themed-scrollbar">
                {/* Global Options */}
                {globalOpts.length > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.foreground + "60" }}>
                            <Flag className="w-3 h-3" />
                            <span>Global Options</span>
                            <span className="px-1 rounded text-[9px]" style={{ background: colors.foreground + "15" }}>
                                {globalOpts.length}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            {globalOpts.map((opt, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 px-2 py-1 rounded text-[10px]"
                                    style={{ background: colors.foreground + "06" }}
                                >
                                    <code
                                        className="shrink-0 font-mono font-bold"
                                        style={{ color: colors.yellow }}
                                    >
                                        {opt.name}{opt.short ? ` (${opt.short})` : ""}
                                    </code>
                                    <span style={{ color: colors.foreground + "80" }}>
                                        {opt.description}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subcommands */}
                {subCmds.length > 0 && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.foreground + "60" }}>
                            <Code className="w-3 h-3" />
                            <span>Subcommands</span>
                            <span className="px-1 rounded text-[9px]" style={{ background: colors.foreground + "15" }}>
                                {subCmds.length}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            {subCmds.map((sub, i) => (
                                <div
                                    key={i}
                                    className="px-2 py-1 rounded text-[10px] space-y-0.5"
                                    style={{ background: colors.foreground + "06" }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <code className="font-mono font-bold" style={{ color: colors.green }}>
                                            {data.name} {sub.name}
                                        </code>
                                    </div>
                                    <p style={{ color: colors.foreground + "70" }}>{sub.description}</p>
                                    {sub.examples && sub.examples.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                            {sub.examples.slice(0, 3).map((ex, j) => (
                                                <code
                                                    key={j}
                                                    className="px-1 py-0.5 rounded text-[9px] font-mono"
                                                    style={{ background: colors.foreground + "10", color: colors.foreground + "60" }}
                                                >
                                                    {ex}
                                                </code>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {totalEntries === 0 && (
                    <div className="text-center py-6 text-xs" style={{ color: colors.foreground + "50" }}>
                        No options or subcommands found.
                    </div>
                )}
            </div>
        </div>
    );
}

function PreviewHeader({ fileName, colors, onBack }: { fileName: string; colors: any; onBack: () => void }) {
    return (
        <div className="px-3 pt-3 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${colors.foreground}10` }}>
            <button onClick={onBack} className="p-0.5 rounded hover:opacity-70 transition-opacity">
                <ArrowLeft className="w-4 h-4" style={{ color: colors.foreground + "70" }} />
            </button>
            <FileText className="w-3.5 h-3.5" style={{ color: colors.cyan }} />
            <span className="text-xs font-medium truncate" style={{ color: colors.foreground }}>
                {fileName}
            </span>
        </div>
    );
}
