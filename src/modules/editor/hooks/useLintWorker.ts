/**
 * @module editor/hooks/useLintWorker
 *
 * Hook that manages a background linting Web Worker.
 * Automatically re-lints when content changes (debounced).
 * Falls back to no-op if Workers are unavailable.
 *
 * Usage:
 *   const { diagnostics, isLinting } = useLintWorker(content);
 */
import { useRef, useEffect, useState, useCallback } from "react";

export interface LintDiagnostic {
    line: number;
    col: number;
    severity: "error" | "warning" | "info";
    message: string;
    source: string;
}

let lintRequestId = 0;

export function useLintWorker(content: string, enabled = true) {
    const workerRef = useRef<Worker | null>(null);
    const [diagnostics, setDiagnostics] = useState<LintDiagnostic[]>([]);
    const [isLinting, setIsLinting] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestIdRef = useRef(0);

    // Initialize worker
    useEffect(() => {
        if (!enabled) return;

        try {
            const worker = new Worker(
                new URL("../workers/lint.worker.ts", import.meta.url),
                { type: "module" },
            );

            worker.addEventListener("message", (e: MessageEvent) => {
                const { id, diagnostics: diags } = e.data;
                // Only accept the latest request
                if (id === latestIdRef.current) {
                    setDiagnostics(diags);
                    setIsLinting(false);
                }
            });

            worker.addEventListener("error", () => {
                workerRef.current = null;
                setIsLinting(false);
            });

            workerRef.current = worker;

            return () => {
                worker.terminate();
                if (timerRef.current) clearTimeout(timerRef.current);
            };
        } catch {
            return;
        }
    }, [enabled]);

    // Debounced lint on content change
    useEffect(() => {
        if (!enabled || !workerRef.current) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            const id = ++lintRequestId;
            latestIdRef.current = id;
            setIsLinting(true);

            workerRef.current?.postMessage({
                id,
                type: "lint",
                content,
            });
        }, 1000); // 1 second debounce

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [content, enabled]);

    /** Force an immediate lint */
    const lintNow = useCallback(() => {
        if (!workerRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);

        const id = ++lintRequestId;
        latestIdRef.current = id;
        setIsLinting(true);

        workerRef.current.postMessage({
            id,
            type: "lint",
            content,
        });
    }, [content]);

    return { diagnostics, isLinting, lintNow };
}
