/**
 * @module editor/plugins/builtin/smooth-caret
 *
 * Smooth caret/cursor animation via CSS injection.
 */
import type { ExtendedEditorPlugin } from "../types";

const SMOOTH_CARET_STYLES = `
.editor-textarea {
    caret-color: var(--editor-caret, #f8f8f2);
}

@keyframes editor-caret-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

.editor-cursor-overlay {
    transition: left 80ms ease-out, top 80ms ease-out;
    animation: editor-caret-blink 1s ease-in-out infinite;
}
`;

let styleEl: HTMLStyleElement | null = null;

export function createSmoothCaretPlugin(): ExtendedEditorPlugin {
    return {
        id: "smooth-caret",
        name: "Smooth Caret",
        version: "1.0.0",
        description: "Adds smooth animation to the cursor/caret movement",
        category: "ui",
        defaultEnabled: true,

        onActivate() {
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.textContent = SMOOTH_CARET_STYLES;
                document.head.appendChild(styleEl);
            }
        },

        onDeactivate() {
            if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
                styleEl = null;
            }
        },
    };
}
