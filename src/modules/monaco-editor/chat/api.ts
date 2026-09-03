/**
 * @module monaco-editor/chat/api
 *
 * API functions for the AI Chat feature.
 *
 * - `fetchProviders(baseUrl)` — GET `ai/providers` to list available AI providers
 * - `streamChat(baseUrl, request, onChunk, signal)` — POST `api/chat` SSE streaming
 */

import type { ChatProvider, ChatRequest, ChatStreamChunk } from "./types";

/* ── Fetch available AI providers ──────────────────────────── */

/**
 * Build a URL with an optional `user=base64(hostId)` query param.
 */
function buildUrl(baseUrl: string, path: string, hostId?: string): string {
    const base = `${baseUrl.replace(/\/$/, "")}${path}`;
    if (!hostId) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}user=${btoa(hostId)}`;
}

/**
 * Fetch the list of available AI providers from the backend.
 * Endpoint: GET `{baseUrl}/ai/providers`
 */
export async function fetchProviders(baseUrl: string, hostId?: string): Promise<ChatProvider[]> {
    const url = buildUrl(baseUrl, "/api/ai/providers", hostId);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Normalize: backend may return { providers: [...] } or just [...]
    if (Array.isArray(data.data)) return data.data;
    if (data?.data?.providers && Array.isArray(data.data.providers)) return data.data.providers;
    return [];
}

/**
 * Keep only the models a surface can actually serve.
 * NVIDIA, for example, is rejected for both inline and hover.
 */
export function filterProvidersBySurface(
    providers: ChatProvider[],
    surface: "inline" | "hover",
): ChatProvider[] {
    const key = surface === "inline" ? "supportsInline" : "supportsHover";
    return providers
        .map((p) => ({ ...p, models: (p.models ?? []).filter((m) => m[key] !== false) }))
        .filter((p) => p.models.length > 0);
}

/* ── Stream chat response ──────────────────────────────────── */

/**
 * Send a chat request and stream the response via SSE.
 * Endpoint: POST `{baseUrl}/api/chat`
 *
 * @param baseUrl  Base API URL (e.g. "http://localhost:7145")
 * @param request  The chat request payload
 * @param onChunk  Callback for each streaming chunk
 * @param signal   Optional AbortSignal for cancellation
 * @returns The accumulated full response text
 */
export async function streamChat(
    baseUrl: string,
    request: ChatRequest,
    onChunk: (chunk: ChatStreamChunk) => void,
    signal?: AbortSignal,
    hostId?: string,
): Promise<string> {
    const url = buildUrl(baseUrl, "/api/chat", hostId);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
            `Chat request failed: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ""}`,
        );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let accumulated = "";

    // SSE frame state, kept across reads because one frame may be split over
    // several network chunks.
    let buffer = "";
    let eventType = "";
    let dataLines: string[] = [];

    // Dispatch one complete SSE frame. Returns true when the stream is finished
    // (a `done`/`[DONE]`/error frame) so the caller stops reading. The backend
    // sends incremental `chunk` frames AND a final `done` frame that repeats the
    // ENTIRE reply — applying both would insert the text twice, so `done` is
    // treated purely as a terminator. `provider` frames are informational.
    const dispatchFrame = (): boolean => {
        const type = eventType;
        const data = dataLines.join("\n");
        eventType = "";
        dataLines = [];
        if (!data) return false;

        if (data === "[DONE]" || type === "done") {
            // Use the terminator's text only when nothing streamed.
            if (!accumulated && data !== "[DONE]") {
                try {
                    const parsed: any = JSON.parse(data);
                    const text = parsed?.text ?? parsed?.content ?? "";
                    if (text) { accumulated += text; onChunk({ content: text }); }
                } catch { /* ignore */ }
            }
            onChunk({ done: true });
            return true;
        }

        if (type === "provider") return false;

        try {
            const parsed: ChatStreamChunk = JSON.parse(data);
            if (parsed.error) {
                onChunk({ error: parsed.error, done: true });
                throw new Error(parsed.error);
            }
            const token =
                parsed.content ??
                (parsed as any)?.choices?.[0]?.delta?.content ??
                (parsed as any)?.text ??
                (parsed as any)?.token ??
                "";
            if (token) {
                accumulated += token;
                onChunk({ content: token, model: parsed.model });
            }
        } catch (e: any) {
            if (e?.message?.startsWith("Chat request failed") || e?.message === data) throw e;
            if (data) {
                accumulated += data;
                onChunk({ content: data });
            }
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
                    if (dispatchFrame()) return accumulated; // blank line ends a frame
                } else if (line.startsWith("event:")) {
                    eventType = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                    dataLines.push(line.slice(5).replace(/^ /, ""));
                } else if (line.startsWith(":") || line.startsWith("id:") || line.startsWith("retry:")) {
                    // SSE comment / non-data field — ignore
                } else if (line.trim()) {
                    // Raw, non-SSE line: treat as a content delta.
                    accumulated += line;
                    onChunk({ content: line });
                }
            }
        }

        // Flush any trailing buffered line, then the final frame.
        const tail = buffer.replace(/\r$/, "");
        if (tail.startsWith("data:")) dataLines.push(tail.slice(5).replace(/^ /, ""));
        else if (tail.startsWith("event:")) eventType = tail.slice(6).trim();
        else if (tail.trim() && !tail.startsWith(":") && !tail.startsWith("id:") && !tail.startsWith("retry:")) {
            accumulated += tail;
            onChunk({ content: tail });
        }
        if (dispatchFrame()) return accumulated;
    } finally {
        reader.releaseLock();
    }

    onChunk({ done: true });
    return accumulated;
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Extract fenced code blocks from markdown content.
 * Returns array of { language, code, startIndex }.
 */
export function extractCodeBlocks(
    content: string,
): Array<{ language: string; code: string; startIndex: number }> {
    const blocks: Array<{ language: string; code: string; startIndex: number }> = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        blocks.push({
            language: match[1] || "plaintext",
            code: match[2].trimEnd(),
            startIndex: match.index,
        });
    }

    return blocks;
}
