/**
 * @module editor/plugins/builtin/date-formatter
 *
 * Inserts dates in various formats, detects and reformats date strings.
 */
import type { ExtendedEditorPlugin } from "../types";

const DATE_FORMATS: Record<string, (d: Date) => string> = {
    iso: (d) => d.toISOString(),
    locale: (d) => d.toLocaleString(),
    date: (d) => d.toLocaleDateString(),
    time: (d) => d.toLocaleTimeString(),
    relative: (d) => {
        const diff = Date.now() - d.getTime();
        const secs = Math.floor(diff / 1000);
        if (secs < 60) return `${secs}s ago`;
        const mins = Math.floor(secs / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    },
    "yyyy-mm-dd": (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    "dd/mm/yyyy": (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
    "mm/dd/yyyy": (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`,
    unix: (d) => String(Math.floor(d.getTime() / 1000)),
    unixms: (d) => String(d.getTime()),
};

export function createDateFormatterPlugin(): ExtendedEditorPlugin {
    return {
        id: "date-formatter",
        name: "Date Formatter",
        version: "1.0.0",
        description: "Insert and convert dates in various formats",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            for (const [format, formatter] of Object.entries(DATE_FORMATS)) {
                api.registerCommand(`date.insert.${format}`, () => {
                    api.replaceSelection(formatter(new Date()));
                });
            }

            api.registerCommand("date.convert", (...args: unknown[]) => {
                const targetFormat = typeof args[0] === "string" ? args[0] : "iso";
                const formatter = DATE_FORMATS[targetFormat] ?? DATE_FORMATS.iso;

                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const text = api.getContent().slice(sel.start, sel.end).trim();
                const date = new Date(text);

                if (isNaN(date.getTime())) {
                    // Try unix timestamp
                    const num = parseInt(text);
                    if (!isNaN(num)) {
                        const d = new Date(num > 1e12 ? num : num * 1000);
                        if (!isNaN(d.getTime())) {
                            api.replaceSelection(formatter(d));
                            return;
                        }
                    }
                    api.showToast("Date Formatter", "Could not parse date", "default");
                    return;
                }

                api.replaceSelection(formatter(date));
            });
        },
    };
}
