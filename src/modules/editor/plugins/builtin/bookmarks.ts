/**
 * @module editor/plugins/builtin/bookmarks
 *
 * Line bookmarks with gutter icons and quick navigation.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, GutterDecoration } from "../types";
import { createElement } from "react";

const bookmarks = new Set<number>();

function toggleBookmark(api: ExtendedPluginAPI) {
    const { line } = api.getCursorPosition();
    if (bookmarks.has(line)) {
        bookmarks.delete(line);
    } else {
        bookmarks.add(line);
    }
    renderBookmarks(api);
}

function renderBookmarks(api: ExtendedPluginAPI) {
    api.clearGutterDecorations("bookmarks");
    const decorations: GutterDecoration[] = Array.from(bookmarks)
        .sort((a, b) => a - b)
        .map((line) => ({
            id: `bookmarks:${line}`,
            line,
            icon: createElement("span", {
                style: { color: "#50fa7b", fontSize: "10px" },
            }, "●"),
            className: "editor-bookmark-gutter",
            hoverMessage: `Bookmark on line ${line}`,
            onClick: () => {
                bookmarks.delete(line);
                renderBookmarks(api);
            },
        }));
    api.addGutterDecorations(decorations);
}

function goToNextBookmark(api: ExtendedPluginAPI) {
    const { line } = api.getCursorPosition();
    const sorted = Array.from(bookmarks).sort((a, b) => a - b);
    const next = sorted.find((b) => b > line) ?? sorted[0];
    if (next) {
        api.executeCommand("goToLine", next);
    }
}

function goToPrevBookmark(api: ExtendedPluginAPI) {
    const { line } = api.getCursorPosition();
    const sorted = Array.from(bookmarks).sort((a, b) => b - a);
    const prev = sorted.find((b) => b < line) ?? sorted[0];
    if (prev) {
        api.executeCommand("goToLine", prev);
    }
}

export function createBookmarksPlugin(): ExtendedEditorPlugin {
    return {
        id: "bookmarks",
        name: "Bookmarks",
        version: "1.0.0",
        description: "Set line bookmarks and navigate between them",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("bookmarks.toggle", () => toggleBookmark(api));
            api.registerCommand("bookmarks.next", () => goToNextBookmark(api));
            api.registerCommand("bookmarks.prev", () => goToPrevBookmark(api));
            api.registerCommand("bookmarks.clear", () => {
                bookmarks.clear();
                api.clearGutterDecorations("bookmarks");
            });

            api.registerKeybinding({
                id: "bookmarks:toggle",
                label: "Toggle Bookmark",
                keys: "Ctrl+Alt+K",
                handler: (e) => { e.preventDefault(); toggleBookmark(api); },
                when: "editor",
                category: "Bookmarks",
            });

            api.registerKeybinding({
                id: "bookmarks:next",
                label: "Next Bookmark",
                keys: "Ctrl+Alt+N",
                handler: (e) => { e.preventDefault(); goToNextBookmark(api); },
                when: "editor",
                category: "Bookmarks",
            });

            api.registerKeybinding({
                id: "bookmarks:prev",
                label: "Previous Bookmark",
                keys: "Ctrl+Alt+P",
                handler: (e) => { e.preventDefault(); goToPrevBookmark(api); },
                when: "editor",
                category: "Bookmarks",
            });
        },

        onDeactivate(api) {
            bookmarks.clear();
            api.clearGutterDecorations("bookmarks");
        },
    };
}
