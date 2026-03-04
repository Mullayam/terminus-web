/**
 * @module components/ContextEnginePanel
 *
 * VS Code-style panel for the editor right sidebar.
 * Two sections:
 *   1. Language Packs — browse available languages from @enjoys/context-engine,
 *      install completions/definitions/hover into IndexedDB.
 *   2. Terminal Commands — grouped command categories, install CLI completions.
 *
 * Theme-compatible: uses CSS variables and shadcn color tokens.
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    Search,
    Download,
    Trash2,
    ChevronDown,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Package,
    Terminal,
    FileCode2,
    RefreshCw,
    Languages,
    FolderOpen,
    Sparkles,
} from "lucide-react";
import {
    fetchLanguageManifest,
    fetchTerminalCommandsManifest,
    fetchLanguageData,
    fetchCommandFiles,
    type ManifestLanguage,
    type TerminalCommandContext,
} from "@/lib/context-engine/contextEngineApi";
import {
    saveLanguagePack,
    removeLanguagePack,
    getInstalledLanguages,
    isLanguageInstalled,
    saveCommandCategory,
    removeCommandCategory,
    getInstalledCategories,
    isCategoryInstalled,
    getCommandDataForCategory,
    type ContextLanguagePack,
    type ContextCommandCategory,
} from "@/lib/context-engine/contextEngineStorage";
import {
    registerContextEngineForLanguage,
    disposeContextEngineProviders,
    registerContextEngineProviders,
} from "../lib/contextEngineProviders";
import * as monaco from "monaco-editor";

/* ── Types ─────────────────────────────────────────────────── */

type Tab = "languages" | "commands";
type LangInstallState = Record<string, "installing" | "installed" | "error">;
type CmdInstallState = Record<string, "installing" | "installed" | "error">;

/* ── Component ─────────────────────────────────────────────── */

export function ContextEnginePanel() {
    const [tab, setTab] = useState<Tab>("languages");
    const [search, setSearch] = useState("");

    return (
        <div className="flex flex-col h-full text-[13px]">
            {/* ── Header ── */}
            <div
                className="flex items-center gap-2 px-3 py-2 shrink-0 border-b"
                style={{ borderColor: "var(--editor-border, hsl(var(--border)))" }}
            >
                <Package className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Context Engine</span>
            </div>

            {/* ── Tab bar ── */}
            <div
                className="flex shrink-0 border-b"
                style={{ borderColor: "var(--editor-border, hsl(var(--border)))" }}
            >
                <TabButton active={tab === "languages"} onClick={() => setTab("languages")}>
                    <Languages className="w-3.5 h-3.5" /> Languages
                </TabButton>
                <TabButton active={tab === "commands"} onClick={() => setTab("commands")}>
                    <Terminal className="w-3.5 h-3.5" /> Terminal
                </TabButton>
            </div>

            {/* ── Search ── */}
            <div className="px-2 py-1.5 shrink-0">
                <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                    style={{
                        background: "var(--editor-input-bg, hsl(var(--muted)))",
                        border: "1px solid var(--editor-border, hsl(var(--border)))",
                    }}
                >
                    <Search className="w-3 h-3 text-muted-foreground" />
                    <input
                        className="bg-transparent outline-none flex-1 text-xs placeholder:text-muted-foreground"
                        placeholder={tab === "languages" ? "Search languages…" : "Search commands…"}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {tab === "languages" ? (
                    <LanguagePacksTab search={search} />
                ) : (
                    <TerminalCommandsTab search={search} />
                )}
            </div>
        </div>
    );
}

/* ── Tab Button ────────────────────────────────────────────── */

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
        >
            {children}
        </button>
    );
}

/* ══════════════════════════════════════════════════════════════
   Language Packs Tab
   ══════════════════════════════════════════════════════════════ */

function LanguagePacksTab({ search }: { search: string }) {
    const [manifest, setManifest] = useState<ManifestLanguage[]>([]);
    const [installed, setInstalled] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installState, setInstallState] = useState<LangInstallState>({});

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [manifestData, installedPacks] = await Promise.all([
                fetchLanguageManifest(),
                getInstalledLanguages(),
            ]);
            setManifest(manifestData.languages);
            setInstalled(new Set(installedPacks.map((p) => p.id)));

            // Pre-populate install state for installed ones
            const state: LangInstallState = {};
            installedPacks.forEach((p) => { state[p.id] = "installed"; });
            setInstallState(state);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load manifest");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleInstall = useCallback(async (lang: ManifestLanguage) => {
        setInstallState((s) => ({ ...s, [lang.id]: "installing" }));
        try {
            const data = await fetchLanguageData(lang);
            await saveLanguagePack(lang.id, lang.name, data.completion, data.defination, data.hover);
            setInstalled((s) => new Set(s).add(lang.id));
            setInstallState((s) => ({ ...s, [lang.id]: "installed" }));
            // Register Monaco providers immediately for the new language
            registerContextEngineForLanguage(monaco, lang.id).catch(() => {});
        } catch {
            setInstallState((s) => ({ ...s, [lang.id]: "error" }));
        }
    }, []);

    const handleUninstall = useCallback(async (id: string) => {
        await removeLanguagePack(id);
        setInstalled((s) => { const n = new Set(s); n.delete(id); return n; });
        setInstallState((s) => { const n = { ...s }; delete n[id]; return n; });
        // Re-register all remaining providers (dispose old ones first)
        disposeContextEngineProviders();
        registerContextEngineProviders(monaco).catch(() => {});
    }, []);

    const filtered = search
        ? manifest.filter(
              (l) =>
                  l.name.toLowerCase().includes(search.toLowerCase()) ||
                  l.id.toLowerCase().includes(search.toLowerCase()),
          )
        : manifest;

    const installedLangs = filtered.filter((l) => installed.has(l.id));
    const availableLangs = filtered.filter((l) => !installed.has(l.id));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center space-y-2">
                <p className="text-xs text-destructive">{error}</p>
                <button
                    className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                    onClick={loadData}
                >
                    <RefreshCw className="w-3 h-3" /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="px-1 pb-2">
            {/* Installed section */}
            {installedLangs.length > 0 && (
                <Section title="Installed" count={installedLangs.length}>
                    {installedLangs.map((lang) => (
                        <LangRow
                            key={lang.id}
                            lang={lang}
                            state={installState[lang.id]}
                            isInstalled
                            onInstall={handleInstall}
                            onUninstall={handleUninstall}
                        />
                    ))}
                </Section>
            )}

            {/* Available section */}
            <Section title="Available" count={availableLangs.length} defaultOpen>
                {availableLangs.map((lang) => (
                    <LangRow
                        key={lang.id}
                        lang={lang}
                        state={installState[lang.id]}
                        isInstalled={false}
                        onInstall={handleInstall}
                        onUninstall={handleUninstall}
                    />
                ))}
                {availableLangs.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-2 py-3 text-center">
                        {search ? "No matching languages" : "All languages installed!"}
                    </p>
                )}
            </Section>

            {/* Info */}
            <div className="mt-3 px-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Language packs provide completions, definitions & hover info for the editor.
                    Powered by{" "}
                    <span className="text-primary">@enjoys/context-engine</span>.
                </p>
            </div>
        </div>
    );
}

/* ── Language Row ──────────────────────────────────────────── */

function LangRow({
    lang,
    state,
    isInstalled,
    onInstall,
    onUninstall,
}: {
    lang: ManifestLanguage;
    state?: string;
    isInstalled: boolean;
    onInstall: (lang: ManifestLanguage) => void;
    onUninstall: (id: string) => void;
}) {
    const installing = state === "installing";

    return (
        <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group"
        >
            <FileCode2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{lang.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{lang.id}</p>
            </div>
            {isInstalled ? (
                <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onUninstall(lang.id)}
                        title="Uninstall"
                    >
                        <Trash2 className="w-3 h-3 text-destructive hover:text-destructive/80" />
                    </button>
                </div>
            ) : (
                <button
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    onClick={() => onInstall(lang)}
                    disabled={installing}
                >
                    {installing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <Download className="w-3 h-3" />
                    )}
                    {installing ? "…" : "Install"}
                </button>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   Terminal Commands Tab
   ══════════════════════════════════════════════════════════════ */

function TerminalCommandsTab({ search }: { search: string }) {
    const [categories, setCategories] = useState<TerminalCommandContext[]>([]);
    const [installedCats, setInstalledCats] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installState, setInstallState] = useState<CmdInstallState>({});
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

            const state: CmdInstallState = {};
            installedList.forEach((c) => { state[c.id] = "installed"; });
            setInstallState(state);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load manifest");
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center space-y-2">
                <p className="text-xs text-destructive">{error}</p>
                <button
                    className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                    onClick={loadData}
                >
                    <RefreshCw className="w-3 h-3" /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="px-1 pb-2">
            {filtered.map((cat) => {
                const isExpanded = expanded.has(cat.category);
                const isInst = installedCats.has(cat.category);
                const state = installState[cat.category];
                const installing = state === "installing";

                return (
                    <div
                        key={cat.category}
                        className="mb-1 rounded-md overflow-hidden border border-transparent hover:border-border/40 transition-colors"
                    >
                        {/* Category header */}
                        <div
                            className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleExpand(cat.category)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                            ) : (
                                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-xs flex-1 font-medium truncate">{cat.category}</span>
                            {isInst ? (
                                <div className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    <button
                                        className="opacity-60 hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); handleUninstall(cat.category); }}
                                        title="Uninstall"
                                    >
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                    onClick={(e) => { e.stopPropagation(); handleInstall(cat); }}
                                    disabled={installing}
                                >
                                    {installing ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Download className="w-3 h-3" />
                                    )}
                                    {installing ? "…" : "Install"}
                                </button>
                            )}
                        </div>

                        {/* Expanded: context & files */}
                        {isExpanded && (
                            <div className="px-3 pb-2 space-y-2">
                                {/* Context chips */}
                                <div className="flex flex-wrap gap-1">
                                    {cat.context.map((ctx, i) => (
                                        <span
                                            key={i}
                                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                                        >
                                            {ctx}
                                        </span>
                                    ))}
                                </div>

                                {/* Files list */}
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                        <FolderOpen className="w-3 h-3" /> Files ({cat.files.length})
                                    </p>
                                    <div className="pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                                        {cat.files.map((f) => (
                                            <p key={f} className="text-[10px] text-muted-foreground font-mono truncate">
                                                {f}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {filtered.length === 0 && (
                <p className="text-[11px] text-muted-foreground px-2 py-6 text-center">
                    {search ? "No matching command categories" : "No categories available"}
                </p>
            )}

            {/* Info */}
            <div className="mt-3 px-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Terminal command packs provide shell completions & suggestions.
                    Commands are stored locally and used for ghost-text suggestions.
                </p>
            </div>
        </div>
    );
}

/* ── Collapsible Section ───────────────────────────────────── */

function Section({
    title,
    count,
    defaultOpen = true,
    children,
}: {
    title: string;
    count: number;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="mb-2">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
                {open ? (
                    <ChevronDown className="w-3 h-3" />
                ) : (
                    <ChevronRight className="w-3 h-3" />
                )}
                {title}
                <span className="ml-auto text-[10px] font-normal">{count}</span>
            </button>
            {open && <div>{children}</div>}
        </div>
    );
}
