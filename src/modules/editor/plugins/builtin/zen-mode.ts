/**
 * @module editor/plugins/builtin/zen-mode
 *
 * Zen mode — removes all UI distractions, larger font, centered content.
 */
import type { ExtendedEditorPlugin } from "../types";

const ZEN_STYLES = `
.editor-root.zen-mode {
    position: fixed !important;
    inset: 0 !important;
    z-index: 9998 !important;
    background: var(--editor-bg, #282a36) !important;
    display: flex;
    justify-content: center;
    padding: 40px 0;
}

.editor-root.zen-mode .editor-toolbar,
.editor-root.zen-mode .editor-statusbar,
.editor-root.zen-mode .editor-minimap,
.editor-root.zen-mode .editor-gutter {
    display: none !important;
}

.editor-root.zen-mode .editor-textarea,
.editor-root.zen-mode .editor-syntax-overlay {
    max-width: 70ch;
    margin: 0 auto;
    font-size: 16px !important;
    line-height: 1.8 !important;
}

.editor-zen-hint {
    position: fixed;
    bottom: 10px;
    right: 10px;
    z-index: 9999;
    padding: 4px 10px;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.3s;
    background: var(--editor-popup-bg, #282a36);
    color: var(--editor-muted, #6272a4);
    border-radius: 4px;
    pointer-events: none;
}

.editor-root.zen-mode:hover .editor-zen-hint {
    opacity: 0.6;
}
`;

let styleEl: HTMLStyleElement | null = null;
let hintEl: HTMLDivElement | null = null;
let isZenMode = false;

function enterZen() {
    if (isZenMode) return;
    isZenMode = true;

    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.textContent = ZEN_STYLES;
        document.head.appendChild(styleEl);
    }

    const root = document.querySelector(".editor-root");
    if (root) {
        root.classList.add("zen-mode");
        if (!hintEl) {
            hintEl = document.createElement("div");
            hintEl.className = "editor-zen-hint";
            hintEl.textContent = "Esc to exit Zen Mode";
            root.appendChild(hintEl);
        }
    }

    document.addEventListener("keydown", handleZenEscape);
}

function exitZen() {
    if (!isZenMode) return;
    isZenMode = false;

    const root = document.querySelector(".editor-root");
    if (root) {
        root.classList.remove("zen-mode");
        if (hintEl?.parentNode) {
            hintEl.parentNode.removeChild(hintEl);
            hintEl = null;
        }
    }

    document.removeEventListener("keydown", handleZenEscape);
}

function toggleZen() {
    if (isZenMode) exitZen();
    else enterZen();
}

function handleZenEscape(e: KeyboardEvent) {
    if (e.key === "Escape") exitZen();
}

export function createZenModePlugin(): ExtendedEditorPlugin {
    return {
        id: "zen-mode",
        name: "Zen Mode",
        version: "1.0.0",
        description: "Distraction-free writing mode with larger font and centered content",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("zenMode.toggle", toggleZen);
            api.registerCommand("zenMode.enter", enterZen);
            api.registerCommand("zenMode.exit", exitZen);

            api.registerKeybinding({
                id: "zen-mode:toggle",
                label: "Toggle Zen Mode",
                keys: "Ctrl+K Z",
                handler: (e) => { e.preventDefault(); toggleZen(); },
                when: "editor",
                category: "View",
            });
        },

        onDeactivate() {
            exitZen();
            if (styleEl?.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
                styleEl = null;
            }
        },
    };
}
