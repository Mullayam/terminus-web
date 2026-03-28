/**
 * @module monaco-editor/plugins/inline-command-plugin
 *
 * VS Code-style inline command input (Ctrl+I).
 *
 * Features:
 *   - Multi-line textarea (Shift+Enter for newlines)
 *   - Prompt history (Up/Down arrow)
 *   - Slash commands (/explain, /refactor, /test, /fix, /docs, /optimize)
 *   - Model/provider selector dropdown
 *   - Token count display during streaming
 *   - Skeleton loading animation (ghost pulse before first token)
 *   - Widget horizontal resize (drag handle)
 *   - Multi-turn conversation memory within a session
 *   - Accessibility (ARIA labels, focus management, screen reader)
 *   - Minimap decorations for diff lines
 *   - Error recovery with keep-partial option
 *   - Real-time diff preview (red/green decorations)
 *   - Keyboard shortcuts: Ctrl+Enter accept, Ctrl+Backspace discard, Ctrl+Shift+Enter retry
 *
 * Usage:
 *   import { createInlineCommandPlugin } from "@/modules/monaco-editor";
 *   const inlineCmd = createInlineCommandPlugin({ endpoint: "http://localhost:7145" });
 *   <MonacoEditor plugins={[inlineCmd]} />
 */

import type * as monacoNs from "monaco-editor";
import type { MonacoPlugin, PluginContext } from "../types";
import { streamChat, fetchProviders } from "../chat/api";
import type { ChatRequest, ChatStreamChunk, ChatProvider, ChatRole } from "../chat/types";

type Monaco = typeof monacoNs;

/* == Configuration ================================================ */

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

/* == Constants ==================================================== */

const PLUGIN_ID = "builtin-inline-command";
const WIDGET_ID = "inline-command-widget";
const ACTION_ID = "inline-command.open";
const MAX_HISTORY = 50;

/* == Slash Commands =============================================== */

interface SlashCommand {
  name: string;
  label: string;
  description: string;
  systemPrefix: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/explain",
    label: "/explain",
    description: "Explain the selected code",
    systemPrefix:
      "Explain the following code clearly and concisely. Provide a brief summary then explain key parts:\n\n",
  },
  {
    name: "/refactor",
    label: "/refactor",
    description: "Refactor and improve code quality",
    systemPrefix:
      "Refactor the following code to improve readability, performance, and maintainability. Return ONLY the refactored code:\n\n",
  },
  {
    name: "/test",
    label: "/test",
    description: "Generate unit tests",
    systemPrefix:
      "Generate comprehensive unit tests for the following code. Use the appropriate testing framework for the language. Return ONLY the test code:\n\n",
  },
  {
    name: "/fix",
    label: "/fix",
    description: "Fix bugs and issues",
    systemPrefix:
      "Fix any bugs, errors, or issues in the following code. Return ONLY the fixed code:\n\n",
  },
  {
    name: "/docs",
    label: "/docs",
    description: "Generate documentation / JSDoc",
    systemPrefix:
      "Add comprehensive documentation comments (JSDoc/docstrings) to the following code. Return ONLY the documented code:\n\n",
  },
  {
    name: "/optimize",
    label: "/optimize",
    description: "Optimize for performance",
    systemPrefix:
      "Optimize the following code for better performance while maintaining readability. Return ONLY the optimized code:\n\n",
  },
];

/* == Prompt History (shared across widget instances) =============== */

const promptHistory: string[] = [];

function pushHistory(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return;
  const idx = promptHistory.indexOf(trimmed);
  if (idx !== -1) promptHistory.splice(idx, 1);
  promptHistory.push(trimmed);
  if (promptHistory.length > MAX_HISTORY) promptHistory.shift();
}

/* == Provider cache (shared across widget instances) =============== */

let cachedProviders: ChatProvider[] | null = null;
let providersFetchPromise: Promise<ChatProvider[]> | null = null;

async function getProviders(
  endpoint: string,
  hostId?: string,
): Promise<ChatProvider[]> {
  if (cachedProviders) return cachedProviders;
  if (providersFetchPromise) return providersFetchPromise;
  providersFetchPromise = fetchProviders(endpoint, hostId)
    .then((providers) => {
      cachedProviders = providers;
      return providers;
    })
    .catch(() => {
      cachedProviders = [];
      return [] as ChatProvider[];
    })
    .finally(() => {
      providersFetchPromise = null;
    });
  return providersFetchPromise;
}


/* == Inject global CSS once ======================================= */

let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const css = `
/* -- Inline Command Widget -- VS Code style -- */
.inline-cmd-root {
  position: relative;
  z-index: 100;
  width: 520px;
  min-width: 320px;
  max-width: min(800px, 95vw);
  border-radius: 8px;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-contrastBorder, rgba(255,255,255,.08)));
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e));
  box-shadow: 0 0 0 1px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.35);
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground, #cccccc));
  overflow: hidden;
}
.inline-cmd-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  z-index: 101;
  background: transparent;
  transition: background .15s;
}
.inline-cmd-resize-handle:hover,
.inline-cmd-resize-handle.active {
  background: var(--vscode-focusBorder, #007fd4);
  border-radius: 0 8px 8px 0;
}
.inline-cmd-header {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 4px 6px 4px 2px;
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
  margin-top: 1px;
}
.inline-cmd-icon svg { width: 16px; height: 16px; }
.inline-cmd-input-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}
.inline-cmd-textarea {
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
  resize: none;
  overflow-y: auto;
  max-height: 120px;
  min-height: 22px;
}
.inline-cmd-textarea::placeholder {
  color: var(--vscode-input-placeholderForeground, rgba(204,204,204,.5));
}
.inline-cmd-textarea:disabled { opacity: .5; }
.inline-cmd-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
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
.inline-cmd-submit:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
.inline-cmd-submit:disabled { opacity: .4; cursor: default; }
.inline-cmd-submit svg { width: 14px; height: 14px; }
.inline-cmd-model-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-descriptionForeground, rgba(204,204,204,.6));
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background .1s, color .1s;
}
.inline-cmd-model-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,.08));
  color: var(--vscode-editor-foreground, #cccccc);
}
.inline-cmd-model-btn svg { width: 10px; height: 10px; flex-shrink: 0; }
.inline-cmd-model-dropdown {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 4px;
  min-width: 200px;
  max-width: 300px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 200;
  border-radius: 6px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,.08));
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e));
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
  padding: 4px;
}
.inline-cmd-model-group-title {
  padding: 4px 8px 2px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--vscode-descriptionForeground, rgba(204,204,204,.5));
}
.inline-cmd-model-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--vscode-editor-foreground, #cccccc);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.inline-cmd-model-item:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,.06)); }
.inline-cmd-model-item.active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
  color: var(--vscode-list-activeSelectionForeground, #ffffff);
}
.inline-cmd-model-item .check-icon { width: 14px; flex-shrink: 0; text-align: center; }
.inline-cmd-slash-dropdown {
  position: absolute;
  bottom: calc(100% + 2px);
  left: 0;
  min-width: 220px;
  max-width: 320px;
  z-index: 200;
  border-radius: 6px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,.08));
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e));
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
  padding: 4px;
}
.inline-cmd-slash-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--vscode-editor-foreground, #cccccc);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.inline-cmd-slash-item:hover,
.inline-cmd-slash-item.active { background: var(--vscode-list-hoverBackground, rgba(255,255,255,.06)); }
.inline-cmd-slash-item-name { font-weight: 600; color: var(--vscode-textLink-foreground, #3794ff); }
.inline-cmd-slash-item-desc { font-size: 11px; color: var(--vscode-descriptionForeground, rgba(204,204,204,.6)); }
.inline-cmd-progress { height: 2px; background: transparent; overflow: hidden; }
.inline-cmd-progress.active { background: var(--vscode-editorWidget-border, rgba(255,255,255,.04)); }
.inline-cmd-progress-bar {
  height: 100%; width: 30%;
  background: var(--vscode-progressBar-background, #0e70c0);
  border-radius: 1px;
  animation: inline-cmd-slide 1.2s ease-in-out infinite;
}
@keyframes inline-cmd-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(430%); } }
.inline-cmd-skeleton { display: none; padding: 6px 10px; gap: 6px; flex-direction: column; }
.inline-cmd-skeleton.visible { display: flex; }
.inline-cmd-skeleton-line {
  height: 12px; border-radius: 3px;
  background: var(--vscode-editorWidget-border, rgba(255,255,255,.06));
  animation: inline-cmd-pulse 1.5s ease-in-out infinite;
}
.inline-cmd-skeleton-line:nth-child(1) { width: 85%; }
.inline-cmd-skeleton-line:nth-child(2) { width: 65%; animation-delay: .15s; }
.inline-cmd-skeleton-line:nth-child(3) { width: 45%; animation-delay: .3s; }
@keyframes inline-cmd-pulse { 0%, 100% { opacity: .3; } 50% { opacity: .7; } }
.inline-cmd-status {
  display: none; padding: 4px 10px 2px; font-size: 11px; line-height: 16px;
  color: var(--vscode-descriptionForeground, rgba(204,204,204,.7));
  font-family: var(--vscode-editor-font-family, Consolas, "Courier New", monospace);
}
.inline-cmd-status.visible { display: flex; align-items: center; gap: 6px; }
.inline-cmd-status.error { color: var(--vscode-errorForeground, #f48771); }
.inline-cmd-status .token-count {
  margin-left: auto; font-size: 10px;
  color: var(--vscode-descriptionForeground, rgba(204,204,204,.5));
}
.inline-cmd-actions { display: none; gap: 4px; padding: 4px 8px 6px; flex-wrap: wrap; align-items: center; }
.inline-cmd-actions.visible { display: flex; }
.inline-cmd-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
  font-size: 11px; line-height: 16px; font-family: inherit;
  border-radius: 2px; border: none; cursor: pointer;
  white-space: nowrap; transition: background .1s, color .1s;
}
.inline-cmd-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.inline-cmd-btn-primary {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
}
.inline-cmd-btn-primary:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
.inline-cmd-btn-secondary {
  background: var(--vscode-button-secondaryBackground, rgba(255,255,255,.1));
  color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground, #cccccc));
}
.inline-cmd-btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,.15)); }
.inline-cmd-kbd {
  display: inline-block; padding: 0 3px; margin-left: 4px;
  font-size: 10px; line-height: 14px; border-radius: 2px;
  background: rgba(255,255,255,.08);
  color: var(--vscode-descriptionForeground, rgba(204,204,204,.5));
  font-family: inherit;
}
.inline-cmd-actions-spacer { flex: 1; }
.inline-cmd-badge {
  display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px;
  border-radius: 2px; font-size: 11px; line-height: 16px;
  background: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ffffff);
  flex-shrink: 0; max-width: 120px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;
}
.inline-cmd-history {
  display: none; padding: 2px 8px 4px; gap: 4px; flex-wrap: wrap; align-items: center;
  border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,.06));
}
.inline-cmd-history.visible { display: flex; }
.inline-cmd-history-label { font-size: 10px; color: var(--vscode-descriptionForeground, rgba(204,204,204,.5)); margin-right: 2px; }
.inline-cmd-history-pill {
  display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 10px;
  font-size: 10px; background: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ffffff);
  max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.inline-cmd-history-clear {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border: none; border-radius: 3px;
  background: transparent; color: var(--vscode-descriptionForeground, rgba(204,204,204,.5));
  cursor: pointer; padding: 0; font-size: 11px;
}
.inline-cmd-history-clear:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,.08));
  color: var(--vscode-editor-foreground, #cccccc);
}
.inline-cmd-preview-added { background: rgba(155, 185, 85, 0.15) !important; }
.inline-cmd-preview-gutter { border-left: 3px solid var(--vscode-editorGutter-addedBackground, #2ea043) !important; margin-left: 3px; }
.inline-cmd-preview-removed { background: rgba(255, 68, 68, 0.10) !important; }
.inline-cmd-preview-removed-gutter { border-left: 3px solid var(--vscode-editorGutter-deletedBackground, #f85149) !important; margin-left: 3px; }
.inline-cmd-preview-removed-text { opacity: 0.6; }
.inline-cmd-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
`;

  const el = document.createElement("style");
  el.id = "inline-command-styles";
  el.textContent = css;
  document.head.appendChild(el);
}

/* == SVG Icons (VS Code Codicon-style) ============================ */

const ICONS = {
  sparkle: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5l1.286 3.714L13 6.5l-3.714 1.286L8 11.5 6.714 7.786 3 6.5l3.714-1.286L8 1.5zM3 11l.75 2.25L6 14l-2.25.75L3 17l-.75-2.25L0 14l2.25-.75L3 11z"/></svg>',
  send: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.724 1.053a.5.5 0 0 1 .54-.068l12 6a.5.5 0 0 1 0 .894l-12 6A.5.5 0 0 1 1.5 13.5v-4.379l6.854-1.027a.25.25 0 0 0 0-.494L1.5 6.573V2.5a.5.5 0 0 1 .224-.447z"/></svg>',
  stop: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>',
  accept: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z"/></svg>',
  discard: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>',
  retry: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.5 2v3.5H7V4.593c2.866.154 5.167 2.466 5.307 5.334A5.5 5.5 0 0 1 2.59 12H1.5A6.5 6.5 0 0 0 13.312 9.84C13.128 6.44 10.367 3.7 6.96 3.54L7 2H3.5z"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/></svg>',
  keepPartial: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 1H3L2 2v12l1 1h11l1-1V2l-1-1zM8 13H4V9h4v4zm6 0H9V9h5v4zm0-5H4V3h10v5z"/></svg>',
};

/* == Factory ====================================================== */

export function createInlineCommandPlugin(
  options: InlineCommandPluginOptions,
): MonacoPlugin {
  let activeWidget: InlineCommandWidget | null = null;

  return {
    id: PLUGIN_ID,
    name: "Inline Command",
    version: "2.0.0",
    description: "Ctrl+I inline AI command input with slash commands, multi-turn, model selector",
    defaultEnabled: true,

    onMount(ctx: PluginContext) {
      injectStyles();
      const { monaco, editor } = ctx;

      // Pre-fetch providers so dropdown is ready
      getProviders(options.endpoint, options.hostId).catch(() => {});

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

/* == Widget Implementation ======================================== */

class InlineCommandWidget {
  private root: HTMLDivElement;
  private textareaEl: HTMLTextAreaElement;
  private submitBtn: HTMLButtonElement;
  private progressEl: HTMLDivElement;
  private skeletonEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private actionsEl: HTMLDivElement;
  private historyEl: HTMLDivElement;
  private modelBtn: HTMLButtonElement;
  private slashDropdown: HTMLDivElement | null = null;
  private modelDropdown: HTMLDivElement | null = null;

  private zoneId: string | null = null;
  private widgetLineNumber: number;
  private contentWidget: monacoNs.editor.IContentWidget;
  private disposed = false;

  private abortController: AbortController | null = null;
  private isStreaming = false;

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

  private firstLineBuffer = "";
  private firstLineResolved = false;
  private openingFenceDetected = false;

  private historyIndex = -1;
  private currentDraft = "";

  private slashActiveIndex = 0;
  private filteredSlashCommands: SlashCommand[] = [];

  private selectedProviderId: string | undefined;
  private selectedModelId: string | undefined;

  private tokenCount = 0;

  private conversationHistory: Array<{ role: ChatRole; content: string }> = [];

  private resizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  private liveRegion: HTMLDivElement;

  constructor(
    private monaco: Monaco,
    private editor: monacoNs.editor.IStandaloneCodeEditor,
    private ctx: PluginContext,
    private options: InlineCommandPluginOptions,
    private onClose: () => void,
  ) {
    this.selectedProviderId = options.providerId;
    this.selectedModelId = options.modelId;

    this.cursorPosition = editor.getPosition() ?? { lineNumber: 1, column: 1 };
    this.selection = editor.getSelection();
    this.hasSelection = this.selection ? !this.selection.isEmpty() : false;

    this.widgetLineNumber = this.hasSelection
      ? this.selection!.startLineNumber
      : this.cursorPosition.lineNumber;

    if (this.hasSelection) {
      this.insertLine = this.selection!.endLineNumber + 1;
      this.insertCol = 1;
    } else {
      this.insertLine = this.cursorPosition.lineNumber;
      this.insertCol = this.cursorPosition.column;
    }
    this.insertEndLine = this.insertLine;
    this.insertEndCol = this.insertCol;

    /* -- ARIA live region -- */
    this.liveRegion = document.createElement("div");
    this.liveRegion.className = "inline-cmd-sr-only";
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");

    /* -- Root -- */
    this.root = document.createElement("div");
    this.root.className = "inline-cmd-root";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Inline AI Command");
    this.root.appendChild(this.liveRegion);

    /* -- Resize handle -- */
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "inline-cmd-resize-handle";
    resizeHandle.title = "Drag to resize";
    resizeHandle.addEventListener("mousedown", this.handleResizeStart);
    this.root.appendChild(resizeHandle);

    /* -- Conversation history row -- */
    this.historyEl = document.createElement("div");
    this.historyEl.className = "inline-cmd-history";
    this.root.appendChild(this.historyEl);

    /* -- Header -- */
    const header = document.createElement("div");
    header.className = "inline-cmd-header";

    const iconWrap = document.createElement("span");
    iconWrap.className = "inline-cmd-icon";
    iconWrap.innerHTML = ICONS.sparkle;
    iconWrap.setAttribute("aria-hidden", "true");
    header.appendChild(iconWrap);

    const inputWrap = document.createElement("div");
    inputWrap.className = "inline-cmd-input-wrap";

    this.textareaEl = document.createElement("textarea");
    this.textareaEl.className = "inline-cmd-textarea";
    this.textareaEl.rows = 1;
    this.textareaEl.placeholder = this.hasSelection
      ? "Describe how to change the selection\u2026 (/ for commands)"
      : "Ask AI to generate code here\u2026 (/ for commands)";
    this.textareaEl.spellcheck = false;
    this.textareaEl.autocomplete = "off";
    this.textareaEl.setAttribute("aria-label", "AI command input");
    this.textareaEl.setAttribute("aria-describedby", "inline-cmd-hints");
    inputWrap.appendChild(this.textareaEl);

    const hints = document.createElement("span");
    hints.id = "inline-cmd-hints";
    hints.className = "inline-cmd-sr-only";
    hints.textContent = "Type a prompt and press Enter to submit. Shift+Enter for new line. Use / for slash commands. Up/Down for history.";
    inputWrap.appendChild(hints);

    header.appendChild(inputWrap);

    /* -- Right column -- */
    const controlsCol = document.createElement("div");
    controlsCol.className = "inline-cmd-controls";

    if (this.hasSelection) {
      const selLines = this.selection!.endLineNumber - this.selection!.startLineNumber + 1;
      const badge = document.createElement("span");
      badge.className = "inline-cmd-badge";
      badge.textContent = selLines === 1 ? "1 line" : `${selLines} lines`;
      badge.title = editor.getModel()?.getValueInRange(this.selection!)?.slice(0, 200) ?? "";
      badge.setAttribute("aria-label", `${selLines} lines selected`);
      controlsCol.appendChild(badge);
    }

    this.submitBtn = document.createElement("button");
    this.submitBtn.className = "inline-cmd-submit";
    this.submitBtn.title = "Submit (Enter)";
    this.submitBtn.innerHTML = ICONS.send;
    this.submitBtn.setAttribute("aria-label", "Submit prompt");
    controlsCol.appendChild(this.submitBtn);

    this.modelBtn = document.createElement("button");
    this.modelBtn.className = "inline-cmd-model-btn";
    this.modelBtn.title = "Select AI model";
    this.modelBtn.setAttribute("aria-label", "Select AI model");
    this.modelBtn.setAttribute("aria-haspopup", "listbox");
    this.updateModelBtnLabel();
    controlsCol.appendChild(this.modelBtn);

    header.appendChild(controlsCol);
    this.root.appendChild(header);

    /* -- Progress bar -- */
    this.progressEl = document.createElement("div");
    this.progressEl.className = "inline-cmd-progress";
    this.progressEl.setAttribute("role", "progressbar");
    this.progressEl.setAttribute("aria-hidden", "true");
    this.root.appendChild(this.progressEl);

    /* -- Skeleton loading -- */
    this.skeletonEl = document.createElement("div");
    this.skeletonEl.className = "inline-cmd-skeleton";
    this.skeletonEl.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) {
      const line = document.createElement("div");
      line.className = "inline-cmd-skeleton-line";
      this.skeletonEl.appendChild(line);
    }
    this.root.appendChild(this.skeletonEl);

    /* -- Status text -- */
    this.statusEl = document.createElement("div");
    this.statusEl.className = "inline-cmd-status";
    this.statusEl.setAttribute("role", "status");
    this.root.appendChild(this.statusEl);

    /* -- Action buttons -- */
    this.actionsEl = document.createElement("div");
    this.actionsEl.className = "inline-cmd-actions";
    this.actionsEl.setAttribute("role", "toolbar");
    this.actionsEl.setAttribute("aria-label", "Code preview actions");
    this.root.appendChild(this.actionsEl);

    /* -- Position in editor -- */
    this.createViewZone(3);

    this.contentWidget = {
      getId: () => WIDGET_ID,
      getDomNode: () => this.root,
      getPosition: () => ({
        position: { lineNumber: this.widgetLineNumber, column: 1 },
        preference: [this.monaco.editor.ContentWidgetPositionPreference.ABOVE],
      }),
    };
    this.editor.addContentWidget(this.contentWidget);

    requestAnimationFrame(() => {
      if (!this.disposed) this.textareaEl.focus();
    });

    /* -- Events -- */
    this.textareaEl.addEventListener("keydown", this.handleKeyDown);
    this.textareaEl.addEventListener("input", this.handleInput);
    this.root.addEventListener("keydown", this.handleRootKeyDown);
    this.root.addEventListener("focusout", this.handleBlur);
    this.submitBtn.addEventListener("click", this.handleSubmitClick);
    this.modelBtn.addEventListener("click", this.handleModelBtnClick);
    document.addEventListener("mouseup", this.handleResizeEnd);
    document.addEventListener("mousemove", this.handleResizeMove);
  }

  /* -- View Zone -- */

  private createViewZone(heightInLines = 3) {
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

  /* -- ARIA announcements -- */

  private announce(text: string) {
    this.liveRegion.textContent = "";
    requestAnimationFrame(() => { this.liveRegion.textContent = text; });
  }

  /* -- Model selector -- */

  private updateModelBtnLabel() {
    const name = this.selectedModelId ?? "auto";
    const short = name.length > 12 ? name.slice(0, 12) + "\u2026" : name;
    this.modelBtn.innerHTML = `<span>${short}</span>${ICONS.chevron}`;
  }

  private handleModelBtnClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.modelDropdown) this.closeModelDropdown();
    else this.openModelDropdown();
  };

  private async openModelDropdown() {
    this.closeSlashDropdown();
    if (this.modelDropdown) return;

    const providers = await getProviders(this.options.endpoint, this.options.hostId);
    const dropdown = document.createElement("div");
    dropdown.className = "inline-cmd-model-dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "AI Models");

    if (providers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inline-cmd-model-group-title";
      empty.textContent = "No providers available";
      dropdown.appendChild(empty);
    }

    for (const provider of providers) {
      if (!provider.available || !provider.models?.length) continue;
      const title = document.createElement("div");
      title.className = "inline-cmd-model-group-title";
      title.textContent = provider.name;
      dropdown.appendChild(title);

      for (const model of provider.models) {
        const item = document.createElement("button");
        item.className = "inline-cmd-model-item";
        const isActive = this.selectedProviderId === provider.id && this.selectedModelId === model.id;
        if (isActive) item.classList.add("active");
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", isActive ? "true" : "false");

        const check = document.createElement("span");
        check.className = "check-icon";
        check.textContent = isActive ? "\u2713" : "";
        item.appendChild(check);

        const label = document.createElement("span");
        label.textContent = model.name;
        item.appendChild(label);

        if (model.maxTokens) {
          const tokens = document.createElement("span");
          tokens.style.marginLeft = "auto";
          tokens.style.fontSize = "10px";
          tokens.style.opacity = "0.5";
          tokens.textContent = `${Math.round(model.maxTokens / 1000)}k`;
          item.appendChild(tokens);
        }

        item.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.selectedProviderId = provider.id;
          this.selectedModelId = model.id;
          this.updateModelBtnLabel();
          this.closeModelDropdown();
          this.textareaEl.focus();
        });
        dropdown.appendChild(item);
      }
    }

    this.modelDropdown = dropdown;
    this.root.appendChild(dropdown);
  }

  private closeModelDropdown() {
    if (this.modelDropdown) { this.modelDropdown.remove(); this.modelDropdown = null; }
  }

  /* -- Slash command autocomplete -- */

  private handleInput = () => {
    this.autoResizeTextarea();
    this.updateSlashDropdown();
  };

  private autoResizeTextarea() {
    const ta = this.textareaEl;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  private updateSlashDropdown() {
    const value = this.textareaEl.value;
    if (value.startsWith("/") && !value.includes(" ")) {
      const query = value.slice(1).toLowerCase();
      this.filteredSlashCommands = SLASH_COMMANDS.filter((c) => c.name.slice(1).startsWith(query));
      if (this.filteredSlashCommands.length > 0) {
        this.slashActiveIndex = 0;
        this.openSlashDropdown();
        return;
      }
    }
    this.closeSlashDropdown();
  }

  private openSlashDropdown() {
    this.closeModelDropdown();
    if (this.slashDropdown) this.slashDropdown.remove();

    const dropdown = document.createElement("div");
    dropdown.className = "inline-cmd-slash-dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "Slash commands");

    this.filteredSlashCommands.forEach((cmd, i) => {
      const item = document.createElement("button");
      item.className = "inline-cmd-slash-item";
      if (i === this.slashActiveIndex) item.classList.add("active");
      item.setAttribute("role", "option");

      const name = document.createElement("span");
      name.className = "inline-cmd-slash-item-name";
      name.textContent = cmd.label;
      item.appendChild(name);

      const desc = document.createElement("span");
      desc.className = "inline-cmd-slash-item-desc";
      desc.textContent = cmd.description;
      item.appendChild(desc);

      item.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.applySlashCommand(cmd);
      });
      dropdown.appendChild(item);
    });

    this.slashDropdown = dropdown;
    this.textareaEl.parentElement!.appendChild(dropdown);
  }

  private closeSlashDropdown() {
    if (this.slashDropdown) { this.slashDropdown.remove(); this.slashDropdown = null; }
    this.filteredSlashCommands = [];
    this.slashActiveIndex = 0;
  }

  private applySlashCommand(cmd: SlashCommand) {
    this.textareaEl.value = cmd.name + " ";
    this.closeSlashDropdown();
    this.textareaEl.focus();
    this.autoResizeTextarea();
  }

  private navigateSlash(direction: number) {
    if (!this.filteredSlashCommands.length) return;
    this.slashActiveIndex = (this.slashActiveIndex + direction + this.filteredSlashCommands.length) % this.filteredSlashCommands.length;
    this.openSlashDropdown();
  }

  /* -- Conversation history UI -- */

  private updateConversationUI() {
    this.historyEl.innerHTML = "";
    if (this.conversationHistory.length === 0) {
      this.historyEl.classList.remove("visible");
      return;
    }
    this.historyEl.classList.add("visible");

    const turns = Math.floor(this.conversationHistory.length / 2);
    const label = document.createElement("span");
    label.className = "inline-cmd-history-label";
    label.textContent = `${turns} turn${turns !== 1 ? "s" : ""}`;
    this.historyEl.appendChild(label);

    const userMsgs = this.conversationHistory.filter((m) => m.role === "user");
    for (const msg of userMsgs.slice(-3)) {
      const pill = document.createElement("span");
      pill.className = "inline-cmd-history-pill";
      pill.textContent = msg.content.slice(0, 30);
      pill.title = msg.content;
      this.historyEl.appendChild(pill);
    }

    const clearBtn = document.createElement("button");
    clearBtn.className = "inline-cmd-history-clear";
    clearBtn.innerHTML = ICONS.discard;
    clearBtn.title = "Clear conversation";
    clearBtn.setAttribute("aria-label", "Clear conversation history");
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.conversationHistory = [];
      this.updateConversationUI();
    });
    this.historyEl.appendChild(clearBtn);
  }

  /* -- Resize handling -- */

  private handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.resizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.root.offsetWidth;
    this.root.querySelector(".inline-cmd-resize-handle")?.classList.add("active");
  };

  private handleResizeMove = (e: MouseEvent) => {
    if (!this.resizing) return;
    const dx = e.clientX - this.resizeStartX;
    const newWidth = Math.max(320, Math.min(800, this.resizeStartWidth + dx));
    this.root.style.width = newWidth + "px";
  };

  private handleResizeEnd = () => {
    if (!this.resizing) return;
    this.resizing = false;
    this.root.querySelector(".inline-cmd-resize-handle")?.classList.remove("active");
  };

  /* -- Event Handlers -- */

  private handleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();

    // Slash dropdown navigation
    if (this.slashDropdown && this.filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.navigateSlash(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.navigateSlash(-1); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        this.applySlashCommand(this.filteredSlashCommands[this.slashActiveIndex]);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); this.closeSlashDropdown(); return; }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (this.isStreaming) return;
      const cmd = this.textareaEl.value.trim();
      if (cmd) this.executeCommand(cmd);
      return;
    }

    // Escape
    if (e.key === "Escape") {
      e.preventDefault();
      if (this.isStreaming) this.abortController?.abort();
      this.close();
      return;
    }

    // History navigation
    if (e.key === "ArrowUp" && this.textareaEl.selectionStart === 0) {
      e.preventDefault();
      this.navigateHistory(-1);
      return;
    }
    if (e.key === "ArrowDown" && this.textareaEl.selectionStart === this.textareaEl.value.length) {
      e.preventDefault();
      this.navigateHistory(1);
      return;
    }
  };

  private handleRootKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.closeModelDropdown();
      this.closeSlashDropdown();
      if (this.isStreaming) this.abortController?.abort();
      else this.close();
      return;
    }
    // Ctrl+Enter -> Accept
    if (e.ctrlKey && e.key === "Enter" && !e.shiftKey && this.hasPreview && !this.isStreaming) {
      e.preventDefault(); e.stopPropagation(); this.acceptCode(); return;
    }
    // Ctrl+Shift+Enter -> Retry
    if (e.ctrlKey && e.shiftKey && e.key === "Enter" && this.hasPreview && !this.isStreaming) {
      e.preventDefault(); e.stopPropagation(); this.retryCommand(); return;
    }
    // Ctrl+Backspace -> Discard
    if (e.ctrlKey && e.key === "Backspace" && this.hasPreview && !this.isStreaming) {
      e.preventDefault(); e.stopPropagation(); this.rejectCode(); return;
    }
  };

  private handleBlur = () => {
    setTimeout(() => {
      if (!this.disposed && !this.isStreaming && !this.hasPreview && !this.resizing && !this.root.contains(document.activeElement)) {
        this.close();
      }
    }, 200);
  };

  private handleSubmitClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.isStreaming) { this.abortController?.abort(); return; }
    const cmd = this.textareaEl.value.trim();
    if (cmd) this.executeCommand(cmd);
  };

  /* -- History navigation -- */

  private navigateHistory(direction: number) {
    if (promptHistory.length === 0) return;
    if (this.historyIndex === -1) this.currentDraft = this.textareaEl.value;

    const newIndex = this.historyIndex + direction;
    if (direction < 0) {
      if (this.historyIndex === -1) this.historyIndex = promptHistory.length - 1;
      else if (newIndex >= 0) this.historyIndex = newIndex;
      else return;
    } else {
      if (newIndex >= promptHistory.length) {
        this.historyIndex = -1;
        this.textareaEl.value = this.currentDraft;
        this.autoResizeTextarea();
        return;
      }
      this.historyIndex = newIndex;
    }
    this.textareaEl.value = promptHistory[this.historyIndex];
    this.autoResizeTextarea();
  }

  /* -- Progress helpers -- */

  private showProgress() {
    this.progressEl.classList.add("active");
    this.progressEl.innerHTML = '<div class="inline-cmd-progress-bar"></div>';
  }
  private hideProgress() {
    this.progressEl.classList.remove("active");
    this.progressEl.innerHTML = "";
  }
  private showSkeleton() { this.skeletonEl.classList.add("visible"); }
  private hideSkeleton() { this.skeletonEl.classList.remove("visible"); }

  private setStatus(text: string, isError = false, tokenCount?: number) {
    if (this.disposed) return;
    this.statusEl.innerHTML = "";
    this.statusEl.classList.toggle("visible", true);
    this.statusEl.classList.toggle("error", isError);

    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    this.statusEl.appendChild(textSpan);

    if (tokenCount !== undefined && tokenCount > 0) {
      const tokenSpan = document.createElement("span");
      tokenSpan.className = "token-count";
      tokenSpan.textContent = `~${tokenCount} tokens`;
      this.statusEl.appendChild(tokenSpan);
    }
  }

  /* -- Streaming fence detection -- */

  private processStreamToken(token: string): string {
    if (this.firstLineResolved) return token;
    this.firstLineBuffer += token;
    const nlIdx = this.firstLineBuffer.indexOf("\n");
    if (nlIdx === -1) return "";
    this.firstLineResolved = true;
    const firstLine = this.firstLineBuffer.slice(0, nlIdx).trim();
    if (/^```[\w]*$/.test(firstLine)) {
      this.openingFenceDetected = true;
      const rest = this.firstLineBuffer.slice(nlIdx + 1);
      this.firstLineBuffer = "";
      return rest;
    }
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
    const range = new this.monaco.Range(this.insertLine, this.insertCol, this.insertEndLine, this.insertEndCol);
    const text = model.getValueInRange(range);
    const cleaned = text.replace(/\n?```\s*$/, "");
    if (cleaned === text) return;
    this.editor.executeEdits("inline-command-cleanup", [{ range, text: cleaned, forceMoveMarkers: true }]);
    this.recalcEndPosition(cleaned);
    this.updatePreviewDecorations();
  }

  /* -- Real-time insertion -- */

  private insertChunk(text: string) {
    if (!text || this.disposed) return;
    this.hideSkeleton();
    const range = new this.monaco.Range(this.insertEndLine, this.insertEndCol, this.insertEndLine, this.insertEndCol);
    this.editor.executeEdits("inline-command", [{ range, text, forceMoveMarkers: true }]);
    this.hasPreview = true;
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

    if (this.hasSelection) {
      for (let line = this.selection!.startLineNumber; line <= this.selection!.endLineNumber; line++) {
        decorations.push({
          range: new this.monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "inline-cmd-preview-removed",
            linesDecorationsClassName: "inline-cmd-preview-removed-gutter",
            inlineClassName: "inline-cmd-preview-removed-text",
            overviewRuler: { color: "rgba(248, 81, 73, 0.6)", position: this.monaco.editor.OverviewRulerLane.Left },
            minimap: { color: "rgba(248, 81, 73, 0.6)", position: this.monaco.editor.MinimapPosition.Inline },
          },
        });
      }
    }

    if (this.hasPreview) {
      for (let line = this.insertLine; line <= this.insertEndLine; line++) {
        decorations.push({
          range: new this.monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "inline-cmd-preview-added",
            linesDecorationsClassName: "inline-cmd-preview-gutter",
            overviewRuler: { color: "rgba(46, 160, 67, 0.6)", position: this.monaco.editor.OverviewRulerLane.Left },
            minimap: { color: "rgba(46, 160, 67, 0.6)", position: this.monaco.editor.MinimapPosition.Inline },
          },
        });
      }
    }

    this.previewDecorationIds = this.editor.deltaDecorations(this.previewDecorationIds, decorations);
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

  /* -- Undo to before-edit state -- */

  private undoToBeforeEdit() {
    const model = this.editor.getModel();
    if (!model) return;
    let safety = 500;
    while (model.getAlternativeVersionId() !== this.modelVersionBeforeEdit && safety > 0) {
      this.editor.trigger("inline-command", "undo", null);
      safety--;
    }
  }

  private estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

  /* -- Resolve slash command -- */

  private resolveSlashCommand(command: string): { prompt: string; slashCmd?: SlashCommand } {
    const match = command.match(/^(\/\w+)\s*(.*)/s);
    if (!match) return { prompt: command };
    const cmdName = match[1].toLowerCase();
    const rest = match[2].trim();
    const slashCmd = SLASH_COMMANDS.find((c) => c.name === cmdName);
    if (!slashCmd) return { prompt: command };
    return { prompt: slashCmd.systemPrefix + (rest || ""), slashCmd };
  }

  /* -- Command Execution -- */

  private async executeCommand(command: string) {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.textareaEl.disabled = true;
    this.closeSlashDropdown();
    this.closeModelDropdown();

    pushHistory(command);
    this.historyIndex = -1;
    this.currentDraft = "";

    this.submitBtn.innerHTML = ICONS.stop;
    this.submitBtn.title = "Stop generating (Escape)";
    this.submitBtn.setAttribute("aria-label", "Stop generating");
    this.showProgress();
    this.showSkeleton();
    this.setStatus("Generating...");
    this.announce("Generating code...");
    this.tokenCount = 0;

    const model = this.editor.getModel();
    const language = model?.getLanguageId() ?? "plaintext";
    const filePath = this.ctx.getFilePath() ?? "untitled";
    const filename = filePath.split("/").pop() ?? "untitled";
    const selectedText = this.hasSelection && model ? model.getValueInRange(this.selection!) : "";
    const fullContent = model?.getValue() ?? "";

    const radius = 30;
    const startLine = Math.max(1, this.cursorPosition.lineNumber - radius);
    const endLine = Math.min(model?.getLineCount() ?? 1, this.cursorPosition.lineNumber + radius);
    const contextLines: string[] = [];
    if (model) { for (let i = startLine; i <= endLine; i++) contextLines.push(model.getLineContent(i)); }

    const cursorLineText = model?.getLineContent(this.cursorPosition.lineNumber) ?? "";
    const baseIndent = cursorLineText.match(/^(\s*)/)?.[1] ?? "";

    const { prompt: resolvedPrompt } = this.resolveSlashCommand(command);

    const question = selectedText
      ? `The user selected this code:\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\nInstruction: ${resolvedPrompt}\n\nIMPORTANT: Respond ONLY with the NEW code that should REPLACE the selected code. Do NOT repeat or include the original selected code unless the instruction requires modifying it. No explanation, no markdown fences. Match the existing indentation (base indent: "${baseIndent}").`
      : `File: ${filename} (${language})\nCursor at line ${this.cursorPosition.lineNumber}, column ${this.cursorPosition.column}.\n\nContext around cursor:\n\`\`\`${language}\n${contextLines.join("\n")}\n\`\`\`\n\nInstruction: ${resolvedPrompt}\n\nRespond ONLY with the code to insert. No explanation, no markdown fences. Match the existing indentation (base indent: "${baseIndent}").`;

    const request: ChatRequest = {
      question,
      language,
      context: fullContent.slice(0, 8000),
      filename,
      selection: selectedText || undefined,
      cursorPosition: {
        lineNumber: this.cursorPosition.lineNumber,
        column: this.cursorPosition.column,
      },
      providerId: this.selectedProviderId,
      modelId: this.selectedModelId,
      history: this.conversationHistory.length > 0 ? this.conversationHistory : undefined,
    };

    this.modelVersionBeforeEdit = model?.getAlternativeVersionId() ?? 0;
    this.editor.pushUndoStop();

    if (this.hasSelection) {
      const selEndLine = this.selection!.endLineNumber;
      const selEndMaxCol = model!.getLineMaxColumn(selEndLine);
      this.editor.executeEdits("inline-command-sep", [{
        range: new this.monaco.Range(selEndLine, selEndMaxCol, selEndLine, selEndMaxCol),
        text: "\n",
        forceMoveMarkers: false,
      }]);
      this.insertLine = selEndLine + 1;
      this.insertEndLine = selEndLine + 1;
      this.insertEndCol = 1;
      this.updatePreviewDecorations();
    }

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
            this.announce(`Error: ${chunk.error}`);
            this.finishGeneration(true);
            return;
          }
          if (chunk.done) {
            const remaining = this.flushStreamBuffer();
            if (remaining) this.insertChunk(remaining);
            this.cleanupTrailingFence();
            const lineCount = this.insertEndLine - this.insertLine + 1;
            this.tokenCount = this.estimateTokens(accumulated);
            this.setStatus(
              this.hasPreview ? `Done \u2014 ${lineCount} line${lineCount > 1 ? "s" : ""} generated` : "Done \u2014 no output",
              false,
              this.tokenCount,
            );
            this.conversationHistory.push(
              { role: "user", content: command },
              { role: "assistant", content: accumulated },
            );
            this.announce(this.hasPreview ? `Code generated. ${lineCount} lines. Use Ctrl+Enter to accept.` : "Done, no output.");
            this.finishGeneration(false);
            return;
          }
          if (chunk.content) {
            accumulated += chunk.content;
            const toInsert = this.processStreamToken(chunk.content);
            if (toInsert) this.insertChunk(toInsert);
            this.tokenCount = this.estimateTokens(accumulated);
            this.setStatus(`Generating... ${accumulated.length} chars`, false, this.tokenCount);
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
        this.tokenCount = this.estimateTokens(accumulated);
        this.setStatus("Cancelled", false, this.tokenCount);
        if (accumulated) {
          this.conversationHistory.push({ role: "user", content: command }, { role: "assistant", content: accumulated });
        }
        this.announce("Generation cancelled.");
        this.finishGeneration(false);
        return;
      }
      this.setStatus(`Error: ${err?.message ?? "Request failed"}`, true);
      this.announce(`Error: ${err?.message ?? "Request failed"}`);
      this.finishGeneration(true);
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /* -- Finish & show action buttons -- */

  private finishGeneration(hadError: boolean) {
    if (this.disposed) return;
    this.hideProgress();
    this.hideSkeleton();
    this.submitBtn.innerHTML = ICONS.send;
    this.submitBtn.title = "Submit (Enter)";
    this.submitBtn.setAttribute("aria-label", "Submit prompt");

    this.removeViewZone();
    this.createViewZone(4.5);
    this.editor.layoutContentWidget(this.contentWidget);

    this.actionsEl.innerHTML = "";
    this.actionsEl.classList.add("visible");

    if (this.hasPreview) {
      this.actionsEl.appendChild(this.makeButton("Accept", ICONS.accept, "inline-cmd-btn-primary", () => this.acceptCode(), "Ctrl+Enter"));
    }

    this.actionsEl.appendChild(this.makeButton("Discard", ICONS.discard, "inline-cmd-btn-secondary", () => this.rejectCode(), "Ctrl+\u232b"));

    if (this.hasPreview) {
      this.actionsEl.appendChild(this.makeButton("Retry", ICONS.retry, "inline-cmd-btn-secondary", () => this.retryCommand(), "Ctrl+Shift+Enter"));
    }

    if (hadError && this.hasPreview) {
      this.actionsEl.appendChild(this.makeButton("Keep Partial", ICONS.keepPartial, "inline-cmd-btn-secondary", () => this.acceptCode()));
    }

    const spacer = document.createElement("div");
    spacer.className = "inline-cmd-actions-spacer";
    this.actionsEl.appendChild(spacer);

    this.updateConversationUI();
    this.textareaEl.disabled = false;
    this.textareaEl.value = "";
    this.autoResizeTextarea();
  }

  private makeButton(
    label: string, icon: string, cls: string, onClick: () => void, shortcut?: string,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `inline-cmd-btn ${cls}`;
    let html = `${icon}<span>${label}</span>`;
    if (shortcut) html += `<kbd class="inline-cmd-kbd">${shortcut}</kbd>`;
    btn.innerHTML = html;
    btn.setAttribute("aria-label", `${label}${shortcut ? ` (${shortcut})` : ""}`);
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return btn;
  }

  /* -- Accept / Discard / Retry -- */

  private acceptCode() {
    const model = this.editor.getModel();
    this.clearPreviewDecorations();
    if (this.hasSelection && this.hasPreview && model) {
      const genRange = new this.monaco.Range(this.insertLine, 1, this.insertEndLine, this.insertEndCol);
      const generatedText = model.getValueInRange(genRange);
      this.undoToBeforeEdit();
      this.editor.executeEdits("inline-command-accept", [
        { range: this.selection!, text: generatedText, forceMoveMarkers: true },
      ]);
    }
    this.editor.pushUndoStop();
    this.hasPreview = false;
    this.announce("Code accepted.");
    this.close();
  }

  private rejectCode() {
    this.clearPreviewDecorations();
    this.undoToBeforeEdit();
    this.hasPreview = false;
    this.announce("Code discarded.");
    this.close();
  }

  private retryCommand() {
    this.clearPreviewDecorations();
    this.undoToBeforeEdit();
    this.hasPreview = false;
    if (this.hasSelection) { this.insertLine = this.selection!.endLineNumber + 1; this.insertCol = 1; }
    this.insertEndLine = this.insertLine;
    this.insertEndCol = this.insertCol;

    this.actionsEl.innerHTML = "";
    this.actionsEl.classList.remove("visible");
    this.statusEl.classList.remove("visible");
    this.textareaEl.disabled = false;
    this.textareaEl.value = "";
    this.autoResizeTextarea();
    this.textareaEl.focus();
    this.isStreaming = false;

    this.removeViewZone();
    this.createViewZone(3);
    this.editor.layoutContentWidget(this.contentWidget);
    this.announce("Ready to retry. Enter a new prompt.");
  }

  /* -- Cleanup -- */

  private close() { this.dispose(); this.onClose(); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController?.abort();

    if (this.hasPreview) {
      this.clearPreviewDecorations();
      this.undoToBeforeEdit();
    }

    this.textareaEl.removeEventListener("keydown", this.handleKeyDown);
    this.textareaEl.removeEventListener("input", this.handleInput);
    this.root.removeEventListener("keydown", this.handleRootKeyDown);
    this.root.removeEventListener("focusout", this.handleBlur);
    this.submitBtn.removeEventListener("click", this.handleSubmitClick);
    this.modelBtn.removeEventListener("click", this.handleModelBtnClick);
    document.removeEventListener("mouseup", this.handleResizeEnd);
    document.removeEventListener("mousemove", this.handleResizeMove);

    this.closeModelDropdown();
    this.closeSlashDropdown();

    this.editor.removeContentWidget(this.contentWidget);
    this.removeViewZone();
    this.editor.focus();
  }
}
