/**
 * @module components/ExtensionPanel
 *
 * VS Code-like Extension panel for the editor right sidebar.
 * Allows users to:
 *   - Search extensions from Open VSX
 *   - Install / uninstall extensions
 *   - Enable / disable installed extensions
 *   - View extension details (themes, grammars, snippets it provides)
 *   - Apply themes from installed extensions
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import type * as monacoNs from "monaco-editor";
import {
  Search,
  Download,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Palette,
  FileCode2,
  Code2,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  Star,
  CloudDownload,
  RefreshCw,
} from "lucide-react";
import { searchExtensions, type OpenVSXExtension } from "../lib/openVSX";
import {
  installExtensionFromOpenVSX,
  uninstallExtensionFull,
  getInstalledExtensions,
  toggleExtension,
  getAvailableExtensionThemes,
  type InstallProgress,
} from "../lib/extensionLoader";
import type { InstalledExtension } from "../lib/extensionStorage";

/* ── Types ─────────────────────────────────────────────────── */

type Monaco = typeof monacoNs;

export interface ExtensionPanelProps {
  monaco: Monaco | null;
  editor: monacoNs.editor.IStandaloneCodeEditor | null;
  /** Callback when user applies a theme */
  onThemeApply?: (themeId: string) => void;
}

type View = "list" | "detail" | "search-results";

interface InstallState {
  extensionId: string;
  stage: string;
  error?: string;
}

/* ── Component ─────────────────────────────────────────────── */

export const ExtensionPanel: React.FC<ExtensionPanelProps> = ({
  monaco,
  editor,
  onThemeApply,
}) => {
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OpenVSXExtension[]>([]);
  const [searching, setSearching] = useState(false);
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [selectedExt, setSelectedExt] = useState<OpenVSXExtension | null>(null);
  const [installStates, setInstallStates] = useState<Map<string, InstallState>>(new Map());
  const [availableThemes, setAvailableThemes] = useState<
    Array<{ themeId: string; label: string; extensionId: string; uiTheme: string }>
  >([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const installedIds = new Set(installed.map((e) => e.id));

  // Load installed extensions on mount
  const refreshInstalled = useCallback(async () => {
    const exts = await getInstalledExtensions();
    setInstalled(exts);
    const themes = await getAvailableExtensionThemes();
    setAvailableThemes(themes);
  }, []);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  // Search with debounce
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (!value.trim()) {
        setSearchResults([]);
        setView("list");
        return;
      }

      searchTimerRef.current = setTimeout(async () => {
        setSearching(true);
        setView("search-results");
        try {
          const result = await searchExtensions(value, { size: 20 });
          setSearchResults(result.extensions);
        } catch (err) {
          console.error("[ExtensionPanel] Search failed:", err);
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      }, 400);
    },
    [],
  );

  // Install an extension
  const handleInstall = useCallback(
    async (ext: OpenVSXExtension) => {
      if (!monaco) return;

      const extId = `${ext.namespace}.${ext.name}`;
      const onProgress: InstallProgress = (stage, detail) => {
        setInstallStates((prev) => {
          const next = new Map(prev);
          next.set(extId, { extensionId: extId, stage, error: stage === "error" ? detail : undefined });
          return next;
        });
      };

      try {
        await installExtensionFromOpenVSX(
          ext.namespace,
          ext.name,
          monaco,
          editor ?? undefined,
          onProgress,
        );
        await refreshInstalled();

        // Clear install state after 3s
        setTimeout(() => {
          setInstallStates((prev) => {
            const next = new Map(prev);
            next.delete(extId);
            return next;
          });
        }, 3000);
      } catch (err) {
        console.error("[ExtensionPanel] Install failed:", err);
      }
    },
    [monaco, editor, refreshInstalled],
  );

  // Uninstall
  const handleUninstall = useCallback(
    async (extensionId: string) => {
      await uninstallExtensionFull(extensionId);
      await refreshInstalled();
    },
    [refreshInstalled],
  );

  // Toggle enable/disable
  const handleToggle = useCallback(
    async (extensionId: string, enabled: boolean) => {
      await toggleExtension(extensionId, enabled);
      await refreshInstalled();
    },
    [refreshInstalled],
  );

  // Apply theme
  const handleApplyTheme = useCallback(
    (themeId: string) => {
      if (!monaco) return;
      monaco.editor.setTheme(themeId);
      onThemeApply?.(themeId);
    },
    [monaco, onThemeApply],
  );

  return (
    <div className="flex flex-col h-full text-[12px]">
      {/* Search Bar */}
      <div className="px-2 pt-2 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 bg-[#3c3c3c] rounded px-2 py-1">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search extensions…"
            className="flex-1 bg-transparent text-gray-200 text-[12px] outline-none placeholder:text-gray-500"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setView("list"); setSearchResults([]); }}
              className="text-gray-500 hover:text-gray-300"
            >
              <XCircle className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {view !== "list" && (
        <div className="px-2 pb-1 shrink-0">
          <button
            onClick={() => { setView("list"); setSelectedExt(null); }}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
          >
            <ChevronLeft className="w-3 h-3" />
            Installed
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto ext-scroll">
        {/* Search Results */}
        {view === "search-results" && (
          <div>
            {searching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-500">
                <Search className="w-6 h-6 mb-2 opacity-40" />
                <span className="text-[11px]">No extensions found</span>
              </div>
            ) : (
              searchResults.map((ext) => (
                <ExtensionSearchItem
                  key={`${ext.namespace}.${ext.name}`}
                  ext={ext}
                  isInstalled={installedIds.has(`${ext.namespace}.${ext.name}`)}
                  installState={installStates.get(`${ext.namespace}.${ext.name}`)}
                  onInstall={() => handleInstall(ext)}
                  onDetail={() => { setSelectedExt(ext); setView("detail"); }}
                />
              ))
            )}
          </div>
        )}

        {/* Extension Detail */}
        {view === "detail" && selectedExt && (
          <ExtensionDetail
            ext={selectedExt}
            isInstalled={installedIds.has(`${selectedExt.namespace}.${selectedExt.name}`)}
            installState={installStates.get(`${selectedExt.namespace}.${selectedExt.name}`)}
            installedData={installed.find((e) => e.id === `${selectedExt.namespace}.${selectedExt.name}`)}
            availableThemes={availableThemes.filter(
              (t) => t.extensionId === `${selectedExt.namespace}.${selectedExt.name}`,
            )}
            onInstall={() => handleInstall(selectedExt)}
            onUninstall={() => handleUninstall(`${selectedExt.namespace}.${selectedExt.name}`)}
            onApplyTheme={handleApplyTheme}
          />
        )}

        {/* Installed List */}
        {view === "list" && (
          <div>
            {/* Installed section header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#3c3c3c]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Installed ({installed.length})
              </span>
              <button
                onClick={refreshInstalled}
                className="text-gray-500 hover:text-gray-300"
                title="Refresh"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {installed.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-500">
                <Package className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-[11px] text-center px-4">
                  No extensions installed. Search to find and install extensions.
                </span>
              </div>
            ) : (
              installed.map((ext) => (
                <InstalledExtensionItem
                  key={ext.id}
                  ext={ext}
                  themes={availableThemes.filter((t) => t.extensionId === ext.id)}
                  onToggle={(enabled) => handleToggle(ext.id, enabled)}
                  onUninstall={() => handleUninstall(ext.id)}
                  onApplyTheme={handleApplyTheme}
                />
              ))
            )}

            {/* Available Themes Section */}
            {availableThemes.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-t border-b border-[#3c3c3c] mt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Available Themes ({availableThemes.length})
                  </span>
                </div>
                <div className="py-1">
                  {availableThemes.map((theme) => (
                    <button
                      key={theme.themeId}
                      onClick={() => handleApplyTheme(theme.themeId)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] text-left transition-colors group"
                    >
                      <Palette className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 truncate group-hover:text-white">
                          {theme.label}
                        </div>
                        <div className="text-[10px] text-gray-600">
                          {theme.extensionId} · {theme.uiTheme}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scrollbar styling */}
      <style>{`
        .ext-scroll::-webkit-scrollbar { width: 5px; }
        .ext-scroll::-webkit-scrollbar-track { background: transparent; }
        .ext-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .ext-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

/* ── Search Result Item ────────────────────────────────────── */

const ExtensionSearchItem: React.FC<{
  ext: OpenVSXExtension;
  isInstalled: boolean;
  installState?: InstallState;
  onInstall: () => void;
  onDetail: () => void;
}> = ({ ext, isInstalled, installState, onInstall, onDetail }) => {
  const isInstalling = installState && !["done", "error"].includes(installState.stage);
  const isDone = installState?.stage === "done";
  const isError = installState?.stage === "error";

  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-[#2a2d2e] transition-colors group">
      {/* Icon */}
      <div className="w-8 h-8 rounded bg-[#3c3c3c] flex items-center justify-center shrink-0 overflow-hidden">
        {ext.files.icon ? (
          <img
            src={ext.files.icon}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Package className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onDetail}>
        <div className="text-gray-200 font-medium truncate group-hover:text-white">
          {ext.displayName || ext.name}
        </div>
        <div className="text-[10px] text-gray-500 truncate">
          {ext.namespace}
        </div>
        <div className="text-[10px] text-gray-600 truncate mt-0.5">
          {ext.description}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
          {ext.averageRating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 text-yellow-500" />
              {ext.averageRating.toFixed(1)}
            </span>
          )}
          {ext.downloadCount != null && (
            <span className="flex items-center gap-0.5">
              <CloudDownload className="w-2.5 h-2.5" />
              {ext.downloadCount > 1000
                ? `${(ext.downloadCount / 1000).toFixed(0)}k`
                : ext.downloadCount}
            </span>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="shrink-0 pt-1">
        {isInstalled || isDone ? (
          <span className="flex items-center gap-0.5 text-green-400 text-[10px]">
            <CheckCircle2 className="w-3 h-3" />
            Installed
          </span>
        ) : isInstalling ? (
          <span className="flex items-center gap-0.5 text-blue-400 text-[10px]">
            <Loader2 className="w-3 h-3 animate-spin" />
            {installState?.stage}
          </span>
        ) : isError ? (
          <span className="flex items-center gap-0.5 text-red-400 text-[10px]">
            <XCircle className="w-3 h-3" />
            Error
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0e639c] text-white text-[10px] hover:bg-[#1177bb] transition-colors"
          >
            <Download className="w-3 h-3" />
            Install
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Installed Extension Item ──────────────────────────────── */

const InstalledExtensionItem: React.FC<{
  ext: InstalledExtension;
  themes: Array<{ themeId: string; label: string; uiTheme: string }>;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
  onApplyTheme: (themeId: string) => void;
}> = ({ ext, themes, onToggle, onUninstall, onApplyTheme }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[#3c3c3c]/50">
      <div className="flex items-start gap-2 px-3 py-2 hover:bg-[#2a2d2e] transition-colors group">
        {/* Icon */}
        <div className="w-7 h-7 rounded bg-[#3c3c3c] flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
          {ext.iconUrl ? (
            <img
              src={ext.iconUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Package className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>

        {/* Info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="text-gray-200 font-medium truncate text-[11px] group-hover:text-white">
            {ext.displayName}
          </div>
          <div className="text-[10px] text-gray-500">{ext.publisher}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">v{ext.version}</div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0 pt-1">
          <button
            onClick={() => onToggle(!ext.enabled)}
            className={`p-0.5 rounded transition-colors ${ext.enabled ? "text-green-400 hover:text-green-300" : "text-gray-600 hover:text-gray-400"}`}
            title={ext.enabled ? "Disable" : "Enable"}
          >
            {ext.enabled ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onUninstall()}
            className="p-0.5 rounded text-gray-600 hover:text-red-400 transition-colors"
            title="Uninstall"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded: show contributes */}
      {expanded && (
        <div className="px-3 pb-2 pl-12">
          {/* Contributes summary */}
          <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mt-1">
            {ext.contributes.themes.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Palette className="w-2.5 h-2.5 text-purple-400" />
                {ext.contributes.themes.length} theme{ext.contributes.themes.length > 1 ? "s" : ""}
              </span>
            )}
            {ext.contributes.grammars.length > 0 && (
              <span className="flex items-center gap-0.5">
                <FileCode2 className="w-2.5 h-2.5 text-blue-400" />
                {ext.contributes.grammars.length} grammar{ext.contributes.grammars.length > 1 ? "s" : ""}
              </span>
            )}
            {ext.contributes.snippets.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Code2 className="w-2.5 h-2.5 text-green-400" />
                {ext.contributes.snippets.length} snippet{ext.contributes.snippets.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Quick theme apply */}
          {themes.length > 0 && (
            <div className="mt-1.5">
              {themes.map((t) => (
                <button
                  key={t.themeId}
                  onClick={() => onApplyTheme(t.themeId)}
                  className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-[#37373d] text-[10px] text-gray-400 hover:text-white transition-colors"
                >
                  <Palette className="w-2.5 h-2.5 text-purple-400" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Extension Detail View ─────────────────────────────────── */

const ExtensionDetail: React.FC<{
  ext: OpenVSXExtension;
  isInstalled: boolean;
  installState?: InstallState;
  installedData?: InstalledExtension;
  availableThemes: Array<{ themeId: string; label: string; uiTheme: string }>;
  onInstall: () => void;
  onUninstall: () => void;
  onApplyTheme: (themeId: string) => void;
}> = ({ ext, isInstalled, installState, installedData, availableThemes, onInstall, onUninstall, onApplyTheme }) => {
  const isInstalling = installState && !["done", "error"].includes(installState.stage);
  const [readme, setReadme] = useState("");
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "readme">("overview");

  // Fetch README
  useEffect(() => {
    setLoadingReadme(true);
    (async () => {
      try {
        // Try installed data first
        if (installedData?.readme) {
          setReadme(installedData.readme);
          setLoadingReadme(false);
          return;
        }
        // Fetch from Open VSX
        if (ext.files.readme) {
          const res = await fetch(ext.files.readme);
          if (res.ok) {
            setReadme(await res.text());
          }
        }
      } catch {
        setReadme("");
      } finally {
        setLoadingReadme(false);
      }
    })();
  }, [ext, installedData]);

  return (
    <div className="px-3 py-2">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-[#3c3c3c] flex items-center justify-center shrink-0 overflow-hidden">
          {ext.files.icon ? (
            <img
              src={ext.files.icon}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Package className="w-6 h-6 text-gray-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-gray-200">
            {ext.displayName || ext.name}
          </h3>
          <div className="text-[10px] text-gray-500">{ext.namespace}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">v{ext.version}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-3">
        {isInstalled ? (
          <>
            <button
              onClick={onUninstall}
              className="flex items-center gap-1 px-3 py-1 rounded bg-red-900/30 text-red-400 text-[11px] hover:bg-red-900/50 transition-colors flex-1 justify-center"
            >
              <Trash2 className="w-3 h-3" />
              Uninstall
            </button>
          </>
        ) : isInstalling ? (
          <div className="flex items-center gap-2 px-3 py-1.5 text-blue-400 text-[11px] flex-1 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {installState?.stage === "fetching" && "Fetching metadata…"}
            {installState?.stage === "downloading" && "Downloading VSIX…"}
            {installState?.stage === "extracting" && "Extracting…"}
            {installState?.stage === "storing" && "Saving to storage…"}
            {installState?.stage === "loading" && "Loading into editor…"}
          </div>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 px-3 py-1 rounded bg-[#0e639c] text-white text-[11px] hover:bg-[#1177bb] transition-colors flex-1 justify-center"
          >
            <Download className="w-3 h-3" />
            Install
          </button>
        )}
      </div>

      {/* Description */}
      {ext.description && (
        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
          {ext.description}
        </p>
      )}

      {/* Detail Tabs */}
      <div className="flex border-b border-[#3c3c3c] mb-2">
        <button
          onClick={() => setDetailTab("overview")}
          className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider border-b-2 transition-colors ${
            detailTab === "overview"
              ? "border-blue-400 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setDetailTab("readme")}
          className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider border-b-2 transition-colors ${
            detailTab === "readme"
              ? "border-blue-400 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          README
        </button>
      </div>

      {detailTab === "overview" && (
        <>
          {/* Metadata */}
          <div className="space-y-1 mb-3">
            <DetailRow label="Publisher" value={ext.publishedBy?.loginName ?? ext.namespace} />
            {ext.averageRating != null && (
              <DetailRow
                label="Rating"
                value={
                  <span className="flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 text-yellow-500" />
                    {ext.averageRating.toFixed(1)}
                    {ext.reviewCount != null && (
                      <span className="text-gray-600 ml-1">({ext.reviewCount})</span>
                    )}
                  </span>
                }
              />
            )}
            {ext.downloadCount != null && (
              <DetailRow
                label="Downloads"
                value={ext.downloadCount.toLocaleString()}
              />
            )}
            {ext.categories && ext.categories.length > 0 && (
              <DetailRow
                label="Categories"
                value={ext.categories.join(", ")}
              />
            )}
            {ext.timestamp && (
              <DetailRow
                label="Updated"
                value={new Date(ext.timestamp).toLocaleDateString()}
              />
            )}
          </div>

          {/* Installed info + theme quick-apply */}
          {isInstalled && installedData && (
            <div className="border-t border-[#3c3c3c] pt-2 mt-2">
              <div className="text-[11px] text-gray-400 font-medium mb-1.5">Contributes:</div>
              <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-2">
                {installedData.contributes.themes.length > 0 && (
                  <span className="flex items-center gap-0.5 bg-[#3c3c3c] rounded px-1.5 py-0.5">
                    <Palette className="w-2.5 h-2.5 text-purple-400" />
                    {installedData.contributes.themes.length} themes
                  </span>
                )}
                {installedData.contributes.grammars.length > 0 && (
                  <span className="flex items-center gap-0.5 bg-[#3c3c3c] rounded px-1.5 py-0.5">
                    <FileCode2 className="w-2.5 h-2.5 text-blue-400" />
                    {installedData.contributes.grammars.length} grammars
                  </span>
                )}
                {installedData.contributes.snippets.length > 0 && (
                  <span className="flex items-center gap-0.5 bg-[#3c3c3c] rounded px-1.5 py-0.5">
                    <Code2 className="w-2.5 h-2.5 text-green-400" />
                    {installedData.contributes.snippets.length} snippets
                  </span>
                )}
                {(installedData.contributes.statusBar?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 bg-[#3c3c3c] rounded px-1.5 py-0.5">
                    <Code2 className="w-2.5 h-2.5 text-cyan-400" />
                    {installedData.contributes.statusBar!.length} status bar
                  </span>
                )}
                {installedData.contributes.menus && Object.keys(installedData.contributes.menus).length > 0 && (
                  <span className="flex items-center gap-0.5 bg-[#3c3c3c] rounded px-1.5 py-0.5">
                    <Code2 className="w-2.5 h-2.5 text-orange-400" />
                    {Object.values(installedData.contributes.menus).flat().length} menu items
                  </span>
                )}
              </div>

              {/* Quick Theme Picker */}
              {availableThemes.length > 0 && (
                <>
                  <div className="text-[11px] text-gray-400 font-medium mb-1.5">Apply Theme:</div>
                  {availableThemes.map((t) => (
                    <button
                      key={t.themeId}
                      onClick={() => onApplyTheme(t.themeId)}
                      className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded hover:bg-[#37373d] text-[11px] text-gray-300 hover:text-white transition-colors mb-0.5"
                    >
                      <Palette className="w-3 h-3 text-purple-400" />
                      {t.label}
                      <span className="text-[9px] text-gray-600 ml-auto">{t.uiTheme}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {detailTab === "readme" && (
        <div className="mt-1">
          {loadingReadme ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            </div>
          ) : readme ? (
            <div
              className="prose prose-invert prose-xs max-w-none text-[11px]
                prose-headings:text-gray-200 prose-headings:text-[12px] prose-headings:mt-2 prose-headings:mb-1
                prose-p:text-gray-400 prose-p:text-[11px] prose-p:my-1
                prose-a:text-blue-400 prose-code:text-green-300 prose-code:text-[10px]
                prose-pre:bg-[#2d2d2d] prose-pre:border prose-pre:border-[#3c3c3c] prose-pre:text-[10px] prose-pre:p-2
                prose-img:rounded prose-img:max-w-full
                prose-strong:text-gray-200
                prose-li:text-gray-400 prose-li:text-[11px]"
              dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(readme) }}
            />
          ) : (
            <div className="text-center text-gray-500 py-6">
              <p className="text-[11px]">No README available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Detail Row helper ─────────────────────────────────────── */

const DetailRow: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="flex items-start text-[10px]">
    <span className="text-gray-500 w-20 shrink-0">{label}</span>
    <span className="text-gray-400 flex-1">{value}</span>
  </div>
);

/* ── Simple Markdown → HTML ───────────────────────────────── */

function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre><code class="language-${lang}">${code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^#{6}\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^---+$/gm, "<hr />")
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");

  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (m) =>
    m.startsWith("<ul>") ? m : `<ul>${m}</ul>`);
  return html;
}

ExtensionPanel.displayName = "ExtensionPanel";
