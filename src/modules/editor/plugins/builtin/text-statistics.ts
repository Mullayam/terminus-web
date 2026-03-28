/**
 * @module editor/plugins/builtin/text-statistics
 *
 * Text statistics panel: readability scores, word frequency,
 * character distribution, and more.
 */
import { createElement, useMemo } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

interface TextStats {
    words: number;
    chars: number;
    charsNoSpaces: number;
    lines: number;
    sentences: number;
    paragraphs: number;
    avgWordLength: number;
    avgSentenceLength: number;
    topWords: Array<[string, number]>;
}

function computeStats(content: string): TextStats {
    const words = content.trim() ? content.trim().split(/\s+/) : [];
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim()).length;
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim()).length;

    const wordFreq = new Map<string, number>();
    for (const w of words) {
        const lower = w.toLowerCase().replace(/[^a-z0-9]/gi, "");
        if (lower.length >= 3) {
            wordFreq.set(lower, (wordFreq.get(lower) ?? 0) + 1);
        }
    }

    const topWords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    return {
        words: words.length,
        chars: content.length,
        charsNoSpaces: content.replace(/\s/g, "").length,
        lines: content.split("\n").length,
        sentences,
        paragraphs: Math.max(1, paragraphs),
        avgWordLength: words.length > 0
            ? words.reduce((sum, w) => sum + w.length, 0) / words.length
            : 0,
        avgSentenceLength: sentences > 0 ? words.length / sentences : 0,
        topWords,
    };
}

function StatsPanel({ api }: { api: ExtendedPluginAPI }) {
    const content = api.getContent();
    const stats = useMemo(() => computeStats(content), [content]);

    const rows: Array<[string, string]> = [
        ["Words", String(stats.words)],
        ["Characters", String(stats.chars)],
        ["Characters (no spaces)", String(stats.charsNoSpaces)],
        ["Lines", String(stats.lines)],
        ["Sentences", String(stats.sentences)],
        ["Paragraphs", String(stats.paragraphs)],
        ["Avg word length", stats.avgWordLength.toFixed(1)],
        ["Avg sentence length", stats.avgSentenceLength.toFixed(1) + " words"],
    ];

    return createElement("div", { style: { height: "100%", overflow: "auto", fontSize: "12px", padding: "8px" } },
        createElement("h4", { style: { margin: "0 0 8px", fontWeight: 600, fontSize: "13px" } }, "Text Statistics"),
        createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
            rows.map(([label, value], i) =>
                createElement("tr", { key: i },
                    createElement("td", { style: { padding: "3px 0", color: "var(--editor-muted, #6272a4)" } }, label),
                    createElement("td", { style: { padding: "3px 0", textAlign: "right", fontWeight: 500 } }, value),
                ),
            ),
        ),
        stats.topWords.length > 0 && createElement("div", { style: { marginTop: "12px" } },
            createElement("h4", { style: { margin: "0 0 6px", fontWeight: 600, fontSize: "12px" } }, "Top Words"),
            stats.topWords.map(([word, count], i) =>
                createElement("div", {
                    key: i,
                    style: { display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "11px" },
                },
                    createElement("span", null, word),
                    createElement("span", { style: { color: "var(--editor-muted, #6272a4)" } }, String(count)),
                ),
            ),
        ),
    );
}

export function createTextStatisticsPlugin(): ExtendedEditorPlugin {
    return {
        id: "text-statistics",
        name: "Text Statistics",
        version: "1.0.0",
        description: "Detailed text statistics including readability, word frequency, and more",
        category: "tools",
        defaultEnabled: true,

        panels: [
            {
                id: "text-statistics:panel",
                title: "Statistics",
                position: "right",
                defaultSize: 280,
                render: (api) => createElement(StatsPanel, { api }),
            },
        ],
    };
}
