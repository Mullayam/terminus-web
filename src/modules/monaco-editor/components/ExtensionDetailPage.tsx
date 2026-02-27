/**
 * @module components/ExtensionDetailPage
 *
 * VS Code-like extension detail page that opens side-by-side.
 * Shows: icon, name, publisher, install/disable/uninstall buttons,
 * README content, and contribution details (themes, grammars, etc.)
 *
 * Matches the VS Code extension detail layout shown in the reference image.
 */
import React, { useState, useEffect, useCallback } from "react";
import type * as monacoNs from "monaco-editor";
import {
  X,
  Download,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Star,
  CloudDownload,
  Calendar,
  Package,
  FileCode2,
  Palette,
  Code2,
  Settings,
  Layers,
  ExternalLink,
  Book,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { OpenVSXExtension } from "../lib/openVSX";
import type { InstalledExtension } from "../lib/extensionStorage";
import {
  installExtensionFromOpenVSX,
  uninstallExtensionFull,
  toggleExtension,
  getAvailableExtensionThemes,
  type InstallProgress,
} from "../lib/extensionLoader";

type Monaco = typeof monacoNs;

/* ── Types ─────────────────────────────────────────────────── */

export interface ExtensionDetailPageProps {
  /** The Open VSX extension metadata */
  extension: OpenVSXExtension;
  /** Monaco namespace */
  monaco: Monaco | null;
  /** Editor instance */
  editor: monacoNs.editor.IStandaloneCodeEditor | null;
  /** Whether the extension is installed */
  installed?: InstalledExtension;
  /** Close this detail page */
  onClose: () => void;
  /** Refresh installed list after install/uninstall */
  onRefresh?: () => void;
  /** Apply a theme */
  onThemeApply?: (themeId: string) => void;
}

type ActiveTab = "details" | "features" | "changelog";

/* ── Component ─────────────────────────────────────────────── */

export const ExtensionDetailPage: React.FC<ExtensionDetailPageProps> = ({
  extension: ext,
  monaco,
  editor,
  installed,
  onClose,
  onRefresh,
  onThemeApply,
}) => {
  const [readme, setReadme] = useState<string>("");
  const [loadingReadme, setLoadingReadme] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installStage, setInstallStage] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [themes, setThemes] = useState<
    Array<{ themeId: string; label: string; extensionId: string; uiTheme: string }>
  >([]);
  const [contributesExpanded, setContributesExpanded] = useState(true);

  const extId = `${ext.namespace}.${ext.name}`;
  const isInstalled = !!installed;

  // Fetch README from Open VSX or installed data
  useEffect(() => {
    setLoadingReadme(true);
    (async () => {
      try {
        // First check installed readme
        if (installed?.readme) {
          setReadme(installed.readme);
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
        setReadme("*Unable to load README*");
      } finally {
        setLoadingReadme(false);
      }
    })();
  }, [ext, installed]);

  // Load available themes if installed
  useEffect(() => {
    if (isInstalled) {
      getAvailableExtensionThemes().then((t) =>
        setThemes(t.filter((th) => th.extensionId === extId)),
      );
    }
  }, [isInstalled, extId]);

  const handleInstall = useCallback(async () => {
    if (!monaco) return;
    setInstalling(true);

    const onProgress: InstallProgress = (stage, detail) => {
      setInstallStage(stage);
      if (stage === "done" || stage === "error") {
        setInstalling(false);
        onRefresh?.();
      }
    };

    try {
      await installExtensionFromOpenVSX(
        ext.namespace,
        ext.name,
        monaco,
        editor ?? undefined,
        onProgress,
      );
    } catch {
      setInstalling(false);
    }
  }, [ext, monaco, editor, onRefresh]);

  const handleUninstall = useCallback(async () => {
    await uninstallExtensionFull(extId);
    onRefresh?.();
  }, [extId, onRefresh]);

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      await toggleExtension(extId, enabled);
      onRefresh?.();
    },
    [extId, onRefresh],
  );

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-200 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[#3c3c3c]">
        <div className="flex items-start gap-4 p-4">
          {/* Icon */}
          <div className="w-16 h-16 rounded-lg bg-[#3c3c3c] flex items-center justify-center shrink-0 overflow-hidden">
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
              <Package className="w-8 h-8 text-gray-500" />
            )}
          </div>

          {/* Title + metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white leading-tight">
                  {ext.displayName || ext.name}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 text-[12px] text-gray-400">
                  <span>{ext.namespace}</span>
                  <span className="text-gray-600">|</span>
                  <span>v{ext.version}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-[#3c3c3c] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            {ext.description && (
              <p className="text-[12px] text-gray-400 mt-1 line-clamp-2">
                {ext.description}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              {isInstalled ? (
                <>
                  <button
                    onClick={() => handleToggle(!installed.enabled)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                      installed.enabled
                        ? "bg-[#3c3c3c] text-gray-300 hover:bg-[#505050]"
                        : "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                    }`}
                  >
                    {installed.enabled ? (
                      <>
                        <ToggleRight className="w-3.5 h-3.5" /> Disable
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-3.5 h-3.5" /> Enable
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleUninstall}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-900/30 text-red-400 text-[11px] font-medium hover:bg-red-900/50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Uninstall
                  </button>
                </>
              ) : installing ? (
                <div className="flex items-center gap-2 px-3 py-1 text-blue-400 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {installStage === "fetching" && "Fetching metadata…"}
                  {installStage === "downloading" && "Downloading…"}
                  {installStage === "extracting" && "Extracting…"}
                  {installStage === "storing" && "Saving…"}
                  {installStage === "loading" && "Loading…"}
                </div>
              ) : (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0e639c] text-white text-[11px] font-medium hover:bg-[#1177bb] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Install
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 px-4 pb-3 text-[11px] text-gray-500">
          {ext.downloadCount != null && (
            <span className="flex items-center gap-1">
              <CloudDownload className="w-3 h-3" />
              {ext.downloadCount.toLocaleString()} downloads
            </span>
          )}
          {ext.averageRating != null && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              {ext.averageRating.toFixed(1)}
              {ext.reviewCount != null && <span>({ext.reviewCount})</span>}
            </span>
          )}
          {ext.timestamp && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Updated {new Date(ext.timestamp).toLocaleDateString()}
            </span>
          )}
          {ext.categories && ext.categories.length > 0 && (
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {ext.categories.join(", ")}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-t border-[#3c3c3c]">
          {(["details", "features", "changelog"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[12px] font-medium uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-400 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto ext-detail-scroll">
        {activeTab === "details" && (
          <div className="p-4">
            {loadingReadme ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : readme ? (
              <div
                className="prose prose-invert prose-sm max-w-none
                  prose-headings:text-gray-200 prose-p:text-gray-400
                  prose-a:text-blue-400 prose-code:text-green-300
                  prose-pre:bg-[#2d2d2d] prose-pre:border prose-pre:border-[#3c3c3c]
                  prose-img:rounded-md prose-img:max-w-full
                  prose-strong:text-gray-200"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(readme) }}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Book className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-[12px]">No README available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "features" && (
          <div className="p-4 space-y-4">
            {/* Contributes summary */}
            {isInstalled && installed && (
              <div>
                <button
                  onClick={() => setContributesExpanded((e) => !e)}
                  className="flex items-center gap-2 text-[12px] font-semibold text-gray-300 mb-2"
                >
                  {contributesExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  Contributions
                </button>

                {contributesExpanded && (
                  <div className="space-y-3 pl-5">
                    {installed.contributes.themes.length > 0 && (
                      <ContributionSection
                        icon={<Palette className="w-3.5 h-3.5 text-purple-400" />}
                        title={`Themes (${installed.contributes.themes.length})`}
                      >
                        {themes.map((t) => (
                          <button
                            key={t.themeId}
                            onClick={() => onThemeApply?.(t.themeId)}
                            className="flex items-center gap-2 w-full text-left px-2 py-1 rounded text-[11px] text-gray-400 hover:bg-[#2a2d2e] hover:text-white transition-colors"
                          >
                            <Palette className="w-3 h-3 text-purple-400" />
                            {t.label}
                            <span className="text-[9px] text-gray-600 ml-auto">{t.uiTheme}</span>
                          </button>
                        ))}
                      </ContributionSection>
                    )}

                    {installed.contributes.grammars.length > 0 && (
                      <ContributionSection
                        icon={<FileCode2 className="w-3.5 h-3.5 text-blue-400" />}
                        title={`Grammars (${installed.contributes.grammars.length})`}
                      >
                        {installed.contributes.grammars.map((g) => (
                          <div key={g} className="text-[11px] text-gray-500 px-2 py-0.5">
                            {g}
                          </div>
                        ))}
                      </ContributionSection>
                    )}

                    {installed.contributes.snippets.length > 0 && (
                      <ContributionSection
                        icon={<Code2 className="w-3.5 h-3.5 text-green-400" />}
                        title={`Snippets (${installed.contributes.snippets.length})`}
                      >
                        {installed.contributes.snippets.map((s) => (
                          <div key={s} className="text-[11px] text-gray-500 px-2 py-0.5">
                            {s}
                          </div>
                        ))}
                      </ContributionSection>
                    )}

                    {installed.contributes.languages.length > 0 && (
                      <ContributionSection
                        icon={<Settings className="w-3.5 h-3.5 text-yellow-400" />}
                        title={`Languages (${installed.contributes.languages.length})`}
                      >
                        {installed.contributes.languages.map((l) => (
                          <div key={l} className="text-[11px] text-gray-500 px-2 py-0.5">
                            {l}
                          </div>
                        ))}
                      </ContributionSection>
                    )}

                    {(installed.contributes.statusBar?.length ?? 0) > 0 && (
                      <ContributionSection
                        icon={<Layers className="w-3.5 h-3.5 text-cyan-400" />}
                        title={`Status Bar Items (${installed.contributes.statusBar!.length})`}
                      >
                        {installed.contributes.statusBar!.map((sb) => (
                          <div key={sb.id} className="text-[11px] text-gray-500 px-2 py-0.5">
                            {sb.text ?? sb.id} — {sb.alignment ?? "left"}
                          </div>
                        ))}
                      </ContributionSection>
                    )}

                    {installed.contributes.menus &&
                      Object.keys(installed.contributes.menus).length > 0 && (
                        <ContributionSection
                          icon={<Settings className="w-3.5 h-3.5 text-orange-400" />}
                          title={`Context Menus (${Object.keys(installed.contributes.menus).length} groups)`}
                        >
                          {Object.entries(installed.contributes.menus).map(([menuId, items]) => (
                            <div key={menuId} className="text-[11px] text-gray-500 px-2 py-0.5">
                              <span className="text-gray-400">{menuId}</span> — {items.length} items
                            </div>
                          ))}
                        </ContributionSection>
                      )}

                    {(installed.contributes.views &&
                      Object.keys(installed.contributes.views).length > 0) && (
                      <ContributionSection
                        icon={<Layers className="w-3.5 h-3.5 text-teal-400" />}
                        title={`Views (${Object.values(installed.contributes.views).flat().length})`}
                      >
                        {Object.entries(installed.contributes.views).map(([containerId, views]) =>
                          views.map((v) => (
                            <div key={v.id} className="text-[11px] text-gray-500 px-2 py-0.5">
                              {v.name} <span className="text-gray-600">({containerId})</span>
                            </div>
                          )),
                        )}
                      </ContributionSection>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Metadata table */}
            <div className="border-t border-[#3c3c3c] pt-3">
              <h3 className="text-[12px] font-semibold text-gray-300 mb-2">Extension Information</h3>
              <table className="w-full">
                <tbody className="text-[11px]">
                  <MetaRow label="Identifier" value={extId} />
                  <MetaRow label="Publisher" value={ext.publishedBy?.loginName ?? ext.namespace} />
                  <MetaRow label="Version" value={ext.version} />
                  {ext.timestamp && (
                    <MetaRow label="Last Updated" value={new Date(ext.timestamp).toLocaleDateString()} />
                  )}
                  {ext.engines?.vscode && (
                    <MetaRow label="VS Code Engine" value={ext.engines.vscode} />
                  )}
                  {ext.categories && (
                    <MetaRow label="Categories" value={ext.categories.join(", ")} />
                  )}
                </tbody>
              </table>
            </div>

            {/* Links */}
            <div className="border-t border-[#3c3c3c] pt-3">
              <h3 className="text-[12px] font-semibold text-gray-300 mb-2">Resources</h3>
              <div className="space-y-1">
                <ExtLink href={`https://open-vsx.org/extension/${ext.namespace}/${ext.name}`} label="Open VSX Page" />
                {ext.files.license && <ExtLink href={ext.files.license} label="License" />}
                {ext.files.changelog && <ExtLink href={ext.files.changelog} label="Changelog" />}
              </div>
            </div>
          </div>
        )}

        {activeTab === "changelog" && (
          <div className="p-4 text-center py-12 text-gray-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-[12px]">
              View the{" "}
              {ext.files.changelog ? (
                <a
                  href={ext.files.changelog}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  changelog
                </a>
              ) : (
                "changelog"
              )}{" "}
              for version history.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .ext-detail-scroll::-webkit-scrollbar { width: 6px; }
        .ext-detail-scroll::-webkit-scrollbar-track { background: transparent; }
        .ext-detail-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .ext-detail-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

/* ── Helpers ───────────────────────────────────────────────── */

function ContributionSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mb-1">
        {icon} {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1 pr-4 text-gray-500 font-medium whitespace-nowrap align-top">
        {label}
      </td>
      <td className="py-1 text-gray-400 break-all">{value}</td>
    </tr>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      {label}
    </a>
  );
}

/** Simple markdown → HTML renderer (no dependency) */
function renderMarkdown(md: string): string {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Headers
    .replace(/^#{6}\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Horizontal rule
    .replace(/^---+$/gm, "<hr />")
    // Unordered lists
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
    // Paragraphs (lines that aren't already tags)
    .replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, "<p>$1</p>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (!match.startsWith("<ul>")) return `<ul>${match}</ul>`;
    return match;
  });

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

ExtensionDetailPage.displayName = "ExtensionDetailPage";
