/**
 * @module editor/plugins/builtin/npm-manager
 *
 * Visual NPM Package Manager plugin — inspired by npmdex / npm-visual-manager.
 *
 * Provides a right-side panel that parses `package.json` from the current
 * editor content (or from the detected project) and displays:
 *   - Dependencies tree (with version, description, latest version)
 *   - DevDependencies tree
 *   - Quick actions: open npmjs, copy install command, bump version
 *   - Search & add packages (via npms.io public API)
 *   - Outdated visual indicators
 *
 * Works purely client-side — no backend required for read operations.
 * Write operations (add/remove/update) modify the editor content directly.
 */
import { createElement, useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

// ══════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════

interface PackageEntry {
    name: string;
    version: string;
    isDev: boolean;
}

interface NpmSearchResult {
    name: string;
    version: string;
    description: string;
    date: string;
}

type TabId = "deps" | "search";

// ══════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════

function parsePackageJson(content: string): {
    deps: PackageEntry[];
    devDeps: PackageEntry[];
    raw: Record<string, unknown> | null;
} {
    try {
        const parsed = JSON.parse(content);
        const deps: PackageEntry[] = Object.entries(parsed.dependencies ?? {}).map(
            ([name, version]) => ({ name, version: String(version), isDev: false }),
        );
        const devDeps: PackageEntry[] = Object.entries(parsed.devDependencies ?? {}).map(
            ([name, version]) => ({ name, version: String(version), isDev: true }),
        );
        return { deps, devDeps, raw: parsed };
    } catch {
        return { deps: [], devDeps: [], raw: null };
    }
}

function isPackageJson(fileName: string): boolean {
    return /package\.json$/i.test(fileName);
}

/** Update the status-bar annotation (hidden in canvas, shown in PluginStatusBar) */
function updateStatusAnnotation(api: ExtendedPluginAPI) {
    const { fileName } = api.getFileInfo();
    if (!isPackageJson(fileName)) {
        api.clearInlineAnnotations("npm-manager");
        return;
    }
    const content = api.getContent();
    const { deps, devDeps, raw } = parsePackageJson(content);
    const total = deps.length + devDeps.length;
    const name = (raw as any)?.name ?? "package.json";
    const text = `📦 ${name}: ${total} deps (${deps.length} prod, ${devDeps.length} dev)`;
    const ann: InlineAnnotation[] = [{
        id: "npm-manager:status",
        line: 1,
        text,
        style: { display: "none" },
    }];
    api.setInlineAnnotations(ann);
}

function versionBadgeColor(version: string): string {
    if (version.startsWith("^")) return "#50fa7b";  // compatible
    if (version.startsWith("~")) return "#f1fa8c";  // patch-only
    if (version.includes("*") || version === "latest") return "#ff5555"; // wild
    return "#8be9fd"; // pinned
}

// ══════════════════════════════════════════════════════════════
//  Panel Component
// ══════════════════════════════════════════════════════════════

function NpmManagerPanel({ api }: { api: ExtendedPluginAPI }) {
    const content = api.getContent();
    const { fileName } = api.getFileInfo();

    const [tab, setTab] = useState<TabId>("deps");
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<NpmSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [expandedDev, setExpandedDev] = useState(true);
    const [expandedProd, setExpandedProd] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);

    const isPkg = isPackageJson(fileName);
    const { deps, devDeps, raw } = useMemo(
        () => (isPkg ? parsePackageJson(content) : { deps: [], devDeps: [], raw: null }),
        [content, isPkg],
    );

    // ── Search via npms.io ────────────────────────────────
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const doSearch = useCallback((q: string) => {
        if (!q.trim()) { setSearchResults([]); return; }
        setSearching(true);
        fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=15`)
            .then((r) => r.json())
            .then((data) => {
                const results: NpmSearchResult[] = (data.objects ?? []).map((o: any) => ({
                    name: o.package?.name ?? "",
                    version: o.package?.version ?? "",
                    description: o.package?.description ?? "",
                    date: o.package?.date ?? "",
                }));
                setSearchResults(results);
            })
            .catch(() => setSearchResults([]))
            .finally(() => setSearching(false));
    }, []);

    useEffect(() => {
        if (tab !== "search") return;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => doSearch(search), 400);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [search, tab, doSearch]);

    // ── Actions ───────────────────────────────────────────
    const copyText = useCallback((text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(label);
            setTimeout(() => setCopied(null), 1500);
        });
    }, []);

    const addPackage = useCallback((name: string, version: string, dev: boolean) => {
        if (!raw || !isPkg) return;
        const pkg = { ...raw } as Record<string, any>;
        const key = dev ? "devDependencies" : "dependencies";
        pkg[key] = { ...(pkg[key] ?? {}), [name]: `^${version}` };
        // Sort keys
        pkg[key] = Object.fromEntries(
            Object.entries(pkg[key]).sort(([a], [b]) => a.localeCompare(b)),
        );
        api.setContent(JSON.stringify(pkg, null, 2) + "\n");
        api.showToast("NPM Manager", `Added ${name}@^${version} to ${key}`, "success");
    }, [raw, isPkg, api]);

    const removePackage = useCallback((name: string, dev: boolean) => {
        if (!raw || !isPkg) return;
        const pkg = { ...raw } as Record<string, any>;
        const key = dev ? "devDependencies" : "dependencies";
        if (pkg[key]) {
            const entries = { ...pkg[key] };
            delete entries[name];
            pkg[key] = entries;
            if (Object.keys(pkg[key]).length === 0) delete pkg[key];
        }
        api.setContent(JSON.stringify(pkg, null, 2) + "\n");
        api.showToast("NPM Manager", `Removed ${name} from ${key}`, "success");
    }, [raw, isPkg, api]);

    // ── Styles ────────────────────────────────────────────
    const S = {
        root: { height: "100%", display: "flex", flexDirection: "column" as const, fontSize: "12px", color: "var(--editor-foreground, #f8f8f2)" },
        tabs: { display: "flex", gap: 0, borderBottom: "1px solid var(--editor-border, #44475a)", flexShrink: 0 },
        tab: (active: boolean) => ({
            flex: 1, padding: "6px 0", textAlign: "center" as const, cursor: "pointer", fontSize: "11px", fontWeight: active ? 600 : 400,
            color: active ? "var(--editor-accent, #bd93f9)" : "var(--editor-muted, #6272a4)",
            borderBottom: active ? "2px solid var(--editor-accent, #bd93f9)" : "2px solid transparent",
            background: "transparent", border: "none", transition: "all 0.15s",
        }),
        body: { flex: 1, overflow: "auto", padding: "0" },
        section: { borderBottom: "1px solid var(--editor-border, #44475a)" },
        sectionHeader: (expanded: boolean) => ({
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", cursor: "pointer",
            fontSize: "11px", fontWeight: 600, color: "var(--editor-foreground, #f8f8f2)",
            background: expanded ? "rgba(255,255,255,0.02)" : "transparent",
            userSelect: "none" as const, transition: "background 0.1s",
        }),
        chevron: (expanded: boolean) => ({
            fontSize: "8px", display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s", color: "var(--editor-muted, #6272a4)",
        }),
        pkgRow: {
            display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px 4px 20px",
            transition: "background 0.1s", cursor: "default",
        },
        pkgName: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
        badge: (color: string) => ({
            fontSize: "10px", padding: "1px 5px", borderRadius: "3px",
            background: `${color}18`, color, border: `1px solid ${color}33`,
            fontFamily: "var(--editor-font-family, monospace)", whiteSpace: "nowrap" as const,
        }),
        iconBtn: {
            background: "transparent", border: "none", cursor: "pointer", padding: "2px",
            color: "var(--editor-muted, #6272a4)", fontSize: "12px", lineHeight: 1,
            transition: "color 0.15s", borderRadius: "3px", display: "inline-flex",
            alignItems: "center", justifyContent: "center",
        },
        searchInput: {
            width: "100%", padding: "6px 10px", border: "none", fontSize: "12px",
            borderBottom: "1px solid var(--editor-border, #44475a)",
            background: "var(--editor-bg, #282a36)", color: "var(--editor-foreground, #f8f8f2)",
            outline: "none",
        },
        empty: { padding: "20px 10px", textAlign: "center" as const, color: "var(--editor-muted, #6272a4)", fontSize: "11px" },
        resultRow: {
            padding: "8px 10px", borderBottom: "1px solid var(--editor-border, #44475a)22",
            transition: "background 0.1s",
        },
        resultName: { fontWeight: 600, fontSize: "12px" },
        resultDesc: { fontSize: "10px", color: "var(--editor-muted, #6272a4)", marginTop: "2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const },
        resultActions: { display: "flex", gap: "6px", marginTop: "4px", alignItems: "center" },
        actionBtn: (color: string) => ({
            background: `${color}18`, border: `1px solid ${color}33`, borderRadius: "4px",
            padding: "2px 8px", cursor: "pointer", color, fontSize: "10px", fontWeight: 500,
            transition: "all 0.15s", lineHeight: "16px",
        }),
    };

    // ── Not package.json ──────────────────────────────────
    if (!isPkg) {
        return createElement("div", { style: S.root },
            createElement("div", { style: S.empty },
                createElement("div", { style: { fontSize: "24px", marginBottom: "8px" } }, "📦"),
                createElement("div", null, "Open a package.json file to manage dependencies"),
                createElement("div", { style: { marginTop: "8px", fontSize: "10px" } }, "Or switch to the Search tab to browse npm packages"),
            ),
            createElement("div", { style: S.tabs },
                createElement("button", { style: S.tab(tab === "search"), onClick: () => setTab("search") }, "🔍 Search"),
            ),
            tab === "search" && createElement("div", { style: { flex: 1, overflow: "auto" } },
                createElement("input", {
                    style: S.searchInput, placeholder: "Search npm packages...",
                    value: search, onChange: (e: any) => setSearch(e.target.value), autoFocus: true,
                }),
                renderSearchResults(),
            ),
        );
    }

    // ── Render helpers ────────────────────────────────────
    function renderPkgRow(pkg: PackageEntry) {
        const color = versionBadgeColor(pkg.version);
        return createElement("div", {
            key: `${pkg.isDev ? "dev" : "prod"}:${pkg.name}`,
            style: S.pkgRow,
            className: "npm-pkg-row",
        },
            createElement("span", { style: S.pkgName, title: pkg.name }, pkg.name),
            createElement("span", { style: S.badge(color), title: pkg.version }, pkg.version),
            createElement("button", {
                style: S.iconBtn, title: `Copy: npm install ${pkg.name}`,
                onClick: () => copyText(`npm install ${pkg.isDev ? "-D " : ""}${pkg.name}`, pkg.name),
            }, copied === pkg.name ? "✓" : "📋"),
            createElement("button", {
                style: S.iconBtn, title: "Open on npmjs.com",
                onClick: () => window.open(`https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`, "_blank"),
            }, "🔗"),
            createElement("button", {
                style: { ...S.iconBtn, color: "#ff5555" }, title: `Remove ${pkg.name}`,
                onClick: () => removePackage(pkg.name, pkg.isDev),
            }, "✕"),
        );
    }

    function renderSearchResults() {
        if (searching) {
            return createElement("div", { style: S.empty }, "Searching...");
        }
        if (search && searchResults.length === 0) {
            return createElement("div", { style: S.empty }, "No packages found");
        }
        if (!search) {
            return createElement("div", { style: S.empty }, "Type to search npm packages");
        }
        return searchResults.map((r) =>
            createElement("div", {
                key: r.name, style: S.resultRow, className: "npm-search-row",
            },
                createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
                    createElement("span", { style: S.resultName }, r.name),
                    createElement("span", { style: S.badge("#8be9fd") }, r.version),
                ),
                r.description && createElement("div", { style: S.resultDesc }, r.description),
                createElement("div", { style: S.resultActions },
                    isPkg && createElement("button", {
                        style: S.actionBtn("#50fa7b"),
                        onClick: () => addPackage(r.name, r.version, false),
                    }, "+ Add"),
                    isPkg && createElement("button", {
                        style: S.actionBtn("#f1fa8c"),
                        onClick: () => addPackage(r.name, r.version, true),
                    }, "+ Dev"),
                    createElement("button", {
                        style: S.actionBtn("#8be9fd"),
                        onClick: () => copyText(`npm install ${r.name}`, r.name),
                    }, copied === r.name ? "Copied!" : "📋 Copy"),
                    createElement("button", {
                        style: S.actionBtn("#bd93f9"),
                        onClick: () => window.open(`https://www.npmjs.com/package/${encodeURIComponent(r.name)}`, "_blank"),
                    }, "🔗 npm"),
                ),
            ),
        );
    }

    // ── Main layout ───────────────────────────────────────
    return createElement("div", { style: S.root },

        // Tabs
        createElement("div", { style: S.tabs },
            createElement("button", { style: S.tab(tab === "deps"), onClick: () => setTab("deps") },
                `📦 Packages (${deps.length + devDeps.length})`),
            createElement("button", { style: S.tab(tab === "search"), onClick: () => setTab("search") },
                "🔍 Search"),
        ),

        // Body
        createElement("div", { style: S.body },
            tab === "deps" && createElement("div", null,
                // Production dependencies
                createElement("div", { style: S.section },
                    createElement("div", {
                        style: S.sectionHeader(expandedProd),
                        onClick: () => setExpandedProd(!expandedProd),
                    },
                        createElement("span", { style: S.chevron(expandedProd) }, "▶"),
                        `dependencies (${deps.length})`,
                    ),
                    expandedProd && (deps.length > 0
                        ? deps.map(renderPkgRow)
                        : createElement("div", { style: { ...S.empty, padding: "8px 10px" } }, "No dependencies")
                    ),
                ),

                // Dev dependencies
                createElement("div", { style: S.section },
                    createElement("div", {
                        style: S.sectionHeader(expandedDev),
                        onClick: () => setExpandedDev(!expandedDev),
                    },
                        createElement("span", { style: S.chevron(expandedDev) }, "▶"),
                        `devDependencies (${devDeps.length})`,
                    ),
                    expandedDev && (devDeps.length > 0
                        ? devDeps.map(renderPkgRow)
                        : createElement("div", { style: { ...S.empty, padding: "8px 10px" } }, "No devDependencies")
                    ),
                ),

                // Summary
                createElement("div", {
                    style: { padding: "10px", fontSize: "10px", color: "var(--editor-muted, #6272a4)", display: "flex", gap: "12px" },
                },
                    createElement("span", null, `Total: ${deps.length + devDeps.length}`),
                    raw && (raw as any).name && createElement("span", null, `📦 ${(raw as any).name}`),
                    raw && (raw as any).version && createElement("span", null, `v${(raw as any).version}`),
                ),
            ),

            tab === "search" && createElement("div", { style: { display: "flex", flexDirection: "column" as const, height: "100%" } },
                createElement("input", {
                    style: S.searchInput, placeholder: "Search npm packages...",
                    value: search, onChange: (e: any) => setSearch(e.target.value), autoFocus: true,
                }),
                createElement("div", { style: { flex: 1, overflow: "auto" } },
                    renderSearchResults(),
                ),
            ),
        ),

        // Hover CSS for rows
        createElement("style", null, `
            .npm-pkg-row:hover { background: rgba(255,255,255,0.03); }
            .npm-search-row:hover { background: rgba(255,255,255,0.03); }
        `),
    );
}

// ══════════════════════════════════════════════════════════════
//  Plugin factory
// ══════════════════════════════════════════════════════════════

export function createNpmManagerPlugin(): ExtendedEditorPlugin {
    let autoOpened = false;

    return {
        id: "npm-manager",
        name: "NPM Package Manager",
        version: "1.0.0",
        description: "Visual NPM package manager — browse, add, remove, and search packages",
        category: "tools",
        defaultEnabled: true,

        // Context menu item — shown when file is package.json
        contextMenuItems: [
            {
                label: "📦 NPM Package Manager",
                shortcut: "Ctrl+Shift+N",
                action: () => { /* replaced at onActivate */ },
                priority: 90,
                separator: true,
            },
        ],

        panels: [
            {
                id: "npm-manager:panel",
                title: "📦 NPM Packages",
                position: "right",
                defaultSize: 340,
                render: (api) => createElement(NpmManagerPanel, { api }),
            },
        ],

        onActivate(api) {
            const toggle = () => api.togglePanel("npm-manager:panel");

            // Wire context menu item action
            if (this.contextMenuItems?.[0]) {
                this.contextMenuItems[0].action = toggle;
            }

            api.registerCommand("npmManager.toggle", toggle);
            api.registerKeybinding({
                id: "npm-manager:toggle",
                label: "Toggle NPM Manager",
                keys: "Ctrl+Shift+N",
                handler: (e) => { e.preventDefault(); toggle(); },
                when: "editor",
                category: "Tools",
            });

            // Auto-open panel if current file is package.json
            const { fileName } = api.getFileInfo();
            if (isPackageJson(fileName) && !autoOpened) {
                autoOpened = true;
                api.togglePanel("npm-manager:panel");
            }

            // Update status bar annotation
            updateStatusAnnotation(api);
        },

        onContentChange(_content, api) {
            updateStatusAnnotation(api);
        },

        onLanguageChange(_language, api) {
            // Re-check when file changes (language change often means file switch)
            const { fileName } = api.getFileInfo();
            if (isPackageJson(fileName) && !api.isPanelOpen("npm-manager:panel")) {
                api.togglePanel("npm-manager:panel");
            }
            updateStatusAnnotation(api);
        },

        onDeactivate(api) {
            api.clearInlineAnnotations("npm-manager");
            autoOpened = false;
        },
    };
}
