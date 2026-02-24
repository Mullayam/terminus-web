/**
 * @module editor/formatters
 *
 * Strategy Pattern: Each formatter implements `FormatterFn` and is registered
 * via `FormatterRegistry`. The registry maps file extensions to formatters.
 *
 * Included formatters:
 *  - JSON   (parse + pretty-print)
 *  - YAML   (normalise indentation, trim, consistent spacing)
 *  - TOML   (normalise spacing around `=`, group sections)
 *  - Dockerfile (normalise instructions, indent continuations)
 *  - .env   (trim, sort keys, align `=`, remove blank duplicates)
 */
import type { FormatterFn, FormatterDefinition } from "../types";

// ═══════════════════════════════════════════════════════════════
//  Registry
// ═══════════════════════════════════════════════════════════════

export class FormatterRegistry {
    private static formatters: Map<string, FormatterDefinition> = new Map();
    private static extMap: Map<string, FormatterDefinition> = new Map();

    /** Register a formatter definition */
    static register(def: FormatterDefinition): void {
        FormatterRegistry.formatters.set(def.name, def);
        for (const ext of def.extensions) {
            FormatterRegistry.extMap.set(ext, def);
        }
    }

    /** Unregister a formatter by name */
    static unregister(name: string): void {
        const def = FormatterRegistry.formatters.get(name);
        if (!def) return;
        FormatterRegistry.formatters.delete(name);
        for (const ext of def.extensions) {
            if (FormatterRegistry.extMap.get(ext) === def) {
                FormatterRegistry.extMap.delete(ext);
            }
        }
    }

    /** Get the formatter for a file extension (lowercase, no dot) */
    static getForExtension(ext: string): FormatterDefinition | undefined {
        return FormatterRegistry.extMap.get(ext.toLowerCase());
    }

    /** Get all registered formatters */
    static getAll(): FormatterDefinition[] {
        return Array.from(FormatterRegistry.formatters.values());
    }

    /**
     * Format content for a given file extension.
     * Returns `null` if no formatter is available.
     */
    static format(ext: string, content: string): { formatted: string; error?: string } | null {
        const def = FormatterRegistry.getForExtension(ext);
        if (!def) return null;
        return def.format(content);
    }
}

// ═══════════════════════════════════════════════════════════════
//  JSON Formatter
// ═══════════════════════════════════════════════════════════════

export const jsonFormatter: FormatterFn = (content) => {
    try {
        const parsed = JSON.parse(content);
        return { formatted: JSON.stringify(parsed, null, 2) };
    } catch (e: unknown) {
        return { formatted: content, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
};

// ═══════════════════════════════════════════════════════════════
//  YAML Formatter
// ═══════════════════════════════════════════════════════════════

export const yamlFormatter: FormatterFn = (content) => {
    try {
        const lines = content.split("\n");
        const formatted = lines.map((line) => {
            // Trim trailing whitespace
            let l = line.trimEnd();
            // Normalise key: value spacing (ensure space after colon)
            l = l.replace(/^(\s*[\w.-]+):(?!\s|$)/gm, "$1: ");
            // Normalise indentation to 2-space multiples
            const match = l.match(/^(\s*)/);
            if (match && match[1].length > 0) {
                const spaces = match[1].length;
                const normalised = Math.round(spaces / 2) * 2;
                l = " ".repeat(normalised) + l.trimStart();
            }
            return l;
        });
        // Remove consecutive blank lines (keep max 1)
        const result: string[] = [];
        let prevBlank = false;
        for (const line of formatted) {
            const isBlank = line.trim() === "";
            if (isBlank && prevBlank) continue;
            result.push(line);
            prevBlank = isBlank;
        }
        return { formatted: result.join("\n") };
    } catch (e: unknown) {
        return { formatted: content, error: e instanceof Error ? e.message : "YAML format error" };
    }
};

// ═══════════════════════════════════════════════════════════════
//  TOML Formatter
// ═══════════════════════════════════════════════════════════════

export const tomlFormatter: FormatterFn = (content) => {
    try {
        const lines = content.split("\n");
        const result: string[] = [];
        let prevIsSection = false;

        for (const raw of lines) {
            let line = raw.trimEnd();

            // Section header [section] or [[array]]
            const isSectionHead = /^\s*\[{1,2}[^\]]+]{1,2}\s*$/.test(line);
            if (isSectionHead) {
                // Ensure blank line before sections (except at start)
                if (result.length > 0 && result[result.length - 1].trim() !== "") {
                    result.push("");
                }
                line = line.trim();
                prevIsSection = true;
                result.push(line);
                continue;
            }

            prevIsSection = false;

            // Skip pure comments and blanks
            if (line.trim().startsWith("#") || line.trim() === "") {
                result.push(line);
                continue;
            }

            // Normalise key = value  →  key = value (single space around =)
            line = line.replace(/^(\s*[\w.-]+)\s*=\s*/, "$1 = ");
            result.push(line);
        }

        return { formatted: result.join("\n") };
    } catch (e: unknown) {
        return { formatted: content, error: e instanceof Error ? e.message : "TOML format error" };
    }
};

// ═══════════════════════════════════════════════════════════════
//  Dockerfile Formatter
// ═══════════════════════════════════════════════════════════════

const DOCKER_INSTRUCTIONS = new Set([
    "FROM", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV",
    "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR",
    "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL",
]);

export const dockerfileFormatter: FormatterFn = (content) => {
    try {
        const lines = content.split("\n");
        const result: string[] = [];
        let prevInstruction = "";

        for (const raw of lines) {
            let line = raw.trimEnd();

            // Blank line or comment → pass through
            if (line.trim() === "" || line.trim().startsWith("#")) {
                result.push(line);
                prevInstruction = "";
                continue;
            }

            // Continuation line (starts with whitespace, prev ended with \)
            if (/^\s+/.test(line) && result.length > 0 && result[result.length - 1].trimEnd().endsWith("\\")) {
                // Normalise continuation indent to 4 spaces
                result.push("    " + line.trim());
                continue;
            }

            // Detect instruction keyword and uppercase it
            const match = line.match(/^\s*(\w+)\s/);
            if (match && DOCKER_INSTRUCTIONS.has(match[1].toUpperCase())) {
                const instr = match[1].toUpperCase();
                line = instr + line.substring(match[0].length - 1);

                // Add blank line between different instruction groups
                if (prevInstruction && prevInstruction !== instr && result.length > 0 && result[result.length - 1].trim() !== "") {
                    result.push("");
                }
                prevInstruction = instr;
            }

            result.push(line);
        }

        return { formatted: result.join("\n") };
    } catch (e: unknown) {
        return { formatted: content, error: e instanceof Error ? e.message : "Dockerfile format error" };
    }
};

// ═══════════════════════════════════════════════════════════════
//  .env Formatter
// ═══════════════════════════════════════════════════════════════

export const envFormatter: FormatterFn = (content) => {
    try {
        const lines = content.split("\n");
        const comments: string[] = [];
        const entries: { key: string; value: string }[] = [];

        for (const raw of lines) {
            const line = raw.trim();
            if (line === "") continue;
            if (line.startsWith("#")) {
                comments.push(line);
                continue;
            }
            const eqIdx = line.indexOf("=");
            if (eqIdx === -1) {
                // Treat as comment
                comments.push(`# ${line}`);
                continue;
            }
            const key = line.substring(0, eqIdx).trim();
            const value = line.substring(eqIdx + 1).trim();
            // Remove duplicates (keep last occurrence)
            const existIdx = entries.findIndex((e) => e.key === key);
            if (existIdx >= 0) entries.splice(existIdx, 1);
            entries.push({ key, value });
        }

        // Sort entries alphabetically by key
        entries.sort((a, b) => a.key.localeCompare(b.key));

        // Build output
        const result: string[] = [];
        if (comments.length > 0) {
            result.push(...comments, "");
        }
        for (const e of entries) {
            result.push(`${e.key}=${e.value}`);
        }

        return { formatted: result.join("\n") };
    } catch (e: unknown) {
        return { formatted: content, error: e instanceof Error ? e.message : ".env format error" };
    }
};

// ═══════════════════════════════════════════════════════════════
//  Auto-registration of built-in formatters
// ═══════════════════════════════════════════════════════════════

FormatterRegistry.register({
    name: "JSON",
    extensions: ["json"],
    format: jsonFormatter,
});

FormatterRegistry.register({
    name: "YAML",
    extensions: ["yaml", "yml"],
    format: yamlFormatter,
});

FormatterRegistry.register({
    name: "TOML",
    extensions: ["toml"],
    format: tomlFormatter,
});

FormatterRegistry.register({
    name: "Dockerfile",
    extensions: ["dockerfile"],
    format: dockerfileFormatter,
});

FormatterRegistry.register({
    name: ".env",
    extensions: ["env"],
    format: envFormatter,
});
