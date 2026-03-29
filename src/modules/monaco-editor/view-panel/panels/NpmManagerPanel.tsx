/**
 * @module monaco-editor/view-panel/panels/NpmManagerPanel
 *
 * Visual NPM package manager panel — table layout inspired by npm-visual-manager.
 *
 * Columns: Package | Installed | Latest | Update type | Action (Uninstall / Update)
 * Top bar: filter, Check Updates, Update All (count)
 * Tabs:    Packages | Install (search) | Scripts
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Package, Search, Trash2, Plus, Copy, Play, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, ArrowUpCircle,
  Filter, X,
} from "lucide-react";
import type { ViewPanelProps } from "../types";

/* ── Types ─────────────────────────────────────────────────── */

interface DepEntry {
  name: string;
  version: string;
  type: "dependencies" | "devDependencies" | "peerDependencies";
  latest?: string;
}

interface NpmSearchResult {
  name: string;
  version: string;
  description: string;
  date: string;
  publisher?: string;
}

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/* ── Helpers ───────────────────────────────────────────────── */

function parsePackageJson(content: string): PackageJson | null {
  try { return JSON.parse(content); } catch { return null; }
}

function cleanVersion(v: string) { return v.replace(/^[\^~>=<*]/, ""); }

function updateType(current: string, latest: string): "MAJOR" | "MINOR" | "PATCH" | null {
  if (!latest) return null;
  const cur = cleanVersion(current).split(".");
  const lat = latest.split(".");
  if (cur[0] !== lat[0]) return "MAJOR";
  if (cur[1] !== lat[1]) return "MINOR";
  if (cur[2] !== lat[2]) return "PATCH";
  return null;
}

const updateColors: Record<string, { bg: string; fg: string }> = {
  MAJOR: { bg: "#f4474733", fg: "#f44747" },
  MINOR: { bg: "#cca63d33", fg: "#dcdcaa" },
  PATCH: { bg: "#4ec9b033", fg: "#4ec9b0" },
};

function VersionBadge({ version, color }: { version: string; color?: string }) {
  const c = color ?? "#569cd6";
  return (
    <span style={{
      background: c + "22", color: c, padding: "2px 8px", borderRadius: 3,
      fontSize: 11, fontFamily: "monospace", fontWeight: 600,
    }}>
      {version}
    </span>
  );
}

function UpdateTypeBadge({ type }: { type: string }) {
  const c = updateColors[type];
  if (!c) return null;
  return (
    <span style={{
      background: c.bg, color: c.fg, padding: "2px 8px", borderRadius: 3,
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {type}
    </span>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export function NpmManagerPanel({
  fileContent, filePath, onContentChange, onClose, onNotify,
}: ViewPanelProps) {
  const [activeTab, setActiveTab] = useState<"deps" | "search" | "scripts">("deps");
  const [filterText, setFilterText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NpmSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [deps, setDeps] = useState<DepEntry[]>([]);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const pkg = useMemo(() => fileContent ? parsePackageJson(fileContent) : null, [fileContent]);
  const isPackageJson = filePath?.endsWith("package.json") ?? false;

  // Build dep list
  useEffect(() => {
    if (!pkg) { setDeps([]); return; }
    const entries: DepEntry[] = [];
    const add = (obj: Record<string, string> | undefined, type: DepEntry["type"]) => {
      if (!obj) return;
      Object.entries(obj).forEach(([name, version]) => entries.push({ name, version, type }));
    };
    add(pkg.dependencies, "dependencies");
    add(pkg.devDependencies, "devDependencies");
    add(pkg.peerDependencies, "peerDependencies");
    setDeps(entries);
  }, [pkg]);

  // Fetch latest versions
  const fetchLatestVersions = useCallback(async () => {
    if (deps.length === 0) return;
    setFetchingLatest(true);
    const updated = [...deps];
    const batch = 8;
    for (let i = 0; i < updated.length; i += batch) {
      await Promise.all(
        updated.slice(i, i + batch).map(async (dep) => {
          try {
            const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(dep.name)}/latest`);
            if (res.ok) dep.latest = (await res.json()).version;
          } catch { /* */ }
        }),
      );
    }
    setDeps([...updated]);
    setFetchingLatest(false);
  }, [deps]);

  // Auto-fetch on first load
  const didFetchRef = useRef(false);
  useEffect(() => {
    if (deps.length > 0 && !didFetchRef.current) {
      didFetchRef.current = true;
      fetchLatestVersions();
    }
  }, [deps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search npm
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=20`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults((data.objects ?? []).map((o: any) => ({
          name: o.package.name, version: o.package.version,
          description: o.package.description ?? "", date: o.package.date ?? "",
          publisher: o.package.publisher?.username ?? "",
        })));
      }
    } catch { onNotify?.("Failed to search npm registry", "error"); }
    finally { setSearching(false); }
  }, [onNotify]);

  const onSearchInput = useCallback((v: string) => {
    setSearchQuery(v);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(v), 400);
  }, [doSearch]);

  // Package.json mutations
  const addPackage = useCallback((name: string, version: string, isDev: boolean) => {
    if (!fileContent) return;
    try {
      const json = JSON.parse(fileContent);
      const key = isDev ? "devDependencies" : "dependencies";
      if (!json[key]) json[key] = {};
      json[key][name] = `^${version}`;
      json[key] = Object.fromEntries(Object.entries(json[key]).sort(([a], [b]) => a.localeCompare(b)));
      onContentChange?.(JSON.stringify(json, null, 2) + "\n");
      onNotify?.(`Added ${name}@${version} to ${key}`, "success");
    } catch { onNotify?.("Failed to update package.json", "error"); }
  }, [fileContent, onContentChange, onNotify]);

  const removePackage = useCallback((name: string, type: string) => {
    if (!fileContent) return;
    try {
      const json = JSON.parse(fileContent);
      if (json[type]?.[name]) { delete json[type][name]; if (Object.keys(json[type]).length === 0) delete json[type]; }
      onContentChange?.(JSON.stringify(json, null, 2) + "\n");
      onNotify?.(`Removed ${name}`, "success");
    } catch { onNotify?.("Failed to update package.json", "error"); }
  }, [fileContent, onContentChange, onNotify]);

  const updatePkg = useCallback((name: string, type: string, newVer: string) => {
    if (!fileContent) return;
    try {
      const json = JSON.parse(fileContent);
      if (json[type]?.[name]) json[type][name] = `^${newVer}`;
      onContentChange?.(JSON.stringify(json, null, 2) + "\n");
      onNotify?.(`Updated ${name} → ^${newVer}`, "success");
    } catch { onNotify?.("Failed to update package.json", "error"); }
  }, [fileContent, onContentChange, onNotify]);

  const updateAll = useCallback(() => {
    if (!fileContent) return;
    try {
      const json = JSON.parse(fileContent);
      let count = 0;
      for (const dep of deps) {
        if (!dep.latest) continue;
        const ut = updateType(dep.version, dep.latest);
        if (!ut) continue;
        if (json[dep.type]?.[dep.name]) { json[dep.type][dep.name] = `^${dep.latest}`; count++; }
      }
      if (count === 0) { onNotify?.("All packages are up to date", "success"); return; }
      onContentChange?.(JSON.stringify(json, null, 2) + "\n");
      onNotify?.(`Updated ${count} package${count > 1 ? "s" : ""}`, "success");
    } catch { onNotify?.("Failed to update package.json", "error"); }
  }, [fileContent, deps, onContentChange, onNotify]);

  // Derived
  const scripts = useMemo(() => pkg?.scripts ? Object.entries(pkg.scripts).map(([n, c]) => ({ name: n, cmd: c })) : [], [pkg]);
  const updatableCount = useMemo(() => deps.filter((d) => d.latest && updateType(d.version, d.latest)).length, [deps]);

  const filteredDeps = useMemo(() => {
    let list = deps;
    if (filterText) list = list.filter((d) => d.name.toLowerCase().includes(filterText.toLowerCase()));
    if (!showAll) list = list.filter((d) => d.latest && updateType(d.version, d.latest));
    return list;
  }, [deps, filterText, showAll]);

  const depGroups = useMemo(() => {
    const g: Record<string, DepEntry[]> = {};
    filteredDeps.forEach((d) => { if (!g[d.type]) g[d.type] = []; g[d.type].push(d); });
    return g;
  }, [filteredDeps]);

  const toggleType = useCallback((t: string) => {
    setCollapsedTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }, []);

  /* ── No package.json ─────────────────────────────────────── */
  if (!isPackageJson || !pkg) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
        <Package className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium" style={{ color: "var(--editor-fg)" }}>No package.json detected</p>
        <p className="text-xs" style={{ color: "var(--editor-muted, #888)" }}>
          Open a <code className="px-1 py-0.5 rounded" style={{ background: "var(--editor-sidebar-bg)" }}>package.json</code> file to use the NPM Package Manager.
        </p>
      </div>
    );
  }

  const typeLabel = (t: string) => t === "dependencies" ? "prod" : t === "devDependencies" ? "dev" : "peer";
  const typeBadgeColor = (t: string) => t === "dependencies" ? "#569cd6" : t === "devDependencies" ? "#dcdcaa" : "#c586c0";

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full" style={{ fontSize: 12, color: "var(--editor-fg, #ccc)" }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)", background: "var(--editor-sidebar-bg, #252526)" }}>
        <Package className="w-4 h-4 shrink-0" style={{ color: "var(--editor-accent)" }} />
        <span className="font-semibold text-[13px] truncate">{pkg.name ?? "package.json"}</span>
        {pkg.version && <VersionBadge version={`v${pkg.version}`} color="#888" />}
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none" style={{ color: "var(--editor-muted, #888)" }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)}
            style={{ accentColor: "var(--editor-accent, #569cd6)" }} />
          Show All Packages
        </label>
      </div>

      {/* ── Toolbar: filter + actions ─────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
        <div className="flex items-center flex-1 gap-2 px-2 py-1 rounded"
          style={{ background: "var(--editor-bg, #1e1e1e)", border: "1px solid var(--editor-border, #3c3c3c)" }}>
          <Filter className="w-3 h-3 shrink-0" style={{ color: "var(--editor-muted)" }} />
          <input type="text" placeholder="Filter packages…" value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ background: "transparent", border: "none", color: "var(--editor-fg)", fontSize: 12, outline: "none", flex: 1 }} />
          {filterText && (
            <button onClick={() => setFilterText("")}
              style={{ background: "none", border: "none", color: "var(--editor-muted)", cursor: "pointer" }}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={fetchLatestVersions} disabled={fetchingLatest}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium"
          style={{ background: "var(--editor-hover-bg, #2a2d2e)", border: "1px solid var(--editor-border, #3c3c3c)", color: "var(--editor-fg)", cursor: "pointer" }}>
          <RefreshCw className={`w-3 h-3 ${fetchingLatest ? "animate-spin" : ""}`} />
          {fetchingLatest ? "Checking…" : "Check Updates"}
        </button>
        {updatableCount > 0 && (
          <button onClick={updateAll}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold"
            style={{ background: "#4ec9b0", color: "#111", border: "none", cursor: "pointer" }}>
            <ArrowUpCircle className="w-3 h-3" />
            Update All ({updatableCount})
          </button>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────── */}
      <div className="flex items-center shrink-0"
        style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
        {(["deps", "search", "scripts"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-4 py-1.5 text-[11px] font-medium"
            style={{
              color: activeTab === t ? "var(--editor-accent, #569cd6)" : "var(--editor-muted, #888)",
              background: "transparent", border: "none", cursor: "pointer",
              borderBottom: `2px solid ${activeTab === t ? "var(--editor-accent, #569cd6)" : "transparent"}`,
            }}>
            {t === "deps" && `📦 Packages (${deps.length})`}
            {t === "search" && "🔎 Install"}
            {t === "scripts" && `▶ Scripts (${scripts.length})`}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* ════ Packages table ════════════════════════════ */}
        {activeTab === "deps" && (
          <div>
            {/* Column headers */}
            <div className="grid items-center px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0 z-10"
              style={{
                gridTemplateColumns: "minmax(160px,2fr) 100px 100px 80px 140px",
                background: "var(--editor-sidebar-bg, #252526)",
                borderBottom: "1px solid var(--editor-border, #3c3c3c)",
                color: "var(--editor-muted, #888)",
              }}>
              <span>Package</span>
              <span className="text-center">Installed</span>
              <span className="text-center">Latest</span>
              <span className="text-center">Update</span>
              <span className="text-right">Action</span>
            </div>

            {Object.keys(depGroups).length === 0 && (
              <div className="flex flex-col items-center py-12 opacity-40">
                <Package className="w-8 h-8 mb-2" />
                <span className="text-xs">{filterText ? "No matching packages" : "No dependencies"}</span>
              </div>
            )}

            {Object.entries(depGroups).map(([type, entries]) => {
              const collapsed = collapsedTypes.has(type);
              return (
                <div key={type}>
                  <button onClick={() => toggleType(type)}
                    className="flex items-center gap-2 w-full px-4 py-1.5 text-[11px] font-semibold"
                    style={{ background: "var(--editor-sidebar-bg, #252526)", color: "var(--editor-fg)", border: "none", borderBottom: "1px solid var(--editor-border, #3c3c3c)", cursor: "pointer", textAlign: "left" }}>
                    {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {type === "dependencies" ? "Dependencies" : type === "devDependencies" ? "Dev Dependencies" : "Peer Dependencies"}
                    <span style={{ color: "var(--editor-muted)", fontWeight: 400 }}>({entries.length})</span>
                  </button>

                  {!collapsed && entries.map((dep) => {
                    const ut = dep.latest ? updateType(dep.version, dep.latest) : null;
                    return (
                      <div key={`${type}-${dep.name}`}
                        className="grid items-center px-4 py-2 hover:bg-[var(--editor-hover-bg,#2a2d2e)] transition-colors"
                        style={{
                          gridTemplateColumns: "minmax(160px,2fr) 100px 100px 80px 140px",
                          borderBottom: "1px solid color-mix(in srgb, var(--editor-border, #3c3c3c) 40%, transparent)",
                        }}>
                        {/* Package */}
                        <div className="flex items-center gap-2 min-w-0">
                          <a href={`https://www.npmjs.com/package/${dep.name}`} target="_blank" rel="noopener noreferrer"
                            className="truncate text-xs font-medium hover:underline" style={{ color: "var(--editor-fg)" }}>
                            {dep.name}
                          </a>
                          <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: typeBadgeColor(type) + "22", color: typeBadgeColor(type) }}>
                            {typeLabel(type)}
                          </span>
                        </div>
                        {/* Installed */}
                        <div className="text-center">
                          <VersionBadge version={dep.version} color={ut ? "#888" : "#4ec9b0"} />
                        </div>
                        {/* Latest */}
                        <div className="text-center">
                          {dep.latest
                            ? <VersionBadge version={dep.latest} color={ut ? "#4ec9b0" : "#6a9955"} />
                            : <span className="text-[10px]" style={{ color: "var(--editor-muted)" }}>{fetchingLatest ? "…" : "—"}</span>}
                        </div>
                        {/* Update badge */}
                        <div className="text-center">
                          {ut ? <UpdateTypeBadge type={ut} /> : dep.latest && <span className="text-[10px]" style={{ color: "#6a9955" }}>✓</span>}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1.5">
                          {ut && dep.latest && (
                            <button onClick={() => updatePkg(dep.name, type, dep.latest!)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold"
                              style={{ background: "#569cd6", color: "#fff", border: "none", cursor: "pointer" }}>
                              Update
                            </button>
                          )}
                          <button onClick={() => removePackage(dep.name, type)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                            style={{ background: "transparent", border: "1px solid var(--editor-border, #3c3c3c)", color: "#f44747", cursor: "pointer" }}
                            title="Uninstall">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <a href={`https://www.npmjs.com/package/${dep.name}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center p-1 rounded opacity-40 hover:opacity-100" title="npm">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Footer */}
            <div className="px-4 py-2 text-[11px] flex items-center gap-4"
              style={{ color: "var(--editor-muted, #888)", borderTop: "1px solid var(--editor-border, #3c3c3c)" }}>
              <span>Showing {filteredDeps.length} of {deps.length} packages</span>
              <div className="flex-1" />
              {updatableCount > 0 && <span style={{ color: "#4ec9b0" }}>{updatableCount} update{updatableCount > 1 ? "s" : ""} available</span>}
            </div>
          </div>
        )}

        {/* ════ Search / Install ══════════════════════════ */}
        {activeTab === "search" && (
          <div>
            <div className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--editor-muted)" }} />
              <input type="text" placeholder="Search npm packages…" value={searchQuery}
                onChange={(e) => onSearchInput(e.target.value)} autoFocus
                style={{ background: "transparent", border: "none", color: "var(--editor-fg)", fontSize: 12, outline: "none", flex: 1 }} />
            </div>

            {searching && (
              <div className="flex items-center justify-center py-8 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "var(--editor-accent)" }} />
                <span className="text-xs" style={{ color: "var(--editor-muted)" }}>Searching…</span>
              </div>
            )}

            {!searching && searchResults.map((r) => {
              const installed = deps.some((d) => d.name === r.name);
              return (
                <div key={r.name}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--editor-hover-bg,#2a2d2e)] transition-colors"
                  style={{ borderBottom: "1px solid color-mix(in srgb, var(--editor-border, #3c3c3c) 40%, transparent)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate">{r.name}</span>
                      <span className="text-[10px] font-mono" style={{ color: "var(--editor-muted)" }}>{r.version}</span>
                    </div>
                    {r.description && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--editor-muted)" }}>{r.description}</p>}
                  </div>
                  {installed ? (
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: "#6a9955", background: "#6a995522" }}>installed</span>
                  ) : (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => addPackage(r.name, r.version, false)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold"
                        style={{ background: "#569cd6", color: "#fff", border: "none", cursor: "pointer" }}>
                        <Plus className="w-3 h-3" /> dep
                      </button>
                      <button onClick={() => addPackage(r.name, r.version, true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px]"
                        style={{ background: "transparent", border: "1px solid var(--editor-border)", color: "var(--editor-fg)", cursor: "pointer" }}>
                        <Plus className="w-3 h-3" /> dev
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="flex flex-col items-center py-12 opacity-40">
                <Search className="w-8 h-8 mb-2" />
                <span className="text-xs">No packages found</span>
              </div>
            )}
          </div>
        )}

        {/* ════ Scripts ══════════════════════════════════ */}
        {activeTab === "scripts" && (
          <div>
            {scripts.length > 0 ? scripts.map(({ name, cmd }) => (
              <div key={name}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--editor-hover-bg,#2a2d2e)] transition-colors"
                style={{ borderBottom: "1px solid color-mix(in srgb, var(--editor-border, #3c3c3c) 40%, transparent)" }}>
                <Play className="w-3.5 h-3.5 shrink-0" style={{ color: "#4ec9b0" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{name}</div>
                  <div className="text-[11px] truncate font-mono mt-0.5" style={{ color: "var(--editor-muted)" }}>{cmd}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`npm run ${name}`); onNotify?.(`Copied "npm run ${name}"`, "success"); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                  style={{ background: "transparent", border: "1px solid var(--editor-border)", color: "var(--editor-fg)", cursor: "pointer" }}>
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            )) : (
              <div className="flex flex-col items-center py-12 opacity-40">
                <Play className="w-8 h-8 mb-2" />
                <span className="text-xs">No scripts defined</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
