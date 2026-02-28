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
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Build the prompt/question from the editor context around the cursor.
 * Sends prefix (code above cursor) and suffix (code below) so the model
 * understands where to insert.
 */
function buildQuestion(
  model: monacoNs.editor.ITextModel,
  position: monacoNs.IPosition,
  maxContextLines: number,
): string {
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

  const prefix = prefixLines.join("\n");
  const suffix = suffixLines.join("\n");

  return `<|prefix|>${prefix}<|suffix|>${suffix}<|middle|>`;
}

/**
 * Fetch a completion from the SSE `/api/stream` endpoint.
 * Returns the accumulated text from the stream.
 */
async function fetchSSECompletion(
  endpoint: string,
  question: string,
  language: string,
  signal: AbortSignal,
  maxLength: number,
): Promise<string> {
  const url = `${endpoint.replace(/\/$/, "")}/api/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, language }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`SSE request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let accumulated = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE lines: "data: ..." or plain text chunks
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return accumulated;
          try {
            // Try JSON parse (OpenAI-style: { choices: [{ delta: { content } }] })
            const parsed = JSON.parse(data);
            const token =
              parsed?.choices?.[0]?.delta?.content ??
              parsed?.content ??
              parsed?.text ??
              parsed?.token ??
              "";
            if (token) accumulated += token;
          } catch {
            // Plain text SSE data
            if (data) accumulated += data;
          }
        } else if (line.trim() && !line.startsWith(":") && !line.startsWith("event:") && !line.startsWith("id:")) {
          // Raw streaming (non-SSE formatted)
          accumulated += line;
        }
      }

      if (accumulated.length >= maxLength) {
        accumulated = accumulated.slice(0, maxLength);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
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

                const question = buildQuestion(model, position, maxContextLines);
                const completionText = await fetchSSECompletion(
                  endpoint,
                  question,
                  currentLang,
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
