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

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") {
                        onChunk({ done: true });
                        return accumulated;
                    }

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
                        // If JSON parse fails, treat as plain text
                        if (e?.message?.startsWith("Chat request failed") || e?.message === data) throw e;
                        if (data) {
                            accumulated += data;
                            onChunk({ content: data });
                        }
                    }
                } else if (
                    line.trim() &&
                    !line.startsWith(":") &&
                    !line.startsWith("event:") &&
                    !line.startsWith("id:")
                ) {
                    // Raw streaming (non-SSE formatted)
                    accumulated += line;
                    onChunk({ content: line });
                }
            }
        }
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
