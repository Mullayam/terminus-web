/**
 * @module ssh-v/components/terminal2/commandPacks
 *
 * Independent context-engine command installer for the SSH terminal sidebar.
 * Lets users browse and install CLI command packs from @enjoys/context-engine
 * for ghost-text suggestions in the SSH terminal.
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
    FolderOpen,
} from "lucide-react";
import {
    fetchTerminalCommandsManifest,
    fetchCommandFiles,
    type TerminalCommandContext,
} from "@/lib/context-engine/contextEngineApi";
import {
    saveCommandCategory,
    removeCommandCategory,
    getInstalledCategories,
} from "@/lib/context-engine/contextEngineStorage";
import { useSessionTheme } from "@/hooks/useSessionTheme";

/* ── Types ─────────────────────────────────────────────────── */

type InstallState = Record<string, "installing" | "installed" | "error">;

/* ── Component ─────────────────────────────────────────────── */

export default function CommandPacks() {
    const { colors } = useSessionTheme();
    const [categories, setCategories] = useState<TerminalCommandContext[]>([]);
    const [installedCats, setInstalledCats] = useState<Set<string>>(new Set());
    const [installState, setInstallState] = useState<InstallState>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [manifest, installedList] = await Promise.all([
                fetchTerminalCommandsManifest(),
                getInstalledCategories(),
            ]);
            setCategories(manifest.context);
            setInstalledCats(new Set(installedList.map((c) => c.id)));
            const state: InstallState = {};
            installedList.forEach((c) => { state[c.id] = "installed"; });
            setInstallState(state);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load command packs");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

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
            setInstalledCats((s) => new Set(s).add(cat.category));
            setInstallState((s) => ({ ...s, [cat.category]: "installed" }));
        } catch {
            setInstallState((s) => ({ ...s, [cat.category]: "error" }));
        }
    }, []);

    const handleUninstall = useCallback(async (id: string) => {
        await removeCommandCategory(id);
        setInstalledCats((s) => { const n = new Set(s); n.delete(id); return n; });
        setInstallState((s) => { const n = { ...s }; delete n[id]; return n; });
    }, []);

    const toggleExpand = useCallback((id: string) => {
        setExpanded((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    }, []);

    const filtered = search
        ? categories.filter(
              (c) =>
                  c.category.toLowerCase().includes(search.toLowerCase()) ||
                  c.context.some((ctx) => ctx.toLowerCase().includes(search.toLowerCase())),
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

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 pt-3 pb-2 space-y-2">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" style={{ color: colors.cyan }} />
                    <span className="text-sm font-semibold" style={{ color: colors.foreground }}>
                        Command Packs
                    </span>
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

function CategoryCard({ cat, state, isExpanded, onToggleExpand, onInstall, onUninstall, colors }: {
    cat: TerminalCommandContext;
    state?: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onInstall: () => void;
    onUninstall: () => void;
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

                    {/* File list */}
                    <div className="space-y-0.5">
                        {cat.files.map((file, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: colors.foreground + "60" }}>
                                <FolderOpen className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{file}</span>
                            </div>
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
