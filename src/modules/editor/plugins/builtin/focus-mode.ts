/**
 * @module editor/plugins/builtin/focus-mode
 *
 * Focus mode (distraction-free) plugin.
 * Hides all chrome (toolbar, status bar, gutter, minimap) and
 * centers the editor content for a clean writing experience.
 * Toggle with Ctrl+Shift+F11 or via context menu.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

const FOCUS_MODE_STYLES = `
.editor-root.focus-mode .editor-toolbar,
.editor-root.focus-mode .editor-statusbar,
.editor-root.focus-mode .editor-find-bar,
.editor-root.focus-mode .editor-goto-bar,
.editor-root.focus-mode .editor-minimap,
.editor-root.focus-mode .editor-theme-selector {
    display: none !important;
}

.editor-root.focus-mode .editor-gutter {
    opacity: 0;
    transition: opacity 0.3s ease;
}

.editor-root.focus-mode:hover .editor-gutter {
    opacity: 0.3;
}

.editor-root.focus-mode {
    position: fixed !important;
    inset: 0 !important;
    z-index: 9999 !important;
    width: 100vw !important;
    height: 100vh !important;
    border-radius: 0 !important;
}

.editor-root.focus-mode .editor-textarea,
.editor-root.focus-mode .editor-syntax-overlay {
    max-width: 80ch;
    margin: 0 auto;
    padding-left: 40px !important;
    padding-right: 40px !important;
}

.editor-focus-exit-hint {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 10000;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 11px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    background: var(--editor-popup-bg, #282a36);
    color: var(--editor-muted, #6272a4);
    border: 1px solid var(--editor-border, #44475a);
}

.editor-root.focus-mode:hover .editor-focus-exit-hint {
    opacity: 0.8;
}
`;

let styleEl: HTMLStyleElement | null = null;
let hintEl: HTMLDivElement | null = null;
let isFocusMode = false;

function enterFocusMode() {
    if (isFocusMode) return;
    isFocusMode = true;

    // Inject styles
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.textContent = FOCUS_MODE_STYLES;
        document.head.appendChild(styleEl);
    }

    // Find the editor root
    const root = document.querySelector(".editor-root");
    if (root) {
        root.classList.add("focus-mode");

        // Add exit hint
        if (!hintEl) {
            hintEl = document.createElement("div");
            hintEl.className = "editor-focus-exit-hint";
            hintEl.textContent = "Press Esc or Ctrl+Shift+F11 to exit focus mode";
            root.appendChild(hintEl);
        }
    }

    // Listen for Escape
    document.addEventListener("keydown", handleFocusEscape);
}

function exitFocusMode() {
    if (!isFocusMode) return;
    isFocusMode = false;

    const root = document.querySelector(".editor-root");
    if (root) {
        root.classList.remove("focus-mode");
        if (hintEl && hintEl.parentNode) {
            hintEl.parentNode.removeChild(hintEl);
            hintEl = null;
        }
    }

    document.removeEventListener("keydown", handleFocusEscape);
}

function toggleFocusMode() {
    if (isFocusMode) exitFocusMode();
    else enterFocusMode();
}

function handleFocusEscape(e: KeyboardEvent) {
    if (e.key === "Escape") {
        exitFocusMode();
    }
}

export function createFocusModePlugin(): ExtendedEditorPlugin {
    return {
        id: "focus-mode",
        name: "Focus Mode",
        version: "1.0.0",
        description: "Distraction-free editing mode that hides all chrome and centers content",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("focusMode.toggle", toggleFocusMode);
            api.registerCommand("focusMode.enter", enterFocusMode);
            api.registerCommand("focusMode.exit", exitFocusMode);

            api.registerKeybinding({
                id: "focus-mode:toggle",
                label: "Toggle Focus Mode",
                keys: "Ctrl+Shift+F11",
                handler: (e) => {
                    e.preventDefault();
                    toggleFocusMode();
                },
                when: "editor",
                category: "View",
            });

            api.addContextMenuItem({
                label: isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode",
                action: toggleFocusMode,
                shortcut: "Ctrl+Shift+F11",
                priority: 80,
            });
        },

        onDeactivate() {
            exitFocusMode();
            if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
                styleEl = null;
            }
        },
    };
}
