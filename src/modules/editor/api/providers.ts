/**
 * @module editor/api/providers
 *
 * Strategy Pattern: ContentProvider interface with two concrete implementations:
 *  - ApiContentProvider  → REST API via fetch
 *  - SocketContentProvider → Socket.IO real-time (placeholder, ready for integration)
 *
 * Consumers select a strategy via EditorConfig.providerType.
 */
import type { ContentProvider } from "../types";
import { ApiCore } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════
//  API Content Provider  (REST)
// ═══════════════════════════════════════════════════════════════

export class ApiContentProvider implements ContentProvider {
    async fetchContent(
        sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }> {
        try {
            const data = await ApiCore.fetchFileContent(sessionId, filePath);
            if (!data.status) {
                return { content: "", error: data.message || "Failed to load file content" };
            }
            return { content: data.result };
        } catch (e: unknown) {
            return {
                content: "",
                error: e instanceof Error ? e.message : "Network error while fetching file",
            };
        }
    }

    async saveContent(
        sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await ApiCore.saveFileContent(sessionId, filePath, content);
            return { success: true };
        } catch (e: unknown) {
            return {
                success: false,
                error: e instanceof Error ? e.message : "Network error while saving file",
            };
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  Socket Content Provider  (real-time, ready for integration)
// ═══════════════════════════════════════════════════════════════

/**
 * SocketContentProvider is a placeholder for real-time content loading/saving
 * via Socket.IO. It follows the same ContentProvider interface so the editor
 * can switch providers without changing any UI code.
 *
 * To use: implement the socket event handlers for your backend protocol.
 */
export class SocketContentProvider implements ContentProvider {
    private socket: unknown; // Replace with your Socket.IO instance type

    constructor(socket?: unknown) {
        this.socket = socket;
    }

    async fetchContent(
        sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }> {
        // TODO: Implement socket-based file fetch
        // Example: this.socket.emit('file:read', { sessionId, filePath });
        //          return new Promise((resolve) => this.socket.once('file:content', resolve));
        return {
            content: "",
            error: `Socket provider not yet implemented. SessionId: ${sessionId}, path: ${filePath}`,
        };
    }

    async saveContent(
        sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }> {
        // TODO: Implement socket-based file save
        return {
            success: false,
            error: `Socket save not yet implemented. SessionId: ${sessionId}, path: ${filePath}`,
        };
    }

    /**
     * Subscribe to real-time content updates from other collaborators.
     * Returns an unsubscribe function.
     */
    onContentUpdate(callback: (content: string) => void): () => void {
        // TODO: this.socket.on('file:update', callback);
        // return () => this.socket.off('file:update', callback);
        return () => {};
    }
}

// ═══════════════════════════════════════════════════════════════
//  Factory function
// ═══════════════════════════════════════════════════════════════

/**
 * Create a ContentProvider instance based on the provider type string.
 */
export function createContentProvider(
    type: "api" | "socket" | "custom",
    socket?: unknown,
): ContentProvider {
    switch (type) {
        case "api":
            return new ApiContentProvider();
        case "socket":
            return new SocketContentProvider(socket);
        case "custom":
            // Custom providers are passed directly; this is a fallback
            return new ApiContentProvider();
        default:
            return new ApiContentProvider();
    }
}
