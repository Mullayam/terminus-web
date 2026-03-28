/**
 * @module monaco-editor/plugins/inline-command-plugin
 *
 * VS Code-style inline command input (Ctrl+I).
 *
 * Press Ctrl+I to open an inline input widget at the current cursor.
 * Type a command/prompt and press Enter to stream the AI response
 * which gets inserted at that position. Press Escape to dismiss.
 *
 * Uses the chat SSE endpoint (`/api/chat`) for streaming responses.
 *
 * Usage:
 *   import { createInlineCommandPlugin } from "@/modules/monaco-editor";
 *
 *   const inlineCmd = createInlineCommandPlugin({ endpoint: "http://localhost:7145" });
 *   <MonacoEditor plugins={[inlineCmd]} />
 */

import type * as monacoNs from "monaco-editor";
import type { MonacoPlugin, PluginContext } from "../types";
import { streamChat } from "../chat/api";
import type { ChatRequest, ChatStreamChunk } from "../chat/types";

type Monaco = typeof monacoNs;

/* ── Configuration ─────────────────────────────────────────── */

export interface InlineCommandPluginOptions {
  /** Base API URL, e.g. "http://localhost:7145" */
  endpoint: string;
  /** Optional host ID for authenticated requests */
  hostId?: string;
  /** Default AI provider ID */
  providerId?: string;
  /** Default AI model ID */
  modelId?: string;
}

/* ── Constants ─────────────────────────────────────────────── */

const PLUGIN_ID = "builtin-inline-command";
const WIDGET_ID = "inline-command-widget";
const ACTION_ID = "inline-command.open";

/* ── Inject global CSS once ────────────────────────────────── */

let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const css = `
/* ── Inline Command Widget ─ VS Code style ────────────────── */
.inline-cmd-root {
  position: relative;
  z-index: 100;
  width: 480px;
  max-width: min(600px, 95vw);
  border-radius: 8px;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-contrastBorder, rgba(255,255,255,.08)));
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e));
  box-shadow: 0 0 0 1px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.35);
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #cccccc));
  overflow: hidden;
}

/* ── Header bar ─────────────────────────────────────────────── */
.inline-cmd-header {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px 2px 2px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e));
  border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,.06));
}

.inline-cmd-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 4px;
  color: var(--vscode-textLink-foreground, #3794ff);
}
.inline-cmd-icon svg { width: 16px; height: 16px; }

/* ── Input field ────────────────────────────────────────────── */
.inline-cmd-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.inline-cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 5px 4px;
  color: var(--vscode-input-foreground, var(--vscode-editor-foreground, #cccccc));
  font-size: 13px;
  font-family: inherit;
  line-height: 18px;
  caret-color: var(--vscode-editorCursor-foreground, #aeafad);
  min-width: 0;
}
.inline-cmd-input::placeholder {
  color: var(--vscode-input-placeholderForeground, rgba(204,204,204,.5));
}
.inline-cmd-input:disabled {
  opacity: .5;
}

/* ── Submit / Stop button ───────────────────────────────────── */
.inline-cmd-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
  cursor: pointer;
  padding: 0;
  transition: background .1s;
}
.inline-cmd-submit:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}
.inline-cmd-submit:disabled {
  opacity: .4;
  cursor: default;
}
.inline-cmd-submit svg { width: 14px; height: 14px; }

/* ── Status / progress bar ──────────────────────────────────── */
.inline-cmd-progress {
  height: 2px;
  background: transparent;
  overflow: hidden;
}
.inline-cmd-progress.active {
  background: var(--vscode-editorWidget-border, rgba(255,255,255,.04));
}
.inline-cmd-progress-bar {
  height: 100%;
  width: 30%;
  background: var(--vscode-progressBar-background, #0e70c0);
  border-radius: 1px;
  animation: inline-cmd-slide 1.2s ease-in-out infinite;
}
@keyframes inline-cmd-slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(430%); }
}

/* ── Status text ────────────────────────────────────────────── */
.inline-cmd-status {
  display: none;
  padding: 4px 10px 2px;
  font-size: 11px;
  line-height: 16px;
  color: var(--vscode-descriptionForeground, rgba(204,204,204,.7));
  font-family: var(--vscode-editor-font-family, Consolas, "Courier New", monospace);
}
.inline-cmd-status.visible { display: block; }
.inline-cmd-status.error { color: var(--vscode-errorForeground, #f48771); }

/* ── Action buttons row ─────────────────────────────────────── */
.inline-cmd-actions {
  display: none;
  gap: 4px;
  padding: 4px 8px 6px;
  justify-content: flex-end;
  align-items: center;
}
.inline-cmd-actions.visible { display: flex; }

.inline-cmd-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 11px;
  line-height: 16px;
  font-family: inherit;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, color .1s;
}
.inline-cmd-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

/* Primary (Accept) */
.inline-cmd-btn-primary {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
}
.inline-cmd-btn-primary:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}

/* Secondary (Discard, Retry) */
.inline-cmd-btn-secondary {
  background: var(--vscode-button-secondaryBackground, rgba(255,255,255,.1));
  color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground, #cccccc));
}
.inline-cmd-btn-secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,.15));
}

/* ── Selection badge ────────────────────────────────────────── */
.inline-cmd-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 11px;
  line-height: 16px;
  background: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ffffff);
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Real-time preview decorations (diff-style) ─────────────── */
.inline-cmd-preview-added {
  background: rgba(155, 185, 85, 0.15) !important;
}
.inline-cmd-preview-gutter {
  border-left: 3px solid var(--vscode-editorGutter-addedBackground, #2ea043) !important;
  margin-left: 3px;
}

/* ── Removed / replaced lines (selection diff) ──────────────── */
.inline-cmd-preview-removed {
  background: rgba(255, 68, 68, 0.10) !important;
}
.inline-cmd-preview-removed-gutter {
  border-left: 3px solid var(--vscode-editorGutter-deletedBackground, #f85149) !important;
  margin-left: 3px;
}
.inline-cmd-preview-removed-text {
  opacity: 0.6;
}
`;

  const el = document.createElement("style");
  el.id = "inline-command-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

/* ── SVG Icons (VS Code Codicon-style) ─────────────────────── */

const ICONS = {
  sparkle: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5l1.286 3.714L13 6.5l-3.714 1.286L8 11.5 6.714 7.786 3 6.5l3.714-1.286L8 1.5zM3 11l.75 2.25L6 14l-2.25.75L3 17l-.75-2.25L0 14l2.25-.75L3 11z"/></svg>`,
  send: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.724 1.053a.5.5 0 0 1 .54-.068l12 6a.5.5 0 0 1 0 .894l-12 6A.5.5 0 0 1 1.5 13.5v-4.379l6.854-1.027a.25.25 0 0 0 0-.494L1.5 6.573V2.5a.5.5 0 0 1 .224-.447z"/></svg>`,
  stop: `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>`,
  accept: `<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z"/></svg>`,
  discard: `<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>`,
  retry: `<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.5 2v3.5H7V4.593c2.866.154 5.167 2.466 5.307 5.334A5.5 5.5 0 0 1 2.59 12H1.5A6.5 6.5 0 0 0 13.312 9.84C13.128 6.44 10.367 3.7 6.96 3.54L7 2H3.5z"/></svg>`,
};

/* ── Factory ───────────────────────────────────────────────── */

export function createInlineCommandPlugin(
  options: InlineCommandPluginOptions,
): MonacoPlugin {
  let activeWidget: InlineCommandWidget | null = null;

  return {
    id: PLUGIN_ID,
    name: "Inline Command",
    version: "1.0.0",
    description: "Ctrl+I inline AI command input (VS Code-style)",
    defaultEnabled: true,

    onMount(ctx: PluginContext) {
      injectStyles();
      const { monaco, editor } = ctx;

      // Register Ctrl+I action
      ctx.addAction({
        id: ACTION_ID,
        label: "Inline Command: Open AI Input",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
        precondition: "editorTextFocus",
        run: () => {
          if (activeWidget) {
            activeWidget.dispose();
            activeWidget = null;
            return;
          }
          activeWidget = new InlineCommandWidget(monaco, editor, ctx, options, () => {
            activeWidget = null;
          });
        },
      });

      // Also dismiss on Escape when widget is open
      ctx.addAction({
        id: "inline-command.close",
        label: "Inline Command: Close",
        keybindings: [monaco.KeyCode.Escape],
        precondition: "editorTextFocus",
        run: () => {
          if (activeWidget) {
            activeWidget.dispose();
            activeWidget = null;
          }
        },
      });
    },

    onDispose() {
      if (activeWidget) {
        activeWidget.dispose();
        activeWidget = null;
      }
    },
  };
}

/* ── Widget Implementation ─────────────────────────────────── */

class InlineCommandWidget {
  private root: HTMLDivElement;
  private inputEl: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private progressEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private actionsEl: HTMLDivElement;

  // Editor integration
  private zoneId: string | null = null;
  private widgetLineNumber: number;
  private contentWidget: monacoNs.editor.IContentWidget;
  private disposed = false;

  // Streaming state
  private abortController: AbortController | null = null;
  private isStreaming = false;

  // Insertion tracking
  private cursorPosition: monacoNs.IPosition;
  private selection: monacoNs.Selection | null;
  private hasSelection: boolean;
  private insertLine: number;
  private insertCol: number;
  private insertEndLine: number;
  private insertEndCol: number;
  private hasPreview = false;
  private previewDecorationIds: string[] = [];
  private modelVersionBeforeEdit = 0;

  // Streaming fence detection
  private firstLineBuffer = "";
  private firstLineResolved = false;
  private openingFenceDetected = false;

  constructor(
    private monaco: Monaco,
    private editor: monacoNs.editor.IStandaloneCodeEditor,
    private ctx: PluginContext,
    private options: InlineCommandPluginOptions,
    private onClose: () => void,
  ) {
    this.cursorPosition = editor.getPosition() ?? { lineNumber: 1, column: 1 };
    this.selection = editor.getSelection();
    this.hasSelection = this.selection ? !this.selection.isEmpty() : false;

    // Where the widget visually sits (ABOVE this line)
    this.widgetLineNumber = this.hasSelection
      ? this.selection!.startLineNumber
      : this.cursorPosition.lineNumber;

    // Where generated code will be inserted
    if (this.hasSelection) {
      // Insert AFTER the selection (on a new line below it)
      this.insertLine = this.selection!.endLineNumber + 1;
      this.insertCol = 1;
    } else {
      this.insertLine = this.cursorPosition.lineNumber;
      this.insertCol = this.cursorPosition.column;
    }
    this.insertEndLine = this.insertLine;
    this.insertEndCol = this.insertCol;

    /* ── Root ──────────────────────────────────────────── */
    this.root = document.createElement("div");
    this.root.className = "inline-cmd-root";

    /* ── Header (icon + input + badge? + submit) ──────── */
    const header = document.createElement("div");
    header.className = "inline-cmd-header";

    const iconWrap = document.createElement("span");
    iconWrap.className = "inline-cmd-icon";
    iconWrap.innerHTML = ICONS.sparkle;
    header.appendChild(iconWrap);

    const inputWrap = document.createElement("div");
    inputWrap.className = "inline-cmd-input-wrap";

    this.inputEl = document.createElement("input");
    this.inputEl.className = "inline-cmd-input";
    this.inputEl.type = "text";
    this.inputEl.placeholder = this.hasSelection
      ? "Describe how to change the selection..."
      : "Ask AI to generate code here...";
    this.inputEl.spellcheck = false;
    this.inputEl.autocomplete = "off";
    inputWrap.appendChild(this.inputEl);
    header.appendChild(inputWrap);

    if (this.hasSelection) {
      const model = editor.getModel();
      const selLines = this.selection!.endLineNumber - this.selection!.startLineNumber + 1;
      const badge = document.createElement("span");
      badge.className = "inline-cmd-badge";
      badge.textContent = selLines === 1 ? "1 line selected" : `${selLines} lines selected`;
      badge.title = model ? model.getValueInRange(this.selection!).slice(0, 200) : "";
      header.appendChild(badge);
    }

    this.submitBtn = document.createElement("button");
    this.submitBtn.className = "inline-cmd-submit";
    this.submitBtn.title = "Submit (Enter)";
    this.submitBtn.innerHTML = ICONS.send;
    header.appendChild(this.submitBtn);

    this.root.appendChild(header);

    /* ── Progress bar ─────────────────────────────────── */
    this.progressEl = document.createElement("div");
    this.progressEl.className = "inline-cmd-progress";
    this.root.appendChild(this.progressEl);

    /* ── Status text ──────────────────────────────────── */
    this.statusEl = document.createElement("div");
    this.statusEl.className = "inline-cmd-status";
    this.root.appendChild(this.statusEl);

    /* ── Action buttons ───────────────────────────────── */
    this.actionsEl = document.createElement("div");
    this.actionsEl.className = "inline-cmd-actions";
    this.root.appendChild(this.actionsEl);

    /* ── Position in editor ────────────────────────────── */
    this.createViewZone(2.4);

    this.contentWidget = {
      getId: () => WIDGET_ID,
      getDomNode: () => this.root,
      getPosition: () => ({
        position: { lineNumber: this.widgetLineNumber, column: 1 },
        preference: [
          this.monaco.editor.ContentWidgetPositionPreference.ABOVE,
        ],
      }),
    };
    this.editor.addContentWidget(this.contentWidget);

    requestAnimationFrame(() => {
      if (!this.disposed) this.inputEl.focus();
    });

    /* ── Events ────────────────────────────────────────── */
    this.inputEl.addEventListener("keydown", this.handleKeyDown);
    this.root.addEventListener("keydown", this.handleRootKeyDown);
    this.root.addEventListener("focusout", this.handleBlur);
    this.submitBtn.addEventListener("click", this.handleSubmitClick);
  }

  /* ── View Zone ───────────────────────────────────────── */

  private createViewZone(heightInLines = 2.4) {
    this.editor.changeViewZones((accessor) => {
      const dom = document.createElement("div");
      this.zoneId = accessor.addZone({
        afterLineNumber: Math.max(0, this.widgetLineNumber - 1),
        heightInLines,
        domNode: dom,
        suppressMouseDown: true,
      });
    });
  }

  private removeViewZone() {
    if (this.zoneId) {
      const id = this.zoneId;
      this.editor.changeViewZones((accessor) => accessor.removeZone(id));
      this.zoneId = null;
    }
  }

  /* ── Event Handlers ──────────────────────────────────── */

  private handleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (this.isStreaming) return;
      const cmd = this.inputEl.value.trim();
      if (cmd) this.executeCommand(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (this.isStreaming) this.abortController?.abort();
      this.close();
    }
  };

  // Catch Escape from buttons or any other child
  private handleRootKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (this.isStreaming) this.abortController?.abort();
      this.close();
    }
  };

  private handleBlur = () => {
    setTimeout(() => {
      if (
        !this.disposed &&
        !this.isStreaming &&
        !this.hasPreview &&
        !this.root.contains(document.activeElement)
      ) {
        this.close();
      }
    }, 200);
  };

  private handleSubmitClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.isStreaming) {
      this.abortController?.abort();
      return;
    }
    const cmd = this.inputEl.value.trim();
    if (cmd) this.executeCommand(cmd);
  };

  /* ── Progress helpers ────────────────────────────────── */

  private showProgress() {
    this.progressEl.classList.add("active");
    this.progressEl.innerHTML = '<div class="inline-cmd-progress-bar"></div>';
  }

  private hideProgress() {
    this.progressEl.classList.remove("active");
    this.progressEl.innerHTML = "";
  }

  private setStatus(text: string, isError = false) {
    if (this.disposed) return;
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle("visible", true);
    this.statusEl.classList.toggle("error", isError);
  }

  /* ── Streaming fence detection ───────────────────────── */

  private processStreamToken(token: string): string {
    if (this.firstLineResolved) return token;

    this.firstLineBuffer += token;
    const nlIdx = this.firstLineBuffer.indexOf("\n");
    if (nlIdx === -1) return ""; // Buffer until first newline

    this.firstLineResolved = true;
    const firstLine = this.firstLineBuffer.slice(0, nlIdx).trim();

    if (/^```[\w]*$/.test(firstLine)) {
      // Opening fence — skip it
      this.openingFenceDetected = true;
      const rest = this.firstLineBuffer.slice(nlIdx + 1);
      this.firstLineBuffer = "";
      return rest;
    }

    // Not a fence — return everything
    const all = this.firstLineBuffer;
    this.firstLineBuffer = "";
    return all;
  }

  private flushStreamBuffer(): string {
    if (!this.firstLineResolved) {
      this.firstLineResolved = true;
      const text = this.firstLineBuffer;
      this.firstLineBuffer = "";
      if (/^```[\w]*$/.test(text.trim())) return "";
      return text;
    }
    return "";
  }

  private cleanupTrailingFence() {
    if (!this.openingFenceDetected || !this.hasPreview) return;
    const model = this.editor.getModel();
    if (!model) return;

    const range = new this.monaco.Range(
      this.insertLine, this.insertCol,
      this.insertEndLine, this.insertEndCol,
    );
    const text = model.getValueInRange(range);
    const cleaned = text.replace(/\n?```\s*$/, "");
    if (cleaned === text) return;

    this.editor.executeEdits("inline-command-cleanup", [
      { range, text: cleaned, forceMoveMarkers: true },
    ]);
    this.recalcEndPosition(cleaned);
    this.updatePreviewDecorations();
  }

  /* ── Real-time insertion ─────────────────────────────── */

  private insertChunk(text: string) {
    if (!text || this.disposed) return;

    const range = new this.monaco.Range(
      this.insertEndLine, this.insertEndCol,
      this.insertEndLine, this.insertEndCol,
    );

    this.editor.executeEdits("inline-command", [
      { range, text, forceMoveMarkers: true },
    ]);

    this.hasPreview = true;

    // Advance the end position
    const lines = text.split("\n");
    if (lines.length === 1) {
      this.insertEndCol += lines[0].length;
    } else {
      this.insertEndLine += lines.length - 1;
      this.insertEndCol = lines[lines.length - 1].length + 1;
    }

    this.updatePreviewDecorations();
    this.editor.revealLine(this.insertEndLine, this.monaco.editor.ScrollType.Smooth);
  }

  private updatePreviewDecorations() {
    const decorations: monacoNs.editor.IModelDeltaDecoration[] = [];

    // Red decorations on original selected lines (selection mode only)
    if (this.hasSelection) {
      for (
        let line = this.selection!.startLineNumber;
        line <= this.selection!.endLineNumber;
        line++
      ) {
        decorations.push({
          range: new this.monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "inline-cmd-preview-removed",
            linesDecorationsClassName: "inline-cmd-preview-removed-gutter",
            inlineClassName: "inline-cmd-preview-removed-text",
            overviewRuler: {
              color: "rgba(248, 81, 73, 0.6)",
              position: this.monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
      }
    }

    // Green decorations on generated lines
    if (this.hasPreview) {
      for (let line = this.insertLine; line <= this.insertEndLine; line++) {
        decorations.push({
          range: new this.monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "inline-cmd-preview-added",
            linesDecorationsClassName: "inline-cmd-preview-gutter",
            overviewRuler: {
              color: "rgba(46, 160, 67, 0.6)",
              position: this.monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
      }
    }

    this.previewDecorationIds = this.editor.deltaDecorations(
      this.previewDecorationIds,
      decorations,
    );
  }

  private clearPreviewDecorations() {
    if (this.previewDecorationIds.length) {
      this.previewDecorationIds = this.editor.deltaDecorations(this.previewDecorationIds, []);
    }
  }

  private recalcEndPosition(text: string) {
    const lines = text.split("\n");
    if (lines.length === 1) {
      this.insertEndLine = this.insertLine;
      this.insertEndCol = this.insertCol + lines[0].length;
    } else {
      this.insertEndLine = this.insertLine + lines.length - 1;
      this.insertEndCol = lines[lines.length - 1].length + 1;
    }
  }

  /* ── Undo to before-edit state ───────────────────────── */

  private undoToBeforeEdit() {
    const model = this.editor.getModel();
    if (!model) return;

    let safety = 500;
    while (
      model.getAlternativeVersionId() !== this.modelVersionBeforeEdit &&
      safety > 0
    ) {
      this.editor.trigger("inline-command", "undo", null);
      safety--;
    }
  }

  /* ── Command Execution ───────────────────────────────── */

  private async executeCommand(command: string) {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.inputEl.disabled = true;

    this.submitBtn.innerHTML = ICONS.stop;
    this.submitBtn.title = "Stop generating";
    this.showProgress();
    this.setStatus("Generating...");

    const model = this.editor.getModel();
    const language = model?.getLanguageId() ?? "plaintext";
    const filePath = this.ctx.getFilePath() ?? "untitled";
    const filename = filePath.split("/").pop() ?? "untitled";
    const selectedText =
      this.hasSelection && model
        ? model.getValueInRange(this.selection!)
        : "";
    const fullContent = model?.getValue() ?? "";

    // Context lines around cursor
    const radius = 30;
    const startLine = Math.max(1, this.cursorPosition.lineNumber - radius);
    const endLine = Math.min(model?.getLineCount() ?? 1, this.cursorPosition.lineNumber + radius);
    const contextLines: string[] = [];
    if (model) {
      for (let i = startLine; i <= endLine; i++) contextLines.push(model.getLineContent(i));
    }

    // Detect base indentation at cursor line
    const cursorLineText = model?.getLineContent(this.cursorPosition.lineNumber) ?? "";
    const baseIndent = cursorLineText.match(/^(\s*)/)?.[1] ?? "";

    const request: ChatRequest = {
      question: selectedText
        ? `The user selected this code:\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\nInstruction: ${command}\n\nIMPORTANT: Respond ONLY with the NEW code that should REPLACE the selected code. Do NOT repeat or include the original selected code unless the instruction requires modifying it. No explanation, no markdown fences. Match the existing indentation (base indent: "${baseIndent}").`
        : `File: ${filename} (${language})\nCursor at line ${this.cursorPosition.lineNumber}, column ${this.cursorPosition.column}.\n\nContext around cursor:\n\`\`\`${language}\n${contextLines.join("\n")}\n\`\`\`\n\nInstruction: ${command}\n\nRespond ONLY with the code to insert. No explanation, no markdown fences. Match the existing indentation (base indent: "${baseIndent}").`,
      language,
      context: fullContent.slice(0, 8000),
      filename,
      selection: selectedText || undefined,
      cursorPosition: {
        lineNumber: this.cursorPosition.lineNumber,
        column: this.cursorPosition.column,
      },
      providerId: this.options.providerId,
      modelId: this.options.modelId,
    };

    // Save model version for undo capability
    this.modelVersionBeforeEdit = model?.getAlternativeVersionId() ?? 0;
    this.editor.pushUndoStop();

    // Selection mode: keep original text visible with red decorations.
    // Insert a separator newline AFTER the selection so generated code
    // streams onto lines below it (shown in green).
    if (this.hasSelection) {
      const selEndLine = this.selection!.endLineNumber;
      const selEndMaxCol = model!.getLineMaxColumn(selEndLine);
      this.editor.executeEdits("inline-command-sep", [
        {
          range: new this.monaco.Range(selEndLine, selEndMaxCol, selEndLine, selEndMaxCol),
          text: "\n",
          forceMoveMarkers: false,
        },
      ]);
      this.insertLine = selEndLine + 1;
      this.insertEndLine = selEndLine + 1;
      this.insertEndCol = 1;
      // Show red decorations on original selection immediately
      this.updatePreviewDecorations();
    }

    // Reset fence detection state
    this.firstLineBuffer = "";
    this.firstLineResolved = false;
    this.openingFenceDetected = false;

    this.abortController = new AbortController();
    let accumulated = "";

    try {
      await streamChat(
        this.options.endpoint,
        request,
        (chunk: ChatStreamChunk) => {
          if (this.disposed) return;
          if (chunk.error) {
            this.setStatus(`Error: ${chunk.error}`, true);
            this.finishGeneration();
            return;
          }
          if (chunk.done) {
            // Flush any remaining buffered text
            const remaining = this.flushStreamBuffer();
            if (remaining) this.insertChunk(remaining);
            this.cleanupTrailingFence();
            const lineCount = this.insertEndLine - this.insertLine + 1;
            this.setStatus(
              this.hasPreview
                ? `Done — ${lineCount} line${lineCount > 1 ? "s" : ""} generated`
                : "Done — no output",
            );
            this.finishGeneration();
            return;
          }
          if (chunk.content) {
            accumulated += chunk.content;
            const toInsert = this.processStreamToken(chunk.content);
            if (toInsert) this.insertChunk(toInsert);
            this.setStatus(`Generating... ${accumulated.length} chars`);
          }
        },
        this.abortController.signal,
        this.options.hostId,
      );
    } catch (err: any) {
      if (err?.name === "AbortError") {
        const remaining = this.flushStreamBuffer();
        if (remaining) this.insertChunk(remaining);
        this.cleanupTrailingFence();
        this.setStatus("Cancelled");
        this.finishGeneration();
        return;
      }
      this.setStatus(`Error: ${err?.message ?? "Request failed"}`, true);
      this.finishGeneration();
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /* ── Finish & show action buttons ────────────────────── */

  private finishGeneration() {
    if (this.disposed) return;
    this.hideProgress();
    this.submitBtn.innerHTML = ICONS.send;
    this.submitBtn.title = "Submit (Enter)";

    // Resize view zone for buttons
    this.removeViewZone();
    this.createViewZone(3.8);
    this.editor.layoutContentWidget(this.contentWidget);

    this.actionsEl.innerHTML = "";
    this.actionsEl.classList.add("visible");

    if (this.hasPreview) {
      const acceptBtn = this.makeButton("Accept", ICONS.accept, "inline-cmd-btn-primary", () => {
        this.acceptCode();
      });
      this.actionsEl.appendChild(acceptBtn);
    }

    const discardBtn = this.makeButton("Discard", ICONS.discard, "inline-cmd-btn-secondary", () => {
      this.rejectCode();
    });
    this.actionsEl.appendChild(discardBtn);

    const retryBtn = this.makeButton("Retry", ICONS.retry, "inline-cmd-btn-secondary", () => {
      this.retryCommand();
    });
    this.actionsEl.appendChild(retryBtn);
  }

  private makeButton(
    label: string, icon: string, cls: string, onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `inline-cmd-btn ${cls}`;
    btn.innerHTML = `${icon}<span>${label}</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  /* ── Accept / Discard / Retry ────────────────────────── */

  /** Accept: finalize generated code into the editor. */
  private acceptCode() {
    const model = this.editor.getModel();
    this.clearPreviewDecorations();

    if (this.hasSelection && this.hasPreview && model) {
      // Read the generated text before undoing
      const genRange = new this.monaco.Range(
        this.insertLine, 1,
        this.insertEndLine, this.insertEndCol,
      );
      const generatedText = model.getValueInRange(genRange);

      // Undo everything (separator newline + generated text) back to original
      this.undoToBeforeEdit();

      // Now cleanly replace the original selection with the generated text
      this.editor.executeEdits("inline-command-accept", [
        { range: this.selection!, text: generatedText, forceMoveMarkers: true },
      ]);
    }

    // For non-selection mode: generated text is already in place, just keep it
    this.editor.pushUndoStop();
    this.hasPreview = false;
    this.close();
  }

  /** Discard: remove all generated code by undoing to pre-edit state. */
  private rejectCode() {
    this.clearPreviewDecorations();
    this.undoToBeforeEdit();
    this.hasPreview = false;
    this.close();
  }

  /** Retry: undo, reset widget for a new prompt. */
  private retryCommand() {
    this.clearPreviewDecorations();
    this.undoToBeforeEdit();
    this.hasPreview = false;

    // Reset insert tracking
    if (this.hasSelection) {
      this.insertLine = this.selection!.endLineNumber + 1;
      this.insertCol = 1;
    }
    this.insertEndLine = this.insertLine;
    this.insertEndCol = this.insertCol;

    // Reset UI
    this.actionsEl.innerHTML = "";
    this.actionsEl.classList.remove("visible");
    this.statusEl.classList.remove("visible");
    this.inputEl.disabled = false;
    this.inputEl.value = "";
    this.inputEl.focus();
    this.isStreaming = false;

    // Reset view zone
    this.removeViewZone();
    this.createViewZone(2.4);
    this.editor.layoutContentWidget(this.contentWidget);
  }

  /* ── Cleanup ─────────────────────────────────────────── */

  private close() {
    this.dispose();
    this.onClose();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    this.abortController?.abort();

    // If there's un-accepted preview code, undo it (same as discard)
    if (this.hasPreview) {
      this.clearPreviewDecorations();
      this.undoToBeforeEdit();
    }

    this.inputEl.removeEventListener("keydown", this.handleKeyDown);
    this.root.removeEventListener("keydown", this.handleRootKeyDown);
    this.root.removeEventListener("focusout", this.handleBlur);
    this.submitBtn.removeEventListener("click", this.handleSubmitClick);

    this.editor.removeContentWidget(this.contentWidget);
    this.removeViewZone();
    this.editor.focus();
  }
}

/* ── Helpers ───────────────────────────────────────────────── */

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[\w]*\n([\s\S]*?)\n?```$/);
  return match ? match[1] : trimmed;
}
