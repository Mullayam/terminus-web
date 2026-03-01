/**
 * @module components/EditorRightSidebar
 *
 * VS Code-like right sidebar for the Monaco editor.
 * Contains an Activity Bar (icon strip) and panels:
 *   - Outline: document symbols (classes, functions, etc.)
 *   - Problems: diagnostics / markers
 *   - Info: file metadata (language, encoding, size, etc.)
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type * as monacoNs from "monaco-editor";
import {
  List,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  FileCode2,
  Braces,
  Hash,
  Box,
  Type,
  Diamond,
  Layers,
  Code2,
  Heading,
  AlertCircle,
  FileWarning,
  PanelRightOpen,
  PanelRightClose,
  Blocks,
  Palette,
  Settings,
  MessageSquareCode,
} from "lucide-react";
import { ExtensionPanel } from "./ExtensionPanel";
import { ThemeSidebar } from "./ThemeSidebar";
import { EditorSettingsPanel, type EditorSettings } from "./EditorSettingsPanel";
import { ChatPanel } from "../chat";

/* ── Types ─────────────────────────────────────────────────── */

export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "constant"
  | "module"
  | "heading"
  | "property";

export interface DocumentSymbolItem {
  name: string;
  kind: SymbolKind;
  line: number;
  detail?: string;
  children?: DocumentSymbolItem[];
}

export type SidebarTab = "outline" | "problems" | "info" | "extensions" | "themes" | "settings" | "chat";

export interface EditorRightSidebarProps {
  open: boolean;
  onToggle: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  symbols: DocumentSymbolItem[];
  problems: monacoNs.editor.IMarkerData[];
  onSymbolClick: (symbol: DocumentSymbolItem) => void;
  onProblemClick: (marker: monacoNs.editor.IMarkerData) => void;
  filename: string;
  language: string;
  lineCount: number;
  charCount: number;
  fileSize: number;
  /** Monaco namespace for extension panel */
  monaco?: typeof monacoNs | null;
  /** Editor instance for extension panel */
  editor?: monacoNs.editor.IStandaloneCodeEditor | null;
  /** Callback when extension applies a theme */
  /** Callback when extension applies a theme */
  onThemeApply?: (themeId: string) => void;
  /** Number of installed extensions (for badge) */
  extensionCount?: number;
  /** Current active theme ID (for theme sidebar) */
  activeTheme?: string;
  /** Current editor settings */
  editorSettings?: EditorSettings;
  /** Called when editor settings change */
  onSettingsChange?: (settings: EditorSettings) => void;
  /** Whether terminal integration is enabled (for settings panel) */
  enableTerminal?: boolean;
  /** Base API URL for AI chat */
  chatBaseUrl?: string;
  /** Host identifier for AI chat (session / tab id) */
  chatHostId?: string;
  /** Current file content (for AI chat context) */
  chatFileContent?: string;
  /** Called when AI chat applies code */
  onChatApplyCode?: (code: string, language: string) => void;
}

/* ── Activity Bar Tab ──────────────────────────────────────── */

const TABS: { id: SidebarTab; icon: React.FC<{ className?: string }>; label: string }[] = [
  { id: "chat", icon: MessageSquareCode, label: "AI Chat" },
  { id: "outline", icon: List, label: "Outline" },
  { id: "problems", icon: AlertTriangle, label: "Problems" },
  { id: "info", icon: Info, label: "File Info" },
  { id: "themes", icon: Palette, label: "Themes" },
  { id: "extensions", icon: Blocks, label: "Extensions" },
];

/** Settings tab is rendered separately at the bottom of the activity bar */
const SETTINGS_TAB = { id: "settings" as SidebarTab, icon: Settings, label: "Settings" };

/* ── Symbol icon mapping ───────────────────────────────────── */

function SymbolIcon({ kind, className }: { kind: SymbolKind; className?: string }) {
  const iconClass = `${className ?? "w-3.5 h-3.5"}`;
  switch (kind) {
    case "function":
    case "method":
      return <Braces className={`${iconClass} text-yellow-400`} />;
    case "class":
      return <Box className={`${iconClass} text-orange-400`} />;
    case "interface":
      return <Diamond className={`${iconClass} text-cyan-400`} />;
    case "type":
      return <Type className={`${iconClass} text-green-400`} />;
    case "enum":
      return <Layers className={`${iconClass} text-purple-400`} />;
    case "module":
      return <FileCode2 className={`${iconClass} text-blue-400`} />;
    case "variable":
    case "constant":
      return <Hash className={`${iconClass} text-blue-300`} />;
    case "heading":
      return <Heading className={`${iconClass} text-blue-400`} />;
    case "property":
      return <Code2 className={`${iconClass} text-gray-400`} />;
    default:
      return <Code2 className={`${iconClass} text-gray-400`} />;
  }
}

/* ── Severity helpers ──────────────────────────────────────── */

function getSeverityLabel(severity: monacoNs.MarkerSeverity): string {
  switch (severity) {
    case 8: return "Error";
    case 4: return "Warning";
    case 2: return "Info";
    case 1: return "Hint";
    default: return "Unknown";
  }
}

function getSeverityColor(severity: monacoNs.MarkerSeverity): string {
  switch (severity) {
    case 8: return "text-red-400";
    case 4: return "text-yellow-400";
    case 2: return "text-blue-400";
    case 1: return "text-gray-400";
    default: return "text-gray-400";
  }
}

function SeverityIcon({
  severity,
  className,
}: {
  severity: monacoNs.MarkerSeverity;
  className?: string;
}) {
  const cls = `${className ?? "w-3.5 h-3.5"} ${getSeverityColor(severity)}`;
  switch (severity) {
    case 8: return <AlertCircle className={cls} />;
    case 4: return <FileWarning className={cls} />;
    default: return <Info className={cls} />;
  }
}

/* ── Format file size ──────────────────────────────────────── */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ── Main Component ────────────────────────────────────────── */

export const EditorRightSidebar: React.FC<EditorRightSidebarProps> = ({
  open,
  onToggle,
  activeTab,
  onTabChange,
  symbols,
  problems,
  onSymbolClick,
  onProblemClick,
  filename,
  language,
  lineCount,
  charCount,
  fileSize,
  monaco: monacoProp,
  editor: editorProp,
  onThemeApply,
  extensionCount = 0,
  activeTheme,
  editorSettings,
  onSettingsChange,
  enableTerminal,
  chatBaseUrl,
  chatHostId,
  chatFileContent,
  onChatApplyCode,
}) => {
  const errorCount = useMemo(
    () => problems.filter((p) => p.severity === 8).length,
    [problems],
  );
  const warningCount = useMemo(
    () => problems.filter((p) => p.severity === 4).length,
    [problems],
  );

  /* ── Resizable panel width ── */
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;
  const DEFAULT_WIDTH = 280;
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem("editor-sidebar-width");
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // Dragging left of handle = making sidebar wider (since sidebar is on the right)
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("editor-sidebar-width", String(panelWidth));
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelWidth]);

  return (
    <div className="flex h-full shrink-0">
      {/* ── Activity Bar (icon strip, always visible) ──────── */}
      <div className="flex flex-col items-center w-[40px] bg-[#252526] border-l border-[#3c3c3c] py-2 gap-0.5">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="p-2 rounded-md mb-2 transition-colors text-gray-500 hover:text-gray-300 hover:bg-[#37373d]"
          title={open ? "Close Sidebar" : "Open Sidebar"}
        >
          {open ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>

        {/* Tab icons */}
        {TABS.map((tab) => {
          const isActive = open && activeTab === tab.id;
          const Icon = tab.icon;
          const badge =
            tab.id === "problems" && (errorCount + warningCount) > 0
              ? errorCount + warningCount
              : tab.id === "outline" && symbols.length > 0
                ? symbols.length
                : tab.id === "extensions" && extensionCount > 0
                  ? extensionCount
                  : null;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (open && activeTab === tab.id) {
                  onToggle(); // close if clicking current tab
                } else {
                  onTabChange(tab.id);
                  if (!open) onToggle();
                }
              }}
              className={`relative p-2 rounded-md transition-colors ${
                isActive
                  ? "text-white bg-[#37373d]"
                  : "text-gray-500 hover:text-gray-300 hover:bg-[#37373d]"
              }`}
              title={tab.label}
            >
              <Icon className="w-4 h-4" />
              {badge != null && badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold rounded-full bg-[#007acc] text-white px-0.5">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Spacer to push settings to bottom */}
        <div className="flex-1" />

        {/* Settings button (always at bottom) */}
        {(() => {
          const isActive = open && activeTab === SETTINGS_TAB.id;
          const SettingsIcon = SETTINGS_TAB.icon;
          return (
            <button
              onClick={() => {
                if (open && activeTab === SETTINGS_TAB.id) {
                  onToggle();
                } else {
                  onTabChange(SETTINGS_TAB.id);
                  if (!open) onToggle();
                }
              }}
              className={`p-2 rounded-md mb-1 transition-colors ${
                isActive
                  ? "text-white bg-[#37373d]"
                  : "text-gray-500 hover:text-gray-300 hover:bg-[#37373d]"
              }`}
              title={SETTINGS_TAB.label}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          );
        })()}
      </div>

      {/* ── Panel Content (resizable) ───────────────────────── */}
      <div
        className={`bg-[#252526] border-l border-[#3c3c3c] flex flex-col transition-opacity duration-200 ease-in-out ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ width: open ? panelWidth : 0, overflow: "hidden", position: "relative", transition: open ? "opacity 200ms" : "width 200ms, opacity 200ms" }}
      >
        {/* Drag handle on left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[4px] cursor-col-resize z-10 hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
          onMouseDown={handleDragStart}
        />
        {/* Inner container at current width */}
        <div className="flex flex-col h-full relative" style={{ minWidth: panelWidth }}>
          {/* Panel Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c3c3c] shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {[...TABS, SETTINGS_TAB].find((t) => t.id === activeTab)?.label}
            </span>
          </div>

          {/* Panel Body */}
          <div className={`flex-1 text-sm sidebar-scroll ${activeTab === "chat" ? "overflow-hidden" : "overflow-y-auto"}`}>
            {activeTab === "outline" && (
              <OutlinePanel symbols={symbols} onClick={onSymbolClick} />
            )}
            {activeTab === "problems" && (
              <ProblemsPanel problems={problems} onClick={onProblemClick} />
            )}
            {activeTab === "info" && (
              <InfoPanel
                filename={filename}
                language={language}
                lineCount={lineCount}
                charCount={charCount}
                fileSize={fileSize}
                errorCount={errorCount}
                warningCount={warningCount}
                symbolCount={symbols.length}
              />
            )}
            {activeTab === "extensions" && (
              <ExtensionPanel
                monaco={monacoProp ?? null}
                editor={editorProp ?? null}
                onThemeApply={onThemeApply}
              />
            )}
            {activeTab === "themes" && (
              <ThemeSidebar
                monaco={monacoProp ?? null}
                editor={editorProp ?? null}
                activeTheme={activeTheme}
                onThemeApply={onThemeApply}
              />
            )}
            {activeTab === "settings" && editorSettings && onSettingsChange && (
              <EditorSettingsPanel
                settings={editorSettings}
                onChange={onSettingsChange}
                enableTerminal={enableTerminal}
              />
            )}
            {activeTab === "chat" && chatBaseUrl && (
              <ChatPanel
                baseUrl={chatBaseUrl}
                hostId={chatHostId}
                language={language}
                fileContent={chatFileContent ?? ""}
                filename={filename}
                onApplyCode={onChatApplyCode}
              />
            )}
          </div>
        </div>
      </div>

      {/* Scrollbar styling */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

/* ── Split components for ResizablePanelGroup layout ───────── */

export interface EditorSidebarActivityBarProps {
  open: boolean;
  onToggle: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  symbols: DocumentSymbolItem[];
  problems: monacoNs.editor.IMarkerData[];
  extensionCount?: number;
}

/** Activity bar icon strip (40 px, always visible, placed outside the resizable area). */
export const EditorSidebarActivityBar: React.FC<EditorSidebarActivityBarProps> = ({
  open, onToggle, activeTab, onTabChange, symbols, problems, extensionCount = 0,
}) => {
  const errorCount = useMemo(() => problems.filter((p) => p.severity === 8).length, [problems]);
  const warningCount = useMemo(() => problems.filter((p) => p.severity === 4).length, [problems]);

  return (
    <div className="flex flex-col items-center w-[40px] bg-[#252526] border-l border-[#3c3c3c] py-2 gap-0.5 shrink-0 h-full">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="p-2 rounded-md mb-2 transition-colors text-gray-500 hover:text-gray-300 hover:bg-[#37373d]"
        title={open ? "Close Sidebar" : "Open Sidebar"}
      >
        {open ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
      </button>

      {/* Tab icons */}
      {TABS.map((tab) => {
        const isActive = open && activeTab === tab.id;
        const Icon = tab.icon;
        const badge =
          tab.id === "problems" && (errorCount + warningCount) > 0
            ? errorCount + warningCount
            : tab.id === "outline" && symbols.length > 0
              ? symbols.length
              : tab.id === "extensions" && extensionCount > 0
                ? extensionCount
                : null;

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (open && activeTab === tab.id) {
                onToggle();
              } else {
                onTabChange(tab.id);
                if (!open) onToggle();
              }
            }}
            className={`relative p-2 rounded-md transition-colors ${
              isActive
                ? "text-white bg-[#37373d]"
                : "text-gray-500 hover:text-gray-300 hover:bg-[#37373d]"
            }`}
            title={tab.label}
          >
            <Icon className="w-4 h-4" />
            {badge != null && badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold rounded-full bg-[#007acc] text-white px-0.5">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        );
      })}

      <div className="flex-1" />

      {/* Settings button (bottom) */}
      {(() => {
        const isActive = open && activeTab === SETTINGS_TAB.id;
        const SettingsIcon = SETTINGS_TAB.icon;
        return (
          <button
            onClick={() => {
              if (open && activeTab === SETTINGS_TAB.id) {
                onToggle();
              } else {
                onTabChange(SETTINGS_TAB.id);
                if (!open) onToggle();
              }
            }}
            className={`p-2 rounded-md mb-1 transition-colors ${
              isActive
                ? "text-white bg-[#37373d]"
                : "text-gray-500 hover:text-gray-300 hover:bg-[#37373d]"
            }`}
            title={SETTINGS_TAB.label}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        );
      })()}
    </div>
  );
};

EditorSidebarActivityBar.displayName = "EditorSidebarActivityBar";

/* ── Sidebar Content (lives inside a ResizablePanel) ───────── */

export interface EditorSidebarContentProps {
  activeTab: SidebarTab;
  symbols: DocumentSymbolItem[];
  problems: monacoNs.editor.IMarkerData[];
  onSymbolClick: (symbol: DocumentSymbolItem) => void;
  onProblemClick: (marker: monacoNs.editor.IMarkerData) => void;
  filename: string;
  language: string;
  lineCount: number;
  charCount: number;
  fileSize: number;
  monaco?: typeof monacoNs | null;
  editor?: monacoNs.editor.IStandaloneCodeEditor | null;
  onThemeApply?: (themeId: string) => void;
  activeTheme?: string;
  editorSettings?: EditorSettings;
  onSettingsChange?: (settings: EditorSettings) => void;
  enableTerminal?: boolean;
  chatBaseUrl?: string;
  chatHostId?: string;
  chatFileContent?: string;
  onChatApplyCode?: (code: string, language: string) => void;
}

/** Sidebar panel content (no width management – parent handles sizing via ResizablePanel). */
export const EditorSidebarContent: React.FC<EditorSidebarContentProps> = ({
  activeTab,
  symbols,
  problems,
  onSymbolClick,
  onProblemClick,
  filename,
  language,
  lineCount,
  charCount,
  fileSize,
  monaco: monacoProp,
  editor: editorProp,
  onThemeApply,
  activeTheme,
  editorSettings,
  onSettingsChange,
  enableTerminal,
  chatBaseUrl,
  chatHostId,
  chatFileContent,
  onChatApplyCode,
}) => {
  const errorCount = useMemo(() => problems.filter((p) => p.severity === 8).length, [problems]);
  const warningCount = useMemo(() => problems.filter((p) => p.severity === 4).length, [problems]);

  return (
    <div className="flex flex-col h-full bg-[#252526] border-l border-[#3c3c3c]">
      {/* Panel Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c3c3c] shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {[...TABS, SETTINGS_TAB].find((t) => t.id === activeTab)?.label}
        </span>
      </div>

      {/* Panel Body */}
      <div className={`flex-1 text-sm sidebar-scroll ${activeTab === "chat" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {activeTab === "outline" && (
          <OutlinePanel symbols={symbols} onClick={onSymbolClick} />
        )}
        {activeTab === "problems" && (
          <ProblemsPanel problems={problems} onClick={onProblemClick} />
        )}
        {activeTab === "info" && (
          <InfoPanel
            filename={filename}
            language={language}
            lineCount={lineCount}
            charCount={charCount}
            fileSize={fileSize}
            errorCount={errorCount}
            warningCount={warningCount}
            symbolCount={symbols.length}
          />
        )}
        {activeTab === "extensions" && (
          <ExtensionPanel
            monaco={monacoProp ?? null}
            editor={editorProp ?? null}
            onThemeApply={onThemeApply}
          />
        )}
        {activeTab === "themes" && (
          <ThemeSidebar
            monaco={monacoProp ?? null}
            editor={editorProp ?? null}
            activeTheme={activeTheme}
            onThemeApply={onThemeApply}
          />
        )}
        {activeTab === "settings" && editorSettings && onSettingsChange && (
          <EditorSettingsPanel
            settings={editorSettings}
            onChange={onSettingsChange}
            enableTerminal={enableTerminal}
          />
        )}
        {activeTab === "chat" && chatBaseUrl && (
          <ChatPanel
            baseUrl={chatBaseUrl}
            hostId={chatHostId}
            language={language}
            fileContent={chatFileContent ?? ""}
            filename={filename}
            onApplyCode={onChatApplyCode}
          />
        )}
      </div>

      {/* Scrollbar styling */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

EditorSidebarContent.displayName = "EditorSidebarContent";

/* ── Outline Panel ─────────────────────────────────────────── */

const OutlinePanel: React.FC<{
  symbols: DocumentSymbolItem[];
  onClick: (symbol: DocumentSymbolItem) => void;
}> = ({ symbols, onClick }) => {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  if (symbols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-gray-500">
        <FileCode2 className="w-8 h-8 mb-2 opacity-40" />
        <span className="text-xs text-center">No symbols found in this file</span>
      </div>
    );
  }

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="py-1">
      {symbols.map((symbol, i) => {
        const key = `${symbol.kind}-${symbol.name}-${symbol.line}`;
        const hasChildren = symbol.children && symbol.children.length > 0;
        const isCollapsed = collapsed.has(key);

        return (
          <div key={`${key}-${i}`}>
            <button
              onClick={() => {
                if (hasChildren) toggleCollapse(key);
                onClick(symbol);
              }}
              className="w-full flex items-center gap-1.5 px-3 py-[3px] text-left transition-colors hover:bg-[#2a2d2e] group"
            >
              {hasChildren ? (
                isCollapsed ? (
                  <ChevronRight className="w-3 h-3 shrink-0 text-gray-500" />
                ) : (
                  <ChevronDown className="w-3 h-3 shrink-0 text-gray-500" />
                )
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <SymbolIcon kind={symbol.kind} />
              <span className="text-[12px] text-gray-300 truncate flex-1 group-hover:text-white">
                {symbol.name}
              </span>
              <span className="text-[10px] text-gray-600 shrink-0 group-hover:text-gray-400">
                :{symbol.line}
              </span>
            </button>

            {/* Children (if expanded) */}
            {hasChildren && !isCollapsed && (
              <div className="pl-4">
                {symbol.children!.map((child, ci) => (
                  <button
                    key={`${child.kind}-${child.name}-${child.line}-${ci}`}
                    onClick={() => onClick(child)}
                    className="w-full flex items-center gap-1.5 px-3 py-[3px] text-left transition-colors hover:bg-[#2a2d2e] group"
                  >
                    <span className="w-3 shrink-0" />
                    <SymbolIcon kind={child.kind} />
                    <span className="text-[12px] text-gray-400 truncate flex-1 group-hover:text-white">
                      {child.name}
                    </span>
                    <span className="text-[10px] text-gray-600 shrink-0 group-hover:text-gray-400">
                      :{child.line}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Problems Panel ────────────────────────────────────────── */

const ProblemsPanel: React.FC<{
  problems: monacoNs.editor.IMarkerData[];
  onClick: (marker: monacoNs.editor.IMarkerData) => void;
}> = ({ problems, onClick }) => {
  // Sort: errors first, then warnings, then others
  const sorted = useMemo(
    () =>
      [...problems].sort((a, b) => {
        if (a.severity !== b.severity) return b.severity - a.severity;
        return a.startLineNumber - b.startLineNumber;
      }),
    [problems],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-gray-500">
        <AlertTriangle className="w-8 h-8 mb-2 opacity-40" />
        <span className="text-xs text-center">No problems detected</span>
      </div>
    );
  }

  return (
    <div className="py-1">
      {sorted.map((marker, i) => (
        <button
          key={`${marker.startLineNumber}-${marker.startColumn}-${i}`}
          onClick={() => onClick(marker)}
          className="w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[#2a2d2e] group"
        >
          <SeverityIcon severity={marker.severity} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-gray-300 truncate group-hover:text-white">
              {marker.message}
            </p>
            <p className="text-[10px] text-gray-600">
              <span className={getSeverityColor(marker.severity)}>
                {getSeverityLabel(marker.severity)}
              </span>
              {" "}
              Ln {marker.startLineNumber}, Col {marker.startColumn}
              {marker.source && (
                <span className="text-gray-600"> ({marker.source})</span>
              )}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

/* ── Info Panel ────────────────────────────────────────────── */

const InfoPanel: React.FC<{
  filename: string;
  language: string;
  lineCount: number;
  charCount: number;
  fileSize: number;
  errorCount: number;
  warningCount: number;
  symbolCount: number;
}> = ({ filename, language, lineCount, charCount, fileSize, errorCount, warningCount, symbolCount }) => {
  const rows: [string, string | React.ReactNode][] = [
    ["File", filename],
    ["Language", language],
    ["Encoding", "UTF-8"],
    ["Line Ending", "LF"],
    ["Lines", lineCount.toLocaleString()],
    ["Characters", charCount.toLocaleString()],
    ["Size", formatSize(fileSize)],
    ["Symbols", symbolCount.toString()],
    [
      "Errors",
      errorCount > 0 ? (
        <span className="text-red-400 font-medium">{errorCount}</span>
      ) : (
        <span className="text-green-400">0</span>
      ),
    ],
    [
      "Warnings",
      warningCount > 0 ? (
        <span className="text-yellow-400 font-medium">{warningCount}</span>
      ) : (
        <span className="text-green-400">0</span>
      ),
    ],
  ];

  return (
    <div className="py-2 px-3">
      <table className="w-full">
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label} className="group">
              <td className="py-1 pr-3 text-[11px] text-gray-500 font-medium align-top whitespace-nowrap">
                {label}
              </td>
              <td className="py-1 text-[12px] text-gray-300 truncate group-hover:text-white">
                {val}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

EditorRightSidebar.displayName = "EditorRightSidebar";
