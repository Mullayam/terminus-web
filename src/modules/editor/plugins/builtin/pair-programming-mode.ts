/**
 * @module editor/plugins/builtin/pair-programming-mode
 *
 * Provides a "pair programming" mode placeholder
 * that tracks cursor positions for collaboration.
 */
import type { ExtendedEditorPlugin } from "../types";

interface CursorInfo {
    userId: string;
    line: number;
    col: number;
    timestamp: number;
}

const remoteCursors = new Map<string, CursorInfo>();

export function createPairProgrammingPlugin(): ExtendedEditorPlugin {
    return {
        id: "pair-programming-mode",
        name: "Pair Programming Mode",
        version: "1.0.0",
        description: "Collaborative cursor tracking for pair programming",
        category: "tools",
        defaultEnabled: false,

        onActivate(api) {
            api.registerCommand("pair.start", () => {
                api.showToast("Pair Programming", "Pair programming mode started. Share your session ID to collaborate.", "default");
            });

            api.registerCommand("pair.stop", () => {
                remoteCursors.clear();
                api.clearInlineDecorations("pair-programming-mode");
                api.showToast("Pair Programming", "Session ended", "default");
            });

            api.registerCommand("pair.updateRemoteCursor", (...args: unknown[]) => {
                const data = args[0] as CursorInfo | undefined;
                if (!data) return;
                remoteCursors.set(data.userId, { ...data, timestamp: Date.now() });
                // Render remote cursors as decorations
                const decorations = Array.from(remoteCursors.values()).map((cursor) => ({
                    id: `pair-programming-mode:cursor:${cursor.userId}`,
                    line: cursor.line,
                    startCol: cursor.col,
                    endCol: cursor.col + 1,
                    style: { backgroundColor: "rgba(189, 147, 249, 0.3)", borderLeft: "2px solid #bd93f9" },
                    hoverMessage: `${cursor.userId} (line ${cursor.line})`,
                }));
                api.clearInlineDecorations("pair-programming-mode");
                api.addInlineDecorations(decorations);
            });
        },

        onDeactivate(api) {
            remoteCursors.clear();
            api.clearInlineDecorations("pair-programming-mode");
        },
    };
}
