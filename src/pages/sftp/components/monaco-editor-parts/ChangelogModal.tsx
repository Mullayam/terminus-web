/**
 * Changelog modal — lists all newly added features/providers.
 * Styled to match the editor theme (uses --editor-* CSS vars with fallbacks).
 */
import React, { useCallback, useEffect } from "react";
import { X, Sparkles, Code2, Braces, FileSearch, Palette, Puzzle, Camera, Package } from "lucide-react";

/* ────────────────────────────────────────────────────────── */
/*  Changelog data                                            */
/* ────────────────────────────────────────────────────────── */

interface ChangelogEntry {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    icon: <Sparkles className="w-4 h-4" />,
    title: "26 Remote Provider Adapters",
    items: [
      "Completion, Hover, Definition, Declaration providers",
      "Type Definition, Implementation, Reference providers",
      "Code Action, Code Lens, Link providers",
      "Document Highlight, Document Symbol providers",
      "Inline Completions, Inlay Hints providers",
      "Document & Range Formatting providers",
      "Color Provider with live picker support",
    ],
  },
  {
    icon: <Code2 className="w-4 h-4" />,
    title: "New Language Intelligence",
    items: [
      "Signature Help — parameter hints as you type",
      "Linked Editing Ranges — rename matching tags simultaneously",
      "On-Type Formatting — auto-format while typing",
      "Rename Provider — F2 symbol rename across file",
      "New Symbol Names — AI-powered rename suggestions",
    ],
  },
  {
    icon: <Braces className="w-4 h-4" />,
    title: "Code Structure",
    items: [
      "Folding Range Provider — custom region folding",
      "Selection Range Provider — smart expand/shrink selection",
    ],
  },
  {
    icon: <FileSearch className="w-4 h-4" />,
    title: "Semantic Tokens",
    items: [
      "Document Semantic Tokens — full-file semantic highlighting",
      "Range Semantic Tokens — efficient partial highlighting",
    ],
  },
  {
    icon: <Palette className="w-4 h-4" />,
    title: "Plugin Context Enhancements",
    items: [
      "PluginContext now exposes all 26 register* methods",
      "Remote manifest system auto-fetches & registers providers",
      "All providers auto-tracked as IDisposable for clean teardown",
    ],
  },
  {
    icon: <Puzzle className="w-4 h-4" />,
    title: "38 Built-in Editor Plugins",
    items: [
      "Rainbow Indent, Bracket Pair Lines, Trailing Whitespace",
      "Smart Select, Parameter Hints, Bookmarks (Ctrl+F2)",
      "Code Actions Lightbulb (Ctrl+.), Cursor History (Alt+←/→)",
      "Font Ligatures Toggle, Ruler Lines, Text Transform (13 modes)",
      "Comment Anchors (TODO/FIXME/HACK with gutter icons)",
      "Code Screenshot (PNG export with syntax highlight)",
      "Toggle Comment Style (line ↔ block, Ctrl+Alt+/)",
      "Paste as JSON (auto-format, CSV→JSON, pretty-print/minify)",
      "Plugin Manager sidebar — enable/disable plugins at runtime",
    ],
  },
  {
    icon: <Camera className="w-4 h-4" />,
    title: "Plugin Manager Panel",
    items: [
      "New sidebar tab with Puzzle icon shows all loaded plugins",
      "Search, enable/disable toggle with localStorage persistence",
      "Plugin count badge on sidebar icon",
      "Notification on editor load showing plugin count",
    ],
  },
  {
    icon: <Package className="w-4 h-4" />,
    title: "View Panel System & NPM Package Manager",
    items: [
      "Extensible View Panel API — register React components as editor tabs",
      "NPM Package Manager panel with table layout (Ctrl+Shift+N)",
      "Installed vs latest version comparison with auto-fetch from npm registry",
      "Color-coded update type badges — MAJOR (red), MINOR (yellow), PATCH (green)",
      "One-click Update per package & bulk Update All button",
      "Uninstall packages & open npm links directly",
      "Search & install new packages from npm registry (dep / devDep)",
      "Scripts tab — view & copy all npm scripts",
      "Collapsible dependency groups (prod / dev / peer)",
      "Filter, Show All toggle, and package count footer",
    ],
  },
];

/* ────────────────────────────────────────────────────────── */
/*  Component                                                 */
/* ────────────────────────────────────────────────────────── */

interface ChangelogModalProps {
  onClose: () => void;
}

function ChangelogModalInner({ onClose }: ChangelogModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl shadow-black/50 w-[580px] max-w-[92vw] max-h-[82vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--editor-sidebar-bg, #252526)",
          border: "1px solid var(--editor-border, #3c3c3c)",
          color: "var(--editor-fg, #d4d4d4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "var(--editor-accent, #007acc)" }} />
            <span className="text-[14px] font-semibold" style={{ color: "var(--editor-fg, #e0e0e0)" }}>
              What&apos;s New
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--editor-accent, #007acc)",
                color: "#fff",
              }}
            >
              v3.0
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--editor-fg, #808080)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--editor-hover-bg, #3c3c3c)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {CHANGELOG.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 mb-2.5">
                <span style={{ color: "var(--editor-accent, #007acc)" }}>{section.icon}</span>
                <h3
                  className="text-[13px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--editor-accent, #007acc)" }}
                >
                  {section.title}
                </h3>
              </div>
              <div className="space-y-1 ml-6">
                {section.items.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 py-1 px-2 rounded-md transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--editor-hover-bg, #1e1e1e)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "var(--editor-accent, #007acc)" }}
                    />
                    <span className="text-[13px]" style={{ color: "var(--editor-fg, #cccccc)" }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer note */}
          <div className="pt-4" style={{ borderTop: "1px solid var(--editor-border, #3c3c3c)" }}>
            <p className="text-[12px]" style={{ color: "var(--editor-fg, #808080)", opacity: 0.7 }}>
              All providers are available via the <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: "var(--editor-hover-bg, #1e1e1e)" }}>PluginContext</code> API
              and the remote manifest fetch system. Disposables are auto-tracked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ChangelogModal = React.memo(ChangelogModalInner);
