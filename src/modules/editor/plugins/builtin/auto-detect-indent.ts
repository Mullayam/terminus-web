/**
 * @module editor/plugins/builtin/auto-detect-indent
 *
 * Auto-detect indentation style plugin.
 * Analyzes file content to determine whether the file uses
 * tabs or spaces, and the indentation width. Configures the
 * editor's tabSize automatically to match.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

interface IndentInfo {
    type: "spaces" | "tabs" | "mixed" | "unknown";
    size: number;
    confidence: number;
}

function detectIndentation(content: string): IndentInfo {
    const lines = content.split("\n");
    let spaceCount = 0;
    let tabCount = 0;
    const indentSizes: Record<number, number> = {};
    const diffSizes: Record<number, number> = {};
    let prevIndent = 0;

    for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines

        const indentMatch = line.match(/^(\s+)/);
        if (!indentMatch) {
            prevIndent = 0;
            continue;
        }

        const indent = indentMatch[1];

        if (indent.includes("\t") && indent.includes(" ")) {
            // Mixed – count both
            tabCount++;
            spaceCount++;
        } else if (indent.includes("\t")) {
            tabCount++;
        } else {
            spaceCount++;
            const len = indent.length;
            indentSizes[len] = (indentSizes[len] ?? 0) + 1;

            // Track indent differences between consecutive lines
            const diff = Math.abs(len - prevIndent);
            if (diff > 0 && diff <= 8) {
                diffSizes[diff] = (diffSizes[diff] ?? 0) + 1;
            }
            prevIndent = len;
        }
    }

    const totalIndented = spaceCount + tabCount;
    if (totalIndented === 0) {
        return { type: "unknown", size: 2, confidence: 0 };
    }

    // Determine type
    let type: IndentInfo["type"];
    if (tabCount > spaceCount * 2) {
        type = "tabs";
    } else if (spaceCount > tabCount * 2) {
        type = "spaces";
    } else if (tabCount > 0 && spaceCount > 0) {
        type = "mixed";
    } else {
        type = spaceCount > 0 ? "spaces" : "tabs";
    }

    // Determine size from most common indent difference
    let bestSize = 2;
    let bestCount = 0;
    for (const [size, count] of Object.entries(diffSizes)) {
        const s = parseInt(size);
        if (s >= 1 && s <= 8 && count > bestCount) {
            bestCount = count;
            bestSize = s;
        }
    }

    // Also check most common absolute indent (for files with consistent depth)
    if (bestCount === 0) {
        for (const [size, count] of Object.entries(indentSizes)) {
            const s = parseInt(size);
            if (s >= 1 && s <= 8 && count > bestCount) {
                bestCount = count;
                bestSize = s;
            }
        }
    }

    // GCD of common indent sizes as fallback
    const commonSizes = Object.keys(indentSizes).map(Number).filter((s) => s > 0);
    if (commonSizes.length > 0 && bestCount === 0) {
        const gcd = commonSizes.reduce((a, b) => {
            while (b) { [a, b] = [b, a % b]; }
            return a;
        });
        if (gcd >= 1 && gcd <= 8) bestSize = gcd;
    }

    const confidence = totalIndented > 10 ? 1 : totalIndented / 10;

    return { type, size: bestSize, confidence };
}

export function createAutoDetectIndentPlugin(): ExtendedEditorPlugin {
    return {
        id: "auto-detect-indent",
        name: "Auto-Detect Indentation",
        version: "1.0.0",
        description: "Automatically detects and configures indentation style (tabs/spaces and size)",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            const content = api.getContent();
            if (content) {
                applyDetectedIndent(content, api);
            }

            api.registerCommand("indent.detect", () => {
                const content = api.getContent();
                const info = detectIndentation(content);
                api.showToast(
                    "Indentation Detected",
                    `Type: ${info.type}, Size: ${info.size}, Confidence: ${(info.confidence * 100).toFixed(0)}%`,
                    "default",
                );
            });
        },

        onLanguageChange(_language, api) {
            // Re-detect on language change (file might have switched)
            const content = api.getContent();
            if (content) {
                applyDetectedIndent(content, api);
            }
        },
    };
}

function applyDetectedIndent(content: string, api: ExtendedPluginAPI) {
    const info = detectIndentation(content);
    if (info.confidence >= 0.3 && info.type !== "unknown") {
        // Access store to set tabSize
        const state = api.getState() as { setTabSize?: (size: number) => void };
        if (typeof state.setTabSize === "function") {
            state.setTabSize(info.size);
        }
    }
}
