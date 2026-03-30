/**
 * @module editor/plugins/builtin/typescript-helpers
 *
 * TypeScript-specific helpers: add missing imports suggestion,
 * type assertion shortcuts, interface generation from objects.
 */
import type { ExtendedEditorPlugin, CompletionProvider, CompletionItem, CompletionContext } from "../types";

import { TS_FAMILY as TS_LANGUAGES } from "@/modules/monaco-editor/lib/language/language-groups";

const COMMON_TYPES: Record<string, string> = {
    "useState": "import { useState } from 'react';",
    "useEffect": "import { useEffect } from 'react';",
    "useRef": "import { useRef } from 'react';",
    "useMemo": "import { useMemo } from 'react';",
    "useCallback": "import { useCallback } from 'react';",
    "useContext": "import { useContext } from 'react';",
    "useReducer": "import { useReducer } from 'react';",
    "createElement": "import { createElement } from 'react';",
    "ReactNode": "import type { ReactNode } from 'react';",
    "FC": "import type { FC } from 'react';",
    "ChangeEvent": "import type { ChangeEvent } from 'react';",
    "MouseEvent": "import type { MouseEvent } from 'react';",
    "FormEvent": "import type { FormEvent } from 'react';",
    "KeyboardEvent": "import type { KeyboardEvent } from 'react';",
};

class TypeScriptCompletionProvider implements CompletionProvider {
    id = "typescript-helpers:completions";
    triggerCharacters = [" ", "."];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const lang = ctx.language.toLowerCase();
        if (!TS_LANGUAGES.has(lang) && lang !== "javascript" && lang !== "jsx") return [];

        const items: CompletionItem[] = [];
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 2) return [];

        // Type assertion snippets
        if (word === "as") {
            items.push(
                { label: "as string", kind: "snippet", insertText: "as string", detail: "Type assertion", sortOrder: 0 },
                { label: "as number", kind: "snippet", insertText: "as number", detail: "Type assertion", sortOrder: 0 },
                { label: "as boolean", kind: "snippet", insertText: "as boolean", detail: "Type assertion", sortOrder: 0 },
                { label: "as unknown", kind: "snippet", insertText: "as unknown", detail: "Type assertion", sortOrder: 0 },
                { label: "as any", kind: "snippet", insertText: "as any", detail: "Type assertion", sortOrder: 0 },
                { label: "as const", kind: "snippet", insertText: "as const", detail: "Const assertion", sortOrder: 0 },
            );
        }

        // Common utility types
        for (const [name, importStatement] of Object.entries(COMMON_TYPES)) {
            if (name.toLowerCase().startsWith(word)) {
                items.push({
                    label: name,
                    kind: "function",
                    insertText: name,
                    detail: importStatement,
                    sortOrder: 1,
                });
            }
        }

        return items.slice(0, 20);
    }
}

export function createTypescriptHelpersPlugin(): ExtendedEditorPlugin {
    return {
        id: "typescript-helpers",
        name: "TypeScript Helpers",
        version: "1.0.0",
        description: "TypeScript-specific completions, type assertions, and common import suggestions",
        category: "language",
        defaultEnabled: true,

        completionProviders: [new TypeScriptCompletionProvider()],

        onActivate(api) {
            api.registerCommand("ts.addImport", (...args: unknown[]) => {
                const name = typeof args[0] === "string" ? args[0] : "";
                const importLine = COMMON_TYPES[name];
                if (!importLine) return;

                const content = api.getContent();
                if (content.includes(importLine)) return;

                // Add import at the top of the file
                const lines = content.split("\n");
                let insertIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith("import ")) insertIndex = i + 1;
                    else if (insertIndex > 0 && lines[i].trim()) break;
                }
                lines.splice(insertIndex, 0, importLine);
                api.setContent(lines.join("\n"));
            });
        },
    };
}
