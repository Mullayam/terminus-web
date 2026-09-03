/**
 * @module monaco-editor/plugins/codeium-plugin
 *
 * Inline completions (ghost text) backed by the Codeium language server.
 *
 * The browser cannot spawn the native `language_server` binary, so this plugin
 * talks to a backend companion that owns the binary, the API key, and the
 * localhost RPC. The companion translates between this Monaco-native contract
 * (1-based UTF-16 line/column) and Codeium's byte offsets — the client never
 * sees Codeium's wire format.
 *
 *   POST {endpoint}/api/codeium/complete  →  { completions: [{ id, text, range? }] }
 *   POST {endpoint}/api/codeium/accept    →  204 (fire-and-forget)
 *
 * Usage:
 *   const codeium = createCodeiumPlugin({
 *     endpoint: __config.API_URL,
 *     getOtherDocuments: () => getOtherDocuments({ excludePath: activePath }),
 *   });
 *   <MonacoEditor plugins={[codeium]} />
 */

import type * as monacoNs from "monaco-editor";
import type { MonacoPlugin, PluginContext } from "../types";

/* ── Options ───────────────────────────────────────────────── */

export interface CodeiumOtherDocument {
  filePath: string;
  languageId: string;
  /** Full document text */
  text: string;
}

export interface CodeiumPluginOptions {
  /** Base API URL of the companion, e.g. "http://localhost:7145" */
  endpoint: string;
  /** Optional host id, sent as `?user=base64(hostId)` like the chat API */
  hostId?: string;
  /** Idle delay in ms before firing a request (default: 120) */
  debounceMs?: number;
  /** Skip the request when the document exceeds this size (default: 400_000) */
  maxDocumentChars?: number;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
  /** Supplies cross-file context. Omit to send only the current file. */
  getOtherDocuments?: () => CodeiumOtherDocument[];
  /** Called on transport/parse failures (AbortError is swallowed) */
  onError?: (error: Error) => void;
}

/* ── Wire types ────────────────────────────────────────────── */

interface CodeiumRequestBody {
  requestId: number;
  document: {
    filePath: string;
    languageId: string;
    /** Full buffer — Codeium expects the whole file, not a window */
    text: string;
    /** 1-based, UTF-16 columns — Monaco's native coordinates */
    cursorPosition: { lineNumber: number; column: number };
    lineEnding: "\n" | "\r\n";
  };
  otherDocuments: CodeiumOtherDocument[];
  editorOptions: { tabSize: number; insertSpaces: boolean };
}

/** Monaco-native replace range, 1-based UTF-16. Omit to insert at the cursor. */
interface CodeiumRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

interface CodeiumCompletion {
  id: string;
  text: string;
  range?: CodeiumRange;
}

/* ── Accept command (registered once per page) ─────────────── */

const ACCEPT_COMMAND_ID = "terminus.codeium.acceptCompletion";

let acceptHandler: ((completionId: string) => void) | null = null;
let acceptCommandRegistered = false;

function ensureAcceptCommand(monaco: PluginContext["monaco"]): void {
  if (acceptCommandRegistered) return;
  const register = (monaco.editor as { registerCommand?: Function }).registerCommand;
  if (typeof register !== "function") return;
  register.call(monaco.editor, ACCEPT_COMMAND_ID, (_accessor: unknown, completionId: string) => {
    acceptHandler?.(completionId);
  });
  acceptCommandRegistered = true;
}

/* ── Helpers ───────────────────────────────────────────────── */

function buildRequestBody(
  model: monacoNs.editor.ITextModel,
  position: monacoNs.IPosition,
  requestId: number,
  options: CodeiumPluginOptions,
): CodeiumRequestBody {
  const modelOptions = model.getOptions();
  const filePath = model.uri?.path || model.uri?.toString() || "untitled";

  return {
    requestId,
    document: {
      filePath,
      languageId: model.getLanguageId(),
      text: model.getValue(),
      cursorPosition: { lineNumber: position.lineNumber, column: position.column },
      lineEnding: model.getEOL() === "\r\n" ? "\r\n" : "\n",
    },
    otherDocuments: options.getOtherDocuments?.() ?? [],
    editorOptions: {
      tabSize: modelOptions.tabSize,
      insertSpaces: modelOptions.insertSpaces,
    },
  };
}

function isRange(value: unknown): value is CodeiumRange {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.startLineNumber === "number" &&
    typeof r.startColumn === "number" &&
    typeof r.endLineNumber === "number" &&
    typeof r.endColumn === "number"
  );
}

/** Accepts `{ completions: [...] }` or a `{ data: … }` wrapper. */
function normalizeCompletions(payload: unknown): CodeiumCompletion[] {
  const root = (payload as { data?: unknown })?.data ?? payload;
  if (!root || typeof root !== "object") return [];

  const raw = (root as Record<string, unknown>).completions;
  if (!Array.isArray(raw)) return [];

  const out: CodeiumCompletion[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.text !== "string" || !item.text) continue;
    out.push({
      id: String(item.id ?? index),
      text: item.text,
      range: isRange(item.range) ? item.range : undefined,
    });
  }
  return out;
}

function buildUrl(endpoint: string, path: string, hostId?: string): string {
  const base = `${endpoint.replace(/\/$/, "")}${path}`;
  return hostId ? `${base}?user=${btoa(hostId)}` : base;
}

/* ── Plugin factory ────────────────────────────────────────── */

export function createCodeiumPlugin(options: CodeiumPluginOptions): MonacoPlugin {
  const {
    endpoint,
    hostId,
    debounceMs = 120,
    maxDocumentChars = 400_000,
    timeout = 10_000,
    onError,
  } = options;

  let abortController: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRequestId = 0;
  /** Keyed on the serialized request body, so an unchanged context reuses the last answer */
  let cached: { key: string; completions: CodeiumCompletion[] } | null = null;

  function cancelPending() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    abortController?.abort();
    abortController = null;
  }

  function reportAccepted(completionId: string) {
    void fetch(buildUrl(endpoint, "/api/codeium/accept", hostId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completionId }),
      keepalive: true,
    }).catch(() => {
      /* telemetry is best-effort */
    });
  }

  return {
    id: "builtin-codeium",
    name: "Codeium Inline Completions",
    version: "1.0.0",
    description: "Ghost text from the Codeium language server via a backend companion",
    priority: 5,

    onMount(ctx: PluginContext) {
      const { monaco, editor } = ctx;

      acceptHandler = reportAccepted;
      ensureAcceptCommand(monaco);

      ctx.registerInlineCompletionsProvider("*", {
        provideInlineCompletions(
          model: monacoNs.editor.ITextModel,
          position: monacoNs.Position,
          _context: monacoNs.languages.InlineCompletionContext,
          token: monacoNs.CancellationToken,
        ): Promise<monacoNs.languages.InlineCompletions> {
          const toResult = (completions: CodeiumCompletion[]) => ({
            items: completions.map((c) => ({
              insertText: c.text,
              range: c.range
                ? new monaco.Range(
                    c.range.startLineNumber,
                    c.range.startColumn,
                    c.range.endLineNumber,
                    c.range.endColumn,
                  )
                : new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column,
                  ),
              command: {
                id: ACCEPT_COMMAND_ID,
                title: "Accept Codeium completion",
                arguments: [c.id],
              },
            })),
          });

          if (model.getValueLength() > maxDocumentChars) {
            return Promise.resolve({ items: [] });
          }

          const requestId = lastRequestId + 1;
          const body = buildRequestBody(model, position, requestId, options);
          const key = JSON.stringify({ ...body, requestId: 0 });

          if (cached?.key === key) return Promise.resolve(toResult(cached.completions));

          return new Promise((resolve) => {
            cancelPending();
            lastRequestId = requestId;

            debounceTimer = setTimeout(async () => {
              if (token.isCancellationRequested || requestId !== lastRequestId) {
                resolve({ items: [] });
                return;
              }

              const controller = new AbortController();
              abortController = controller;
              const timeoutId = setTimeout(() => controller.abort(), timeout);
              token.onCancellationRequested(() => controller.abort());

              try {
                const response = await fetch(buildUrl(endpoint, "/api/codeium/complete", hostId), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                  signal: controller.signal,
                });
                if (!response.ok) {
                  throw new Error(`Codeium completion failed: ${response.status}`);
                }

                const completions = normalizeCompletions(await response.json());

                if (token.isCancellationRequested || requestId !== lastRequestId) {
                  resolve({ items: [] });
                  return;
                }

                cached = { key, completions };
                resolve(toResult(completions));
              } catch (err) {
                if ((err as Error)?.name !== "AbortError") {
                  onError?.(err as Error);
                }
                resolve({ items: [] });
              } finally {
                clearTimeout(timeoutId);
                if (abortController === controller) abortController = null;
              }
            }, debounceMs);
          });
        },

        disposeInlineCompletions() {
          /* items hold no disposable resources */
        },
      });

      ctx.addDisposable(
        editor.onDidChangeModelContent(() => {
          cached = null;
          cancelPending();
        }),
      );

      ctx.addAction({
        id: "codeium.trigger",
        label: "Codeium: Trigger Suggestion",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Backslash],
        run: () => {
          cached = null;
          editor.trigger("codeium", "editor.action.inlineSuggest.trigger", {});
        },
      });
    },

    onDispose() {
      cancelPending();
      cached = null;
      acceptHandler = null;
    },
  };
}
