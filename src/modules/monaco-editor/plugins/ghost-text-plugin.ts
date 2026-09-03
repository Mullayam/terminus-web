/**
 * @module monaco-editor/plugins/ghost-text-plugin
 *
 * AI-powered ghost text (inline completion) plugin using SSE streaming.
 *
 * Connects to `${endpoint}/api/stream` via Server-Sent Events.
 * The server receives `{ question, language }` and streams back
 * completion tokens which are shown as ghost text in the editor.
 *
 * Usage:
 *   import { createGhostTextPlugin } from "@/modules/monaco-editor";
 *
 *   const ghostText = createGhostTextPlugin({ endpoint: "http://localhost:7145" });
 *   <MonacoEditor plugins={[ghostText]} />
 *
 * The ghost text appears after ~600ms idle. Press Tab to accept,
 * Escape to dismiss.
 */

import type * as monacoNs from "monaco-editor";
import type { MonacoPlugin, PluginContext } from "../types";

type Monaco = typeof monacoNs;

/* ── Configuration ─────────────────────────────────────────── */

export interface GhostTextPluginOptions {
  /** Base API URL, e.g. "http://localhost:7145" */
  endpoint: string;
  /** Idle delay in ms before triggering a suggestion (default: 600) */
  debounceMs?: number;
  /** Max lines of context (above + below cursor) to send (default: 60) */
  maxContextLines?: number;
  /** Max tokens / characters to accept from the stream (default: 2048) */
  maxCompletionLength?: number;
  /** Request timeout in ms (default: 15000) */
  timeout?: number;
  /** Gate: when provided and it returns false, the provider yields nothing. */
  isActive?: () => boolean;
}

/* ── Request body type ──────────────────────────────────── */

interface GhostTextRequestBody {
  /** Filename (e.g. "vps.sh", "index.ts") */
  filename: string;
  /** Language ID (e.g. "shell", "typescript") */
  language: string;
  /** All text before the cursor */
  textBeforeCursor: string;
  /** All text after the cursor */
  textAfterCursor: string;
  /** Cursor line and column (1-based) */
  cursorPosition: { lineNumber: number; column: number };
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Build the structured request body from the editor context.
 */
function buildRequestBody(
  model: monacoNs.editor.ITextModel,
  position: monacoNs.IPosition,
  maxContextLines: number,
  filename: string,
  language: string,
): GhostTextRequestBody {
  const lineCount = model.getLineCount();
  const cursorLine = position.lineNumber;
  const cursorCol = position.column;

  // Lines before cursor (up to maxContextLines / 2)
  const prefixStartLine = Math.max(1, cursorLine - Math.floor(maxContextLines / 2));
  const prefixLines: string[] = [];
  for (let i = prefixStartLine; i < cursorLine; i++) {
    prefixLines.push(model.getLineContent(i));
  }
  // Current line up to cursor
  const currentLineText = model.getLineContent(cursorLine);
  const beforeCursor = currentLineText.substring(0, cursorCol - 1);
  prefixLines.push(beforeCursor);

  // Lines after cursor (up to maxContextLines / 2)
  const afterCursor = currentLineText.substring(cursorCol - 1);
  const suffixEndLine = Math.min(lineCount, cursorLine + Math.ceil(maxContextLines / 2));
  const suffixLines: string[] = [afterCursor];
  for (let i = cursorLine + 1; i <= suffixEndLine; i++) {
    suffixLines.push(model.getLineContent(i));
  }

  return {
    filename,
    language,
    textBeforeCursor: prefixLines.join("\n"),
    textAfterCursor: suffixLines.join("\n"),
    cursorPosition: { lineNumber: cursorLine, column: cursorCol },
  };
}

/**
 * Fetch a completion from the SSE `/api/stream` endpoint.
 * Sends the structured body: { filename, language, textBeforeCursor, textAfterCursor, cursorPosition }
 * Returns the accumulated text from the stream.
 */
async function fetchSSECompletion(
  endpoint: string,
  body: GhostTextRequestBody,
  signal: AbortSignal,
  maxLength: number,
): Promise<string> {
  const url = `${endpoint.replace(/\/$/, "")}/api/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`SSE request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let accumulated = "";

  // SSE frame state kept across reads (a frame may span several chunks).
  let buffer = "";
  let eventType = "";
  let dataLines: string[] = [];

  // Dispatch one complete SSE frame; returns true when the stream is finished.
  // The backend streams incremental `chunk` frames AND a final `done` frame that
  // repeats the ENTIRE reply — appending both would duplicate the text, so `done`
  // is treated purely as a terminator (its text is used only if nothing streamed).
  const dispatchFrame = (): boolean => {
    const type = eventType;
    const data = dataLines.join("\n");
    eventType = "";
    dataLines = [];
    if (!data) return false;

    if (data === "[DONE]" || type === "done") {
      if (!accumulated && data !== "[DONE]") {
        try {
          const parsed: any = JSON.parse(data);
          accumulated += parsed?.text ?? parsed?.content ?? "";
        } catch { /* ignore */ }
      }
      return true;
    }
    if (type === "provider") return false;

    try {
      const parsed: any = JSON.parse(data);
      const tok =
        parsed?.choices?.[0]?.delta?.content ??
        parsed?.content ??
        parsed?.text ??
        parsed?.token ??
        "";
      if (tok) accumulated += tok;
    } catch {
      if (data) accumulated += data;
    }
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep the trailing partial line

      for (const raw of lines) {
        const line = raw.replace(/\r$/, "");
        if (line === "") {
          if (dispatchFrame()) return accumulated.slice(0, maxLength); // blank line ends a frame
        } else if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^ /, ""));
        } else if (line.startsWith(":") || line.startsWith("id:") || line.startsWith("retry:")) {
          // SSE comment / non-data field — ignore
        } else if (line.trim()) {
          // Raw, non-SSE line: treat as a content delta.
          accumulated += line;
        }
      }

      if (accumulated.length >= maxLength) {
        accumulated = accumulated.slice(0, maxLength);
        break;
      }
    }

    // Flush any trailing buffered line, then the final frame.
    const tail = buffer.replace(/\r$/, "");
    if (tail.startsWith("data:")) dataLines.push(tail.slice(5).replace(/^ /, ""));
    else if (tail.startsWith("event:")) eventType = tail.slice(6).trim();
    else if (tail.trim() && !tail.startsWith(":") && !tail.startsWith("id:") && !tail.startsWith("retry:")) {
      accumulated += tail;
    }
    dispatchFrame();
  } finally {
    reader.releaseLock();
  }

  return accumulated.slice(0, maxLength);
}

/* ── Plugin factory ────────────────────────────────────────── */

/**
 * Create a ghost text inline completion plugin.
 *
 * @param options  Configuration (endpoint is required)
 * @returns A MonacoPlugin instance
 */
export function createGhostTextPlugin(
  options: GhostTextPluginOptions,
): MonacoPlugin {
  const {
    endpoint,
    debounceMs = 600,
    maxContextLines = 60,
    maxCompletionLength = 2048,
    timeout = 15000,
    isActive,
  } = options;

  // Shared state across the plugin lifecycle
  let abortController: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRequestId = 0;
  let cachedSuggestion: { lineNumber: number; column: number; text: string } | null = null;

  function cancelPending() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  return {
    id: "builtin-ghost-text",
    name: "Ghost Text (AI Suggestions)",
    version: "1.0.0",
    description: "AI-powered inline ghost text completions via SSE streaming",
    priority: 5,

    onMount(ctx: PluginContext) {
      const { monaco, editor } = ctx;
      const language = ctx.getLanguage();

      // Register the inline completions provider
      ctx.registerInlineCompletionsProvider("*", {
        async provideInlineCompletions(
          model: monacoNs.editor.ITextModel,
          position: monacoNs.Position,
          _context: monacoNs.languages.InlineCompletionContext,
          token: monacoNs.CancellationToken,
        ): Promise<monacoNs.languages.InlineCompletions> {
          // Inactive when another AI provider is selected.
          if (isActive && !isActive()) return { items: [] };

          // Return cached suggestion if cursor hasn't moved
          if (
            cachedSuggestion &&
            cachedSuggestion.lineNumber === position.lineNumber &&
            cachedSuggestion.column === position.column &&
            cachedSuggestion.text
          ) {
            return {
              items: [
                {
                  insertText: cachedSuggestion.text,
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column,
                  ),
                },
              ],
            };
          }

          // Debounce: wait for idle
          return new Promise<monacoNs.languages.InlineCompletions>((resolve) => {
            cancelPending();

            const requestId = ++lastRequestId;

            debounceTimer = setTimeout(async () => {
              if (token.isCancellationRequested || requestId !== lastRequestId) {
                resolve({ items: [] });
                return;
              }

              abortController = new AbortController();
              const timeoutId = setTimeout(() => abortController?.abort(), timeout);

              // Listen for Monaco cancellation
              token.onCancellationRequested(() => {
                abortController?.abort();
                clearTimeout(timeoutId);
              });

              try {
                const currentLang =
                  model.getLanguageId?.() ??
                  (model as any).getModeId?.() ??
                  language;

                // Derive filename from model URI or fallback
                const modelUri = model.uri?.path ?? model.uri?.toString() ?? "";
                const currentFilename = modelUri.split("/").pop() || "untitled";

                const body = buildRequestBody(
                  model,
                  position,
                  maxContextLines,
                  currentFilename,
                  currentLang,
                );
                const completionText = await fetchSSECompletion(
                  endpoint,
                  body,
                  abortController!.signal,
                  maxCompletionLength,
                );

                clearTimeout(timeoutId);

                if (
                  !completionText.trim() ||
                  token.isCancellationRequested ||
                  requestId !== lastRequestId
                ) {
                  resolve({ items: [] });
                  return;
                }

                // Cache the suggestion
                cachedSuggestion = {
                  lineNumber: position.lineNumber,
                  column: position.column,
                  text: completionText,
                };

                resolve({
                  items: [
                    {
                      insertText: completionText,
                      range: new monaco.Range(
                        position.lineNumber,
                        position.column,
                        position.lineNumber,
                        position.column,
                      ),
                    },
                  ],
                });
              } catch (err: any) {
                clearTimeout(timeoutId);
                if (err?.name !== "AbortError") {
                  console.warn("[GhostText] Completion error:", err?.message);
                }
                resolve({ items: [] });
              }
            }, debounceMs);
          });
        },

        disposeInlineCompletions() {
          // Nothing to dispose — cache is managed internally
        },
      });

      // Clear cache on cursor move so stale ghost text doesn't stick
      ctx.addDisposable(
        editor.onDidChangeCursorPosition(() => {
          cachedSuggestion = null;
        }),
      );

      // Cancel in-flight requests when content changes rapidly
      ctx.addDisposable(
        editor.onDidChangeModelContent(() => {
          cachedSuggestion = null;
          cancelPending();
        }),
      );

      // Register command-palette action to trigger manually
      ctx.addAction({
        id: "ghost-text.trigger",
        label: "Ghost Text: Trigger Suggestion",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Backslash],
        run: () => {
          // Force inline completions to re-trigger
          editor.trigger("ghost-text", "editor.action.inlineSuggest.trigger", {});
        },
      });

      // Register command to accept suggestion with Tab
      ctx.addAction({
        id: "ghost-text.accept",
        label: "Ghost Text: Accept Suggestion",
        run: () => {
          editor.trigger("ghost-text", "editor.action.inlineSuggest.commit", {});
        },
      });
    },

    onDispose() {
      cancelPending();
      cachedSuggestion = null;
    },
  };
}
