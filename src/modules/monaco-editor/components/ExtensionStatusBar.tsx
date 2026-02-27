/**
 * @module components/ExtensionStatusBar
 *
 * VS Code-style bottom status bar for the Monaco Editor module.
 *
 * Shows built-in editor info (language, cursor position, line count,
 * encoding, indentation, word wrap) plus any items contributed by
 * installed extensions or passed via `extraItems`.
 */
import React, { useState, useEffect } from "react";
import type * as monacoNs from "monaco-editor";
import { getEnabledExtensions } from "../lib/extensionStorage";
import type { ExtStatusBarItem } from "../lib/extensionStorage";

type Monaco = typeof monacoNs;

/* ── Types ─────────────────────────────────────────────────── */

export interface ExtensionStatusBarProps {
  monaco: Monaco | null;
  editor: monacoNs.editor.IStandaloneCodeEditor | null;
  /** Resolved Monaco language ID (e.g. "typescript") */
  language?: string;
  /** Current cursor line (1-based) */
  cursorLine?: number;
  /** Current cursor column (1-based) */
  cursorCol?: number;
  /** Total number of lines */
  lineCount?: number;
  /** Total character count */
  charCount?: number;
  /** Word wrap mode */
  wordWrap?: string;
  /** File encoding label */
  encoding?: string;
  /** Tab size */
  tabSize?: number;
  /** Whether indentation uses spaces */
  insertSpaces?: boolean;
  /** Additional items from the host app (merged with extension items) */
  extraItems?: StatusBarItemDef[];
  /** Extra CSS class for the bar */
  className?: string;
}

export interface StatusBarItemDef {
  id: string;
  text: string;
  tooltip?: string;
  alignment?: "left" | "right";
  priority?: number;
  color?: string;
  command?: string;
  onClick?: () => void;
}

/* ── Language display labels ───────────────────────────────── */

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", python: "Python",
  ruby: "Ruby", go: "Go", rust: "Rust", java: "Java", kotlin: "Kotlin",
  c: "C", cpp: "C++", csharp: "C#", swift: "Swift", html: "HTML",
  css: "CSS", scss: "SCSS", less: "LESS", json: "JSON", yaml: "YAML",
  xml: "XML", markdown: "Markdown", shell: "Shell", sql: "SQL",
  graphql: "GraphQL", dockerfile: "Dockerfile", ini: "Config",
  plaintext: "Plain Text",
};

function langLabel(id: string): string {
  return LANG_LABELS[id] ?? id;
}

/* ── Component ─────────────────────────────────────────────── */

export const ExtensionStatusBar: React.FC<ExtensionStatusBarProps> = ({
  monaco,
  editor,
  language = "plaintext",
  cursorLine = 1,
  cursorCol = 1,
  lineCount = 0,
  charCount = 0,
  wordWrap = "off",
  encoding = "UTF-8",
  tabSize = 2,
  insertSpaces = true,
  extraItems = [],
  className = "",
}) => {
  const [extItems, setExtItems] = useState<StatusBarItemDef[]>([]);

  // Load status bar contributions from enabled extensions
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const extensions = await getEnabledExtensions();
        const items: StatusBarItemDef[] = [];

        for (const ext of extensions) {
          const statusBar = ext.contributes.statusBar;
          if (!statusBar?.length) continue;

          for (const sb of statusBar) {
            items.push({
              id: `${ext.id}::${sb.id}`,
              text: sb.text ?? sb.id,
              tooltip: sb.tooltip,
              alignment: sb.alignment,
              priority: sb.priority,
              color: sb.color,
              command: sb.command,
            });
          }
        }

        if (!cancelled) setExtItems(items);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Merge extension + extra items
  const customItems = [...extItems, ...extraItems];

  const customLeft = customItems
    .filter((i) => (i.alignment ?? "left") === "left")
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const customRight = customItems
    .filter((i) => i.alignment === "right")
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const handleClick = (item: StatusBarItemDef) => {
    if (item.onClick) {
      item.onClick();
      return;
    }
    if (item.command && editor) {
      const action = editor.getAction(item.command);
      if (action) {
        action.run();
      }
    }
  };

  const indentLabel = insertSpaces ? `Spaces: ${tabSize}` : `Tab Size: ${tabSize}`;
  const wrapLabel = wordWrap === "off" ? null : "Wrap";

  return (
    <div
      className={`flex items-center justify-between h-[22px] bg-[#007acc] text-white text-[11px] px-2 select-none shrink-0 ${className}`}
    >
      {/* ── Left group ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
        <span className="shrink-0 opacity-90">
          Ln {cursorLine}, Col {cursorCol}
        </span>
        <span className="shrink-0 opacity-80">{indentLabel}</span>
        {wrapLabel && <span className="shrink-0 opacity-80">{wrapLabel}</span>}
        {customLeft.map((item) => (
          <StatusBarButton key={item.id} item={item} onClick={() => handleClick(item)} />
        ))}
      </div>

      {/* ── Right group ────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {customRight.map((item) => (
          <StatusBarButton key={item.id} item={item} onClick={() => handleClick(item)} />
        ))}
        <span className="shrink-0 font-medium">{langLabel(language)}</span>
        <span className="shrink-0 opacity-80">{encoding}</span>
        <span className="shrink-0 opacity-70">
          {lineCount} lines · {charCount.toLocaleString()} chars
        </span>
      </div>
    </div>
  );
};

/* ── Helpers ───────────────────────────────────────────────── */

function StatusBarButton({
  item,
  onClick,
}: {
  item: StatusBarItemDef;
  onClick: () => void;
}) {
  const hasAction = !!(item.onClick || item.command);

  return (
    <button
      onClick={hasAction ? onClick : undefined}
      title={item.tooltip ?? item.text}
      className={`flex items-center gap-1 px-1 py-0.5 rounded truncate max-w-[200px] transition-colors ${
        hasAction ? "hover:bg-white/15 cursor-pointer" : "cursor-default"
      }`}
      style={{ color: item.color || "inherit" }}
      disabled={!hasAction}
    >
      <span className="truncate text-[11px]">{renderStatusText(item.text)}</span>
    </button>
  );
}

/**
 * Render status bar text, handling $(icon-name) patterns
 * (VS Code codicon references — we render them as plain text if no icon font).
 */
function renderStatusText(text: string): string {
  // Remove $(icon) patterns (codicon references we can't render)
  return text.replace(/\$\([^)]+\)\s*/g, "").trim();
}

ExtensionStatusBar.displayName = "ExtensionStatusBar";
