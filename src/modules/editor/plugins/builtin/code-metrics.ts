/**
 * @module editor/plugins/builtin/code-metrics
 *
 * Calculates and displays code complexity metrics.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

interface Metrics {
    cyclomaticComplexity: number;
    functions: number;
    classes: number;
    imports: number;
    maxNesting: number;
}

function calculateMetrics(content: string): Metrics {
    const lines = content.split("\n");
    let complexity = 1;
    let functions = 0;
    let classes = 0;
    let imports = 0;
    let currentNesting = 0;
    let maxNesting = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        // Complexity: count decision points
        const branches = (trimmed.match(/\b(if|else if|elif|while|for|case|catch|&&|\|\||\?)\b/g) || []).length;
        complexity += branches;

        // Functions
        if (/\b(function|def|fn|func)\b/.test(trimmed) || /=>\s*{/.test(trimmed)) functions++;

        // Classes
        if (/\bclass\b/.test(trimmed)) classes++;

        // Imports
        if (/^(import|from|require|use)\b/.test(trimmed)) imports++;

        // Nesting
        const opens = (trimmed.match(/{/g) || []).length;
        const closes = (trimmed.match(/}/g) || []).length;
        currentNesting += opens - closes;
        maxNesting = Math.max(maxNesting, currentNesting);
    }

    return { cyclomaticComplexity: complexity, functions, classes, imports, maxNesting };
}

export function createCodeMetricsPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "code-metrics",
        name: "Code Metrics",
        version: "1.0.0",
        description: "Displays code complexity and structural metrics",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            update(api);

            api.registerCommand("codeMetrics.show", () => {
                const content = api.getContent();
                const m = calculateMetrics(content);
                api.showToast("Code Metrics",
                    `Complexity: ${m.cyclomaticComplexity} | Functions: ${m.functions} | Classes: ${m.classes} | Max Nesting: ${m.maxNesting}`,
                    "default"
                );
            });
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("code-metrics");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const m = calculateMetrics(content);

    // Display as an inline annotation positioned after line 1.
    // PluginStatusBar picks up annotations with id prefix "code-metrics:"
    // to render them in the status bar instead of the canvas.
    const annotations: InlineAnnotation[] = [
        {
            id: "code-metrics:summary",
            line: 1,
            text: `⚡ CC:${m.cyclomaticComplexity} fn:${m.functions} cls:${m.classes} nest:${m.maxNesting}`,
            style: { display: "none" },
        },
    ];

    api.setInlineAnnotations(annotations);
}
