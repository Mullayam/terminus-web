/**
 * @module editor/plugins/builtin/line-sorter-advanced
 *
 * Advanced line sorting: numeric, natural, reverse, unique, shuffle.
 */
import type { ExtendedEditorPlugin } from "../types";

function naturalCompare(a: string, b: string): number {
    const pa = a.split(/(\d+)/);
    const pb = b.split(/(\d+)/);
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        const na = Number(pa[i]);
        const nb = Number(pb[i]);
        if (!isNaN(na) && !isNaN(nb)) {
            if (na !== nb) return na - nb;
        } else {
            if (pa[i] < pb[i]) return -1;
            if (pa[i] > pb[i]) return 1;
        }
    }
    return pa.length - pb.length;
}

export function createLineSorterAdvancedPlugin(): ExtendedEditorPlugin {
    return {
        id: "line-sorter-advanced",
        name: "Advanced Line Sorter",
        version: "1.0.0",
        description: "Sort lines: numeric, natural, unique, shuffle, reverse",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            function getSelectedLines(): { lines: string[]; hasSel: boolean } {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return { lines: [], hasSel: false };
                const text = api.getContent().slice(sel.start, sel.end);
                return { lines: text.split("\n"), hasSel: true };
            }

            api.registerCommand("sort.natural", () => {
                const { lines, hasSel } = getSelectedLines();
                if (!hasSel) return;
                api.replaceSelection(lines.sort(naturalCompare).join("\n"));
            });

            api.registerCommand("sort.numeric", () => {
                const { lines, hasSel } = getSelectedLines();
                if (!hasSel) return;
                api.replaceSelection(
                    lines.sort((a, b) => {
                        const na = parseFloat(a.replace(/[^\d.-]/g, ""));
                        const nb = parseFloat(b.replace(/[^\d.-]/g, ""));
                        return (isNaN(na) ? Infinity : na) - (isNaN(nb) ? Infinity : nb);
                    }).join("\n")
                );
            });

            api.registerCommand("sort.reverse", () => {
                const { lines, hasSel } = getSelectedLines();
                if (!hasSel) return;
                api.replaceSelection(lines.reverse().join("\n"));
            });

            api.registerCommand("sort.unique", () => {
                const { lines, hasSel } = getSelectedLines();
                if (!hasSel) return;
                api.replaceSelection([...new Set(lines)].join("\n"));
            });

            api.registerCommand("sort.shuffle", () => {
                const { lines, hasSel } = getSelectedLines();
                if (!hasSel) return;
                for (let i = lines.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [lines[i], lines[j]] = [lines[j], lines[i]];
                }
                api.replaceSelection(lines.join("\n"));
            });

            api.registerCommand("sort.byLength", () => {
                const { lines, hasSel } = getSelectedLines();
                if (!hasSel) return;
                api.replaceSelection(lines.sort((a, b) => a.length - b.length).join("\n"));
            });
        },
    };
}
