/**
 * @module editor/core/utils
 * General-purpose utilities: debounce, HTML escaping, clipboard helpers.
 */

/**
 * Debounce a function call.
 * Returns a debounced version that delays invocation until `ms` milliseconds
 * after the last call. Includes a `.cancel()` method.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    ms: number,
): T & { cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = ((...args: unknown[]) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as T & { cancel: () => void };
    debounced.cancel = () => {
        if (timer) clearTimeout(timer);
    };
    return debounced;
}

/** Escape HTML characters for safe innerHTML rendering */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Generate a short random ID */
export function uid(): string {
    return Math.random().toString(36).slice(2, 10);
}

// ── Clipboard helpers ──────────────────────────────────────

/** Write text to clipboard (best-effort, silent fail) */
export async function clipboardWrite(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/** Read text from clipboard (best-effort) */
export async function clipboardRead(): Promise<string> {
    try {
        return await navigator.clipboard.readText();
    } catch {
        return "";
    }
}
