/**
 * @module editor/plugins/builtin/quick-fix
 *
 * Provides quick fix suggestions for common issues.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic, CodeLensItem } from "../types";

interface QuickFix {
    pattern: RegExp;
    languages: string[];
    getMessage: (match: RegExpMatchArray) => string;
    getFix: (line: string, match: RegExpMatchArray) => string;
}

const QUICK_FIXES: QuickFix[] = [
    {
        pattern: /console\.log\(/,
        languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
        getMessage: () => "Remove console.log",
        getFix: (line) => line.replace(/console\.log\([^)]*\);?\s*/, ""),
    },
    {
        pattern: /var\s+/,
        languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
        getMessage: () => "Convert 'var' to 'const'",
        getFix: (line) => line.replace(/\bvar\s+/, "const "),
    },
    {
        pattern: /==(?!=)/,
        languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
        getMessage: () => "Use strict equality (===)",
        getFix: (line) => line.replace(/==(?!=)/, "==="),
    },
    {
        pattern: /!=(?!=)/,
        languages: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
        getMessage: () => "Use strict inequality (!==)",
        getFix: (line) => line.replace(/!=(?!=)/, "!=="),
    },
];

export function createQuickFixPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "quick-fix",
        name: "Quick Fix",
        version: "1.0.0",
        description: "Quick fix suggestions for common code issues",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 400);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearCodeLenses("quick-fix");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { language } = api.getFileInfo();
    const lang = language.toLowerCase();
    const lines = content.split("\n");
    const lenses: CodeLensItem[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const fix of QUICK_FIXES) {
            if (fix.languages.length > 0 && !fix.languages.some((l) => lang.includes(l))) continue;
            const match = line.match(fix.pattern);
            if (match) {
                const fixedLine = fix.getFix(line, match);
                lenses.push({
                    id: `quick-fix:${i + 1}:${fix.pattern.source}`,
                    line: i + 1,
                    title: `💡 ${fix.getMessage(match)}`,
                    command: `quickFix.apply:${i}`,
                    onClick() {
                        const currentContent = api.getContent();
                        const currentLines = currentContent.split("\n");
                        currentLines[i] = fixedLine;
                        api.setContent(currentLines.join("\n"));
                    },
                });
            }
        }
    }

    api.setCodeLenses(lenses);
}
