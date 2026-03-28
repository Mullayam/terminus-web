/**
 * @module monaco-editor/plugins/breadcrumbs-plugin
 *
 * VS Code-style breadcrumb bar: sits between tabs and editor.
 * Shows file-path segments (with file icon) + document-symbol hierarchy.
 * Clicking a path segment opens a dropdown to pick siblings.
 * Clicking a symbol segment jumps to it and shows symbol children.
 *
 * Matches VS Code's exact 22px height, colors, separators, hover,
 * and dropdown behavior.
 */

import type { MonacoPlugin, PluginContext, Monaco } from "../types";

const STYLE_ID = "breadcrumbs-plugin-css";

/* ── VS Code-accurate breadcrumb styling ──────────────────── */
const CSS = /* css */ `
/* ── Bar ────────────────────────────────────────────── */
.bc-bar {
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, Ubuntu, 'Droid Sans', sans-serif);
  background: var(--vscode-breadcrumb-background, var(--vscode-editor-background, #1e1e1e));
  color: var(--vscode-breadcrumb-foreground, #a9a9a9);
  border-bottom: 1px solid var(--vscode-breadcrumbPicker-background, transparent);
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
  position: relative;
  z-index: 5;
}

/* ── Segment (path or symbol) ───────────────────────── */
.bc-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 3px;
  height: 22px;
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
  position: relative;
  line-height: 22px;
  transition: color 80ms;
}
.bc-item:hover {
  color: var(--vscode-breadcrumb-focusForeground, #e0e0e0);
}
.bc-item.bc-active {
  color: var(--vscode-breadcrumb-activeSelectionForeground, #e0e0e0);
}
.bc-item.bc-focused {
  color: var(--vscode-breadcrumb-activeSelectionForeground, #e0e0e0);
  background: var(--vscode-breadcrumb-activeSelectionForeground, #e0e0e0)12;
}

/* ── Chevron separator ──────────────────────────────── */
.bc-sep {
  display: inline-flex;
  align-items: center;
  padding: 0 1px;
  opacity: 0.55;
  font-size: 14px;
  line-height: 22px;
  pointer-events: none;
}
.bc-sep svg {
  width: 10px;
  height: 10px;
  fill: currentColor;
}

/* ── File / symbol icons in segments ────────────────── */
.bc-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.bc-icon svg {
  width: 14px;
  height: 14px;
}

/* ── Dropdown picker (appears below a segment) ──────── */
.bc-dropdown {
  position: fixed;
  min-width: 180px;
  max-width: 360px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--vscode-breadcrumbPicker-background, #252526);
  border: 1px solid var(--vscode-widget-border, #454545);
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 10000;
  padding: 4px 0;
  font-size: 12px;
  font-family: inherit;
  color: var(--vscode-foreground, #cccccc);
}
.bc-dropdown::-webkit-scrollbar { width: 6px; }
.bc-dropdown::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background, #79797966);
  border-radius: 3px;
}
.bc-dropdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 0;
}
.bc-dropdown-item:hover,
.bc-dropdown-item.bc-dd-active {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}
.bc-dropdown-item.bc-dd-selected {
  background: var(--vscode-list-activeSelectionBackground, #04395e);
  color: var(--vscode-list-activeSelectionForeground, #ffffff);
}
.bc-dropdown-filter {
  width: 100%;
  padding: 3px 8px;
  margin-bottom: 2px;
  font-size: 12px;
  font-family: inherit;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #cccccc);
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  border-radius: 2px;
  outline: none;
  box-sizing: border-box;
}
.bc-dropdown-filter:focus {
  border-color: var(--vscode-focusBorder, #007fd4);
}
.bc-dropdown-header {
  padding: 2px 10px 4px;
}
.bc-dropdown-empty {
  padding: 8px 10px;
  color: var(--vscode-disabledForeground, #666);
  font-style: italic;
}
.bc-dd-kind-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
`;

/* ── Symbol kind → icon color/label mapping (VS Code-accurate) ── */
const SYMBOL_KIND_META: Record<number, { color: string; letter: string; label: string }> = {
  0:  { color: "#c586c0", letter: "F", label: "File" },
  1:  { color: "#d19a66", letter: "M", label: "Module" },
  2:  { color: "#d19a66", letter: "N", label: "Namespace" },
  3:  { color: "#d19a66", letter: "P", label: "Package" },
  4:  { color: "#e5c07b", letter: "C", label: "Class" },
  5:  { color: "#61afef", letter: "m", label: "Method" },
  6:  { color: "#56b6c2", letter: "p", label: "Property" },
  7:  { color: "#56b6c2", letter: "f", label: "Field" },
  8:  { color: "#61afef", letter: "C", label: "Constructor" },
  9:  { color: "#e5c07b", letter: "E", label: "Enum" },
  10: { color: "#98c379", letter: "I", label: "Interface" },
  11: { color: "#c678dd", letter: "ƒ", label: "Function" },
  12: { color: "#e06c75", letter: "v", label: "Variable" },
  13: { color: "#d19a66", letter: "c", label: "Constant" },
  14: { color: "#98c379", letter: "s", label: "String" },
  15: { color: "#d19a66", letter: "#", label: "Number" },
  16: { color: "#56b6c2", letter: "b", label: "Boolean" },
  17: { color: "#e06c75", letter: "[]", label: "Array" },
  18: { color: "#e5c07b", letter: "{}", label: "Object" },
  19: { color: "#d19a66", letter: "k", label: "Key" },
  22: { color: "#e5c07b", letter: "S", label: "Struct" },
  23: { color: "#d19a66", letter: "e", label: "Event" },
  24: { color: "#c586c0", letter: "±", label: "Operator" },
  25: { color: "#56b6c2", letter: "T", label: "TypeParameter" },
};

function symbolKindIconSvg(kind: number): string {
  const meta = SYMBOL_KIND_META[kind] ?? { color: "#aaa", letter: "?" };
  return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="2" fill="${meta.color}22" stroke="${meta.color}" stroke-width="0.8"/><text x="7" y="10.5" text-anchor="middle" font-size="8" font-weight="600" fill="${meta.color}" font-family="monospace">${meta.letter}</text></svg>`;
}

/* Chevron right SVG (VS Code uses codicon chevron-right) */
const CHEVRON_SVG = `<svg viewBox="0 0 16 16"><path d="M5.7 13.7L5 13l4.6-4.6L5 3.8l.7-.7 5.2 5.3-5.2 5.3z" fill="currentColor"/></svg>`;

/* ── Types ────────────────────────────────────────────────── */
interface SymbolNode {
  name: string;
  kind: number;
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  children: SymbolNode[];
}

export const breadcrumbsPlugin: MonacoPlugin = {
  id: "builtin-breadcrumbs",
  name: "Breadcrumbs",
  version: "2.0.0",
  description: "VS Code-style breadcrumb navigation with dropdown pickers",

  onMount(ctx: PluginContext) {
    /* ── Inject CSS ──────────────────────────────────── */
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    /* ── Create bar ──────────────────────────────────── */
    const bar = document.createElement("div");
    bar.className = "bc-bar";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Breadcrumb");

    /* Insert bar above editor in the same flex column */
    const editorDom = ctx.editor.getDomNode();
    const parent = editorDom?.parentElement;
    if (parent && editorDom) {
      parent.insertBefore(bar, editorDom);
      // Force editor re-layout to account for 22px bar
      requestAnimationFrame(() => ctx.editor.layout());
    }

    let disposed = false;
    let activeDropdown: HTMLElement | null = null;
    let symbolTree: SymbolNode[] = [];
    let symbolTreeDirty = true;

    /* ── Dropdown management ─────────────────────────── */
    const closeDropdown = () => {
      activeDropdown?.remove();
      activeDropdown = null;
      bar.querySelectorAll(".bc-focused").forEach((el) => el.classList.remove("bc-focused"));
    };

    const onDocClick = (e: MouseEvent) => {
      if (activeDropdown && !activeDropdown.contains(e.target as Node) && !bar.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", onDocClick, true);

    /* ── Build symbol tree from providers ─────────────── */
    const refreshSymbolTree = async () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const providers: any[] =
        (ctx.monaco.languages as any).DocumentSymbolProviderRegistry?.ordered?.(model) ?? [];

      for (const prov of providers) {
        try {
          const cancelToken = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };
          const result = await prov.provideDocumentSymbols(model, cancelToken);
          if (result?.length) {
            symbolTree = mapSymbols(result);
            symbolTreeDirty = false;
            return;
          }
        } catch { /* skip */ }
      }
      symbolTree = [];
      symbolTreeDirty = false;
    };

    const mapSymbols = (syms: any[]): SymbolNode[] =>
      syms.map((s) => ({
        name: s.name,
        kind: s.kind,
        range: s.range,
        children: s.children?.length ? mapSymbols(s.children) : [],
      }));

    /* ── Find the chain of symbols containing the cursor ── */
    const getSymbolChain = (pos: { lineNumber: number }): SymbolNode[] => {
      const chain: SymbolNode[] = [];
      const walk = (nodes: SymbolNode[]) => {
        for (const n of nodes) {
          if (pos.lineNumber >= n.range.startLineNumber && pos.lineNumber <= n.range.endLineNumber) {
            chain.push(n);
            walk(n.children);
            return;
          }
        }
      };
      walk(symbolTree);
      return chain;
    };

    /* ── Get siblings at a given depth in the symbol tree ── */
    const getSiblingsAt = (chain: SymbolNode[], depth: number): SymbolNode[] => {
      if (depth === 0) return symbolTree;
      if (depth <= chain.length && chain[depth - 1]) {
        return chain[depth - 1].children;
      }
      return [];
    };

    /* ── Render a segment ────────────────────────────── */
    const makeSegment = (
      label: string,
      isActive: boolean,
      iconHtml: string | null,
      onClick: (el: HTMLElement) => void,
    ): HTMLElement => {
      const el = document.createElement("span");
      el.className = "bc-item" + (isActive ? " bc-active" : "");
      if (iconHtml) {
        const iconEl = document.createElement("span");
        iconEl.className = "bc-icon";
        iconEl.innerHTML = iconHtml;
        el.appendChild(iconEl);
      }
      const txt = document.createElement("span");
      txt.textContent = label;
      el.appendChild(txt);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick(el);
      });
      return el;
    };

    /* ── Render a chevron separator ──────────────────── */
    const makeSep = (): HTMLElement => {
      const el = document.createElement("span");
      el.className = "bc-sep";
      el.innerHTML = CHEVRON_SVG;
      return el;
    };

    /* ── Show dropdown picker below a segment ─────────── */
    const showDropdown = (
      anchor: HTMLElement,
      items: { label: string; iconHtml: string; selected: boolean; onPick: () => void }[],
    ) => {
      closeDropdown();

      const dd = document.createElement("div");
      dd.className = "bc-dropdown";
      activeDropdown = dd;
      anchor.classList.add("bc-focused");

      /* Filter input */
      const header = document.createElement("div");
      header.className = "bc-dropdown-header";
      const input = document.createElement("input");
      input.className = "bc-dropdown-filter";
      input.placeholder = "Filter...";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      header.appendChild(input);
      dd.appendChild(header);

      /* Item container */
      const list = document.createElement("div");

      let ddActiveIdx = items.findIndex((i) => i.selected);
      if (ddActiveIdx < 0) ddActiveIdx = 0;

      const render = (filter: string) => {
        list.innerHTML = "";
        const filtered = filter
          ? items.filter((it) => it.label.toLowerCase().includes(filter.toLowerCase()))
          : items;

        if (!filtered.length) {
          const empty = document.createElement("div");
          empty.className = "bc-dropdown-empty";
          empty.textContent = "No matching items";
          list.appendChild(empty);
          return;
        }

        filtered.forEach((item, i) => {
          const row = document.createElement("div");
          row.className = "bc-dropdown-item" +
            (item.selected ? " bc-dd-selected" : "") +
            (i === ddActiveIdx ? " bc-dd-active" : "");

          const icon = document.createElement("span");
          icon.className = "bc-dd-kind-icon";
          icon.innerHTML = item.iconHtml;
          row.appendChild(icon);

          const label = document.createElement("span");
          label.textContent = item.label;
          row.appendChild(label);

          row.addEventListener("click", (e) => {
            e.stopPropagation();
            closeDropdown();
            item.onPick();
          });
          row.addEventListener("mouseenter", () => {
            list.querySelectorAll(".bc-dd-active").forEach((el) => el.classList.remove("bc-dd-active"));
            row.classList.add("bc-dd-active");
            ddActiveIdx = i;
          });

          list.appendChild(row);
        });
      };

      dd.appendChild(list);
      render("");

      /* Position below anchor */
      document.body.appendChild(dd);
      const rect = anchor.getBoundingClientRect();
      dd.style.left = `${Math.max(0, rect.left)}px`;
      dd.style.top = `${rect.bottom + 2}px`;
      // Clamp to viewport
      requestAnimationFrame(() => {
        const ddRect = dd.getBoundingClientRect();
        if (ddRect.right > window.innerWidth) {
          dd.style.left = `${window.innerWidth - ddRect.width - 4}px`;
        }
        if (ddRect.bottom > window.innerHeight) {
          dd.style.top = `${rect.top - ddRect.height - 2}px`;
        }
      });

      /* Filter input events */
      input.addEventListener("input", () => {
        ddActiveIdx = 0;
        render(input.value);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeDropdown();
          ctx.editor.focus();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          ddActiveIdx = Math.min(ddActiveIdx + 1, list.children.length - 1);
          render(input.value);
          list.children[ddActiveIdx]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          ddActiveIdx = Math.max(ddActiveIdx - 1, 0);
          render(input.value);
          list.children[ddActiveIdx]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          e.preventDefault();
          const rows = list.querySelectorAll(".bc-dropdown-item");
          (rows[ddActiveIdx] as HTMLElement)?.click();
        }
      });

      requestAnimationFrame(() => input.focus());
    };

    /* ── Main refresh function ───────────────────────── */
    const refresh = async () => {
      if (disposed) return;
      const model = ctx.editor.getModel();
      if (!model) return;

      if (symbolTreeDirty) {
        await refreshSymbolTree();
      }

      const pos = ctx.editor.getPosition();
      const chain = pos ? getSymbolChain(pos) : [];

      bar.innerHTML = "";

      /* File path segments */
      const filePath = ctx.getFilePath() ?? model.uri.path;
      const pathParts = filePath.split("/").filter(Boolean);
      const isLastPathAndNoSymbols = (i: number) => i === pathParts.length - 1 && chain.length === 0;

      pathParts.forEach((part, i) => {
        if (i > 0) bar.appendChild(makeSep());

        const isLast = isLastPathAndNoSymbols(i);
        const seg = makeSegment(part, isLast, null, (el) => {
          // Dropdown: show sibling files at this path depth
          // For the filename segment, just focus editor
          if (i === pathParts.length - 1) {
            closeDropdown();
            ctx.editor.focus();
          } else {
            closeDropdown();
          }
        });
        bar.appendChild(seg);
      });

      /* Symbol hierarchy segments */
      chain.forEach((sym, i) => {
        bar.appendChild(makeSep());

        const isLast = i === chain.length - 1;
        const seg = makeSegment(
          sym.name,
          isLast,
          symbolKindIconSvg(sym.kind),
          (el) => {
            // Dropdown: show siblings at this symbol depth
            const siblings = getSiblingsAt(chain, i);
            if (!siblings.length) {
              ctx.editor.revealLineInCenter(sym.range.startLineNumber);
              ctx.editor.setPosition({ lineNumber: sym.range.startLineNumber, column: sym.range.startColumn });
              ctx.editor.focus();
              return;
            }

            showDropdown(el, siblings.map((s) => ({
              label: s.name,
              iconHtml: symbolKindIconSvg(s.kind),
              selected: s.name === sym.name && s.range.startLineNumber === sym.range.startLineNumber,
              onPick: () => {
                ctx.editor.revealLineInCenter(s.range.startLineNumber);
                ctx.editor.setPosition({ lineNumber: s.range.startLineNumber, column: s.range.startColumn });
                ctx.editor.focus();
                // Refresh breadcrumbs after a short delay to pick up new position
                setTimeout(debouncedRefresh, 50);
              },
            })));
          },
        );

        seg.title = (SYMBOL_KIND_META[sym.kind]?.label ?? "Symbol") + ": " + sym.name;
        bar.appendChild(seg);
      });

      /* Scroll the last segment into view */
      const lastItem = bar.querySelector(".bc-active") ?? bar.lastElementChild;
      lastItem?.scrollIntoView({ inline: "end", block: "nearest" });
    };

    /* ── Debounced refresh ───────────────────────────── */
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const debouncedRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 120);
    };

    /* Mark symbols dirty on content change (need re-parse) */
    let symbolRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        symbolTreeDirty = true;
        clearTimeout(symbolRefreshTimer);
        symbolRefreshTimer = setTimeout(debouncedRefresh, 600);
      }),
    );

    /* Quick refresh on cursor move (just re-walk existing tree) */
    ctx.addDisposable(ctx.editor.onDidChangeCursorPosition(debouncedRefresh));

    /* Initial render */
    refresh();

    /* ── Keyboard shortcut: Ctrl+Shift+. to focus breadcrumbs ── */
    ctx.addAction({
      id: "breadcrumbs.focus",
      label: "Focus Breadcrumbs",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.Period,
      ],
      run: () => {
        const lastSym = bar.querySelector<HTMLElement>(".bc-active") ??
          bar.querySelector<HTMLElement>(".bc-item:last-of-type");
        lastSym?.click();
      },
    });

    /* ── Cleanup ─────────────────────────────────────── */
    ctx.addDisposable({
      dispose() {
        disposed = true;
        clearTimeout(refreshTimer);
        clearTimeout(symbolRefreshTimer);
        document.removeEventListener("mousedown", onDocClick, true);
        closeDropdown();
        bar.remove();
        // Re-layout editor to reclaim the 22px
        try { ctx.editor.layout(); } catch { /* disposed */ }
      },
    });
  },
};
