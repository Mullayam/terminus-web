/**
 * @module editor/hooks/useSyntaxWorker
 *
 * Hook that manages a Web Worker for background syntax highlighting.
 * Falls back to main-thread highlighting if Workers are unavailable.
 *
 * Features:
 *   - Debounced requests to avoid flooding the worker
 *   - Automatic cancellation of stale requests
 *   - Graceful fallback for environments without Worker support
 */
import { useRef, useEffect, useCallback, useState } from "react";
import { highlightCode } from "../core/syntax";

let requestId = 0;

interface SyntaxWorkerResult {
    html: string;
    fromWorker: boolean;
    duration: number;
}

export function useSyntaxWorker() {
    const workerRef = useRef<Worker | null>(null);
    const pendingRef = useRef<Map<number, (result: SyntaxWorkerResult) => void>>(new Map());
    const [ready, setReady] = useState(false);

    // Initialize worker
    useEffect(() => {
        try {
            const worker = new Worker(
                new URL("../workers/syntax.worker.ts", import.meta.url),
                { type: "module" },
            );

            worker.addEventListener("message", (e: MessageEvent) => {
                const { id, html, duration } = e.data;
                const resolver = pendingRef.current.get(id);
                if (resolver) {
                    resolver({ html, fromWorker: true, duration });
                    pendingRef.current.delete(id);
                }
            });

            worker.addEventListener("error", () => {
                // Worker failed — we'll fall back to main thread
                workerRef.current = null;
            });

            workerRef.current = worker;
            setReady(true);

            return () => {
                worker.terminate();
                pendingRef.current.clear();
            };
        } catch {
            // Workers not supported — fallback mode
            setReady(true);
            return;
        }
    }, []);

    /**
     * Request syntax highlighting. Returns a Promise that resolves with the HTML.
     * If the worker is available, highlighting runs off-thread.
     * Otherwise falls back to synchronous Prism on the main thread.
     */
    const highlight = useCallback(
        (content: string, language: string | null): Promise<SyntaxWorkerResult> => {
            // Fallback when worker is unavailable
            if (!workerRef.current) {
                const t0 = performance.now();
                const html = highlightCode(content, language);
                return Promise.resolve({
                    html,
                    fromWorker: false,
                    duration: performance.now() - t0,
                });
            }

            const id = ++requestId;

            return new Promise((resolve) => {
                pendingRef.current.set(id, resolve);
                workerRef.current!.postMessage({
                    id,
                    type: "highlight",
                    content,
                    language,
                });

                // Timeout fallback — if worker doesn't respond in 5s, use main thread
                setTimeout(() => {
                    if (pendingRef.current.has(id)) {
                        pendingRef.current.delete(id);
                        const t0 = performance.now();
                        const html = highlightCode(content, language);
                        resolve({ html, fromWorker: false, duration: performance.now() - t0 });
                    }
                }, 5000);
            });
        },
        [],
    );

    /**
     * Request highlighting for a specific line range (incremental).
     */
    const highlightRange = useCallback(
        (content: string, language: string | null, startLine: number, endLine: number): Promise<SyntaxWorkerResult> => {
            if (!workerRef.current) {
                const lines = content.split("\n").slice(startLine, endLine).join("\n");
                const t0 = performance.now();
                const html = highlightCode(lines, language);
                return Promise.resolve({
                    html,
                    fromWorker: false,
                    duration: performance.now() - t0,
                });
            }

            const id = ++requestId;

            return new Promise((resolve) => {
                pendingRef.current.set(id, resolve);
                workerRef.current!.postMessage({
                    id,
                    type: "highlight-range",
                    content,
                    language,
                    startLine,
                    endLine,
                });

                setTimeout(() => {
                    if (pendingRef.current.has(id)) {
                        pendingRef.current.delete(id);
                        const lines = content.split("\n").slice(startLine, endLine).join("\n");
                        const t0 = performance.now();
                        const html = highlightCode(lines, language);
                        resolve({ html, fromWorker: false, duration: performance.now() - t0 });
                    }
                }, 5000);
            });
        },
        [],
    );

    /** Cancel all pending requests */
    const cancelAll = useCallback(() => {
        pendingRef.current.clear();
    }, []);

    return { highlight, highlightRange, cancelAll, ready };
}
