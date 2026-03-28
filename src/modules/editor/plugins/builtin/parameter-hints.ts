/**
 * @module editor/plugins/builtin/parameter-hints
 *
 * Shows parameter hints for function calls.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

interface FunctionSignature {
    name: string;
    params: string[];
}

function extractFunctions(content: string): FunctionSignature[] {
    const sigs: FunctionSignature[] = [];
    const regex = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)|function)\s*\(([^)]*)\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        const params = match[2]
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
        sigs.push({ name, params });
    }

    // Also match arrow functions
    const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
        const name = match[1];
        const params = match[2]
            .split(",")
            .map((p) => p.trim().split(":")[0].trim().split("=")[0].trim())
            .filter(Boolean);
        sigs.push({ name, params });
    }

    return sigs;
}

export function createParameterHintsPlugin(): ExtendedEditorPlugin {
    return {
        id: "parameter-hints",
        name: "Parameter Hints",
        version: "1.0.0",
        description: "Shows parameter hints for function calls at cursor",
        category: "language",
        defaultEnabled: true,

        onSelectionChange(_sel, api) {
            updateHints(api);
        },

        onDeactivate(api) {
            api.clearInlineAnnotations("parameter-hints");
        },
    };
}

function updateHints(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const lines = content.split("\n");
    const { line, col } = api.getCursorPosition();
    const currentLine = lines[line - 1] || "";

    // Check if cursor is inside a function call
    const beforeCursor = currentLine.slice(0, col);
    const callMatch = beforeCursor.match(/(\w+)\s*\([^)]*$/);
    if (!callMatch) {
        api.clearInlineAnnotations("parameter-hints");
        return;
    }

    const funcName = callMatch[1];
    const signatures = extractFunctions(content);
    const sig = signatures.find((s) => s.name === funcName);

    if (!sig || sig.params.length === 0) {
        api.clearInlineAnnotations("parameter-hints");
        return;
    }

    // Count commas to determine active parameter
    const argsText = beforeCursor.slice(callMatch.index! + funcName.length + 1);
    const commas = (argsText.match(/,/g) || []).length;
    const activeParam = Math.min(commas, sig.params.length - 1);

    const paramHint = sig.params
        .map((p, i) => (i === activeParam ? `**${p}**` : p))
        .join(", ");

    const annotation: InlineAnnotation = {
        id: "parameter-hints:hint",
        line,
        text: `  ${funcName}(${paramHint})`,
        style: { opacity: 0.5, fontSize: "11px", fontStyle: "italic" },
    };

    api.setInlineAnnotations([annotation]);
}
