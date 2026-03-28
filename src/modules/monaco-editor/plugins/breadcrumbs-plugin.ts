/**
 * @module monaco-editor/plugins/breadcrumbs-plugin
 *
 * Renders a file-path + document-symbol breadcrumb bar above the editor.
 * Clicking a segment scrolls to the corresponding symbol.
 */

import type { MonacoPlugin, PluginContext, Monaco } from "../types";

const STYLE_ID = "breadcrumbs-plugin-css";

const CSS = `
.breadcrumbs-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 10px;
  font-size: 12px;
  font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
  background: var(--vscode-breadcrumb-background, #1e1e1e);
  color: var(--vscode-breadcrumb-foreground, #a0a0a0);
  border-bottom: 1px solid var(--vscode-panel-border, #2d2d2d);
  overflow-x: auto;
  scrollbar-width: none;
  white-space: nowrap;
  min-height: 22px;
  flex-shrink: 0;
}
.breadcrumbs-bar::-webkit-scrollbar { display: none; }
.breadcrumbs-segment {
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
}
.breadcrumbs-segment:hover {
  background: var(--vscode-breadcrumb-focusForeground, #e0e0e0)20;
  color: var(--vscode-breadcrumb-focusForeground, #e0e0e0);
}
.breadcrumbs-segment.active {
  color: var(--vscode-breadcrumb-activeSelectionForeground, #ffffff);
}
.breadcrumbs-sep {
  opacity: 0.4;
  font-size: 10px;
  user-select: none;
}
.breadcrumbs-icon {
  width: 14px; height: 14px;
  display: inline-block;
  vertical-align: middle;
  margin-right: 2px;
}
`;

/* Map Monaco SymbolKind → codicon name for labels */
function symbolKindIcon(kind: number): string {
  const MAP: Record<number, string> = {
    0: "symbol-file", 1: "symbol-module", 2: "symbol-namespace",
    3: "symbol-package", 4: "symbol-class", 5: "symbol-method",
    6: "symbol-property", 7: "symbol-field", 8: "symbol-constructor",
    9: "symbol-enum", 10: "symbol-interface", 11: "symbol-function",
    12: "symbol-variable", 13: "symbol-constant", 14: "symbol-string",
    15: "symbol-number", 16: "symbol-boolean", 17: "symbol-array",
    18: "symbol-object", 19: "symbol-key", 22: "symbol-struct",
    23: "symbol-event", 24: "symbol-operator", 25: "symbol-parameter",
  };
  return MAP[kind] ?? "symbol-misc";
}

interface BreadcrumbEntry {
  label: string;
  kind: number;
  range: { startLineNumber: number; startColumn: number };
}

export const breadcrumbsPlugin: MonacoPlugin = {
  id: "builtin-breadcrumbs",
  name: "Breadcrumbs",
  version: "1.0.0",
  description: "File path + symbol breadcrumb navigation bar",

  onMount(ctx: PluginContext) {
    /* Inject CSS once */
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    /* Create bar element */
    const bar = document.createElement("div");
    bar.className = "breadcrumbs-bar";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Breadcrumbs");

    /* Insert bar above editor */
    const editorDom = ctx.editor.getDomNode();
    const parent = editorDom?.parentElement;
    if (parent && editorDom) {
      parent.insertBefore(bar, editorDom);
    }

    let disposed = false;

    /* Build crumbs from path + symbols */
    const refresh = async () => {
      if (disposed) return;
      const model = ctx.editor.getModel();
      if (!model) return;

      bar.innerHTML = "";

      /* File path segments */
      const filePath = ctx.getFilePath() ?? model.uri.path;
      const pathParts = filePath.split("/").filter(Boolean);

      pathParts.forEach((part, i) => {
        if (i > 0) {
          const sep = document.createElement("span");
          sep.className = "breadcrumbs-sep";
          sep.textContent = "›";
          bar.appendChild(sep);
        }
        const seg = document.createElement("span");
        seg.className = "breadcrumbs-segment";
        if (i === pathParts.length - 1) seg.classList.add("active");
        seg.textContent = part;
        bar.appendChild(seg);
      });

      /* Document symbols */
      const symbols = await getSymbolChain(ctx.monaco, model, ctx.editor.getPosition());
      if (symbols.length) {
        const sep = document.createElement("span");
        sep.className = "breadcrumbs-sep";
        sep.textContent = "›";
        bar.appendChild(sep);
      }

      symbols.forEach((sym, i) => {
        if (i > 0) {
          const sep = document.createElement("span");
          sep.className = "breadcrumbs-sep";
          sep.textContent = "›";
          bar.appendChild(sep);
        }
        const seg = document.createElement("span");
        seg.className = "breadcrumbs-segment";
        seg.title = symbolKindIcon(sym.kind).replace("symbol-", "");
        if (i === symbols.length - 1) seg.classList.add("active");
        seg.textContent = sym.label;
        seg.addEventListener("click", () => {
          ctx.editor.revealLineInCenter(sym.range.startLineNumber);
          ctx.editor.setPosition({
            lineNumber: sym.range.startLineNumber,
            column: sym.range.startColumn,
          });
          ctx.editor.focus();
        });
        bar.appendChild(seg);
      });

      /* Scroll active into view */
      const active = bar.querySelector(".active");
      active?.scrollIntoView({ inline: "end", block: "nearest" });
    };

    /* Debounced refresh */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debouncedRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 200);
    };

    ctx.addDisposable(ctx.editor.onDidChangeCursorPosition(debouncedRefresh));
    ctx.addDisposable(ctx.editor.onDidChangeModelContent(debouncedRefresh));
    refresh();

    ctx.addDisposable({
      dispose() {
        disposed = true;
        clearTimeout(timer);
        bar.remove();
      },
    });
  },
};

/* Walk the document symbol tree to find the chain containing the cursor */
async function getSymbolChain(
  monaco: Monaco,
  model: import("monaco-editor").editor.ITextModel,
  position: import("monaco-editor").Position | null,
): Promise<BreadcrumbEntry[]> {
  if (!position) return [];

  const providers =
    (monaco.languages as any).DocumentSymbolProviderRegistry?.ordered?.(model) ??
    [];

  let allSymbols: import("monaco-editor").languages.DocumentSymbol[] = [];
  for (const prov of providers) {
    try {
      const result = await prov.provideDocumentSymbols(model, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) });
      if (result?.length) {
        allSymbols = result;
        break;
      }
    } catch { /* skip provider */ }
  }

  if (!allSymbols.length) return [];

  const chain: BreadcrumbEntry[] = [];
  const walk = (syms: import("monaco-editor").languages.DocumentSymbol[]) => {
    for (const s of syms) {
      const r = s.range;
      if (
        position.lineNumber >= r.startLineNumber &&
        position.lineNumber <= r.endLineNumber
      ) {
        chain.push({ label: s.name, kind: s.kind, range: r });
        if (s.children?.length) walk(s.children);
        return;
      }
    }
  };
  walk(allSymbols);
  return chain;
}
