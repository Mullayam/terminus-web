/**
 * @module editor/plugins/builtin/cursor-history
 *
 * Navigate back/forward through cursor position history.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

interface CursorPosition {
    line: number;
    col: number;
    offset: number;
}

const MAX_HISTORY = 50;

export function createCursorHistoryPlugin(): ExtendedEditorPlugin {
    const history: CursorPosition[] = [];
    let historyIndex = -1;
    let lastLine = -1;
    let navigating = false;

    function recordPosition(api: ExtendedPluginAPI) {
        if (navigating) return;
        const pos = api.getCursorPosition();
        // Only record when line changes
        if (pos.line === lastLine) return;
        lastLine = pos.line;

        // Trim forward history
        if (historyIndex < history.length - 1) {
            history.splice(historyIndex + 1);
        }

        history.push({ line: pos.line, col: pos.col, offset: pos.offset });
        if (history.length > MAX_HISTORY) history.shift();
        historyIndex = history.length - 1;
    }

    function goBack(api: ExtendedPluginAPI) {
        if (historyIndex <= 0) return;
        historyIndex--;
        navigating = true;
        const pos = history[historyIndex];
        api.setSelection(pos.offset, pos.offset);
        lastLine = pos.line;
        navigating = false;
    }

    function goForward(api: ExtendedPluginAPI) {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        navigating = true;
        const pos = history[historyIndex];
        api.setSelection(pos.offset, pos.offset);
        lastLine = pos.line;
        navigating = false;
    }

    return {
        id: "cursor-history",
        name: "Cursor History",
        version: "1.0.0",
        description: "Navigate back and forward through cursor position history",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("cursorHistory.back", () => goBack(api));
            api.registerCommand("cursorHistory.forward", () => goForward(api));

            api.registerKeybinding({
                id: "cursor-history:back",
                label: "Go Back",
                keys: "Alt+Left",
                handler: (e) => { e.preventDefault(); goBack(api); },
                when: "editor",
                category: "Navigation",
            });

            api.registerKeybinding({
                id: "cursor-history:forward",
                label: "Go Forward",
                keys: "Alt+Right",
                handler: (e) => { e.preventDefault(); goForward(api); },
                when: "editor",
                category: "Navigation",
            });
        },

        onSelectionChange(_sel, api) {
            recordPosition(api);
        },
    };
}
