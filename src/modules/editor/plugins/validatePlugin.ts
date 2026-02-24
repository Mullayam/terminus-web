/**
 * @module editor/plugins/validatePlugin
 *
 * Runtime validation for plugins before registration.
 * Checks required fields, types, and structural correctness.
 * Returns a list of issues — "error" issues block registration,
 * "warning" issues are logged but allowed.
 */
import type { ExtendedEditorPlugin } from "./types";

export interface PluginValidationIssue {
    level: "error" | "warning";
    field: string;
    message: string;
}

export interface PluginValidationResult {
    valid: boolean;
    pluginId: string;
    issues: PluginValidationIssue[];
}

const VALID_CATEGORIES = new Set(["editor", "language", "ai", "ui", "validation", "tools"]);
const ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
const VERSION_REGEX = /^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/;

/**
 * Validate a single plugin object.
 *
 * @example
 * ```ts
 * const result = validatePlugin(myPlugin);
 * if (!result.valid) {
 *   console.error("Plugin invalid:", result.issues);
 * }
 * ```
 */
export function validatePlugin(plugin: unknown): PluginValidationResult {
    const issues: PluginValidationIssue[] = [];

    // ── Must be a non-null object ────────────────────────────
    if (!plugin || typeof plugin !== "object") {
        return {
            valid: false,
            pluginId: "<unknown>",
            issues: [{ level: "error", field: "plugin", message: "Plugin must be a non-null object." }],
        };
    }

    const p = plugin as Record<string, unknown>;
    const pluginId = typeof p.id === "string" ? p.id : "<unknown>";

    // ── Required: id (string) ────────────────────────────────
    if (typeof p.id !== "string" || !p.id.trim()) {
        issues.push({ level: "error", field: "id", message: "Plugin must have a non-empty string `id`." });
    } else if (!ID_REGEX.test(p.id)) {
        issues.push({
            level: "warning",
            field: "id",
            message: `Plugin id "${p.id}" should be lowercase with dots/dashes/underscores (e.g. "my-plugin").`,
        });
    }

    // ── Required: name (string) ──────────────────────────────
    if (typeof p.name !== "string" || !p.name.trim()) {
        issues.push({ level: "error", field: "name", message: "Plugin must have a non-empty string `name`." });
    }

    // ── Required: version (string) ───────────────────────────
    if (typeof p.version !== "string" || !p.version.trim()) {
        issues.push({ level: "error", field: "version", message: "Plugin must have a non-empty string `version`." });
    } else if (!VERSION_REGEX.test(p.version)) {
        issues.push({
            level: "warning",
            field: "version",
            message: `Version "${p.version}" should follow semver (e.g. "1.0.0").`,
        });
    }

    // ── Optional: category ───────────────────────────────────
    if (p.category !== undefined) {
        if (typeof p.category !== "string" || !VALID_CATEGORIES.has(p.category)) {
            issues.push({
                level: "warning",
                field: "category",
                message: `Category "${String(p.category)}" is not one of: ${[...VALID_CATEGORIES].join(", ")}. Will default to "tools".`,
            });
        }
    }

    // ── Optional: description ────────────────────────────────
    if (p.description !== undefined && typeof p.description !== "string") {
        issues.push({ level: "warning", field: "description", message: "Description should be a string." });
    }

    // ── Optional: defaultEnabled ─────────────────────────────
    if (p.defaultEnabled !== undefined && typeof p.defaultEnabled !== "boolean") {
        issues.push({ level: "warning", field: "defaultEnabled", message: "defaultEnabled should be a boolean." });
    }

    // ── Optional: dependencies ───────────────────────────────
    if (p.dependencies !== undefined) {
        if (!Array.isArray(p.dependencies)) {
            issues.push({ level: "warning", field: "dependencies", message: "dependencies should be string[]." });
        } else {
            for (const dep of p.dependencies) {
                if (typeof dep !== "string") {
                    issues.push({ level: "warning", field: "dependencies", message: `Dependency "${String(dep)}" should be a string.` });
                }
            }
        }
    }

    // ── Lifecycle hooks must be functions ─────────────────────
    const hookFields = [
        "onInit", "onMount", "onUnmount",
        "onActivate", "onDeactivate",
        "onContentChange", "onLanguageChange",
        "onSelectionChange", "onSave",
    ];
    for (const field of hookFields) {
        if (p[field] !== undefined && typeof p[field] !== "function") {
            issues.push({
                level: "error",
                field,
                message: `"${field}" must be a function if provided.`,
            });
        }
    }

    // ── panels must be array of PanelDescriptor ──────────────
    if (p.panels !== undefined) {
        if (!Array.isArray(p.panels)) {
            issues.push({ level: "error", field: "panels", message: "panels must be an array." });
        } else {
            for (let i = 0; i < p.panels.length; i++) {
                const panel = p.panels[i] as Record<string, unknown>;
                if (!panel || typeof panel !== "object") {
                    issues.push({ level: "error", field: `panels[${i}]`, message: "Panel must be an object." });
                    continue;
                }
                if (typeof panel.id !== "string") {
                    issues.push({ level: "error", field: `panels[${i}].id`, message: "Panel must have a string id." });
                }
                if (typeof panel.title !== "string") {
                    issues.push({ level: "error", field: `panels[${i}].title`, message: "Panel must have a string title." });
                }
                if (typeof panel.render !== "function") {
                    issues.push({ level: "error", field: `panels[${i}].render`, message: "Panel must have a render function." });
                }
            }
        }
    }

    // ── completionProviders must be valid ─────────────────────
    if (p.completionProviders !== undefined) {
        if (!Array.isArray(p.completionProviders)) {
            issues.push({ level: "error", field: "completionProviders", message: "completionProviders must be an array." });
        } else {
            for (let i = 0; i < p.completionProviders.length; i++) {
                const cp = p.completionProviders[i] as Record<string, unknown>;
                if (!cp || typeof cp !== "object") {
                    issues.push({ level: "error", field: `completionProviders[${i}]`, message: "Provider must be an object." });
                    continue;
                }
                if (typeof cp.id !== "string") {
                    issues.push({ level: "error", field: `completionProviders[${i}].id`, message: "Provider must have a string id." });
                }
                if (typeof cp.provideCompletions !== "function") {
                    issues.push({ level: "error", field: `completionProviders[${i}].provideCompletions`, message: "Provider must have a provideCompletions function." });
                }
            }
        }
    }

    const hasErrors = issues.some((i) => i.level === "error");
    return { valid: !hasErrors, pluginId, issues };
}

/**
 * Validate an array of plugins and return all results.
 * Checks for duplicate IDs and missing dependencies.
 */
export function validatePlugins(plugins: unknown[]): PluginValidationResult[] {
    const results: PluginValidationResult[] = [];
    const seenIds = new Set<string>();

    for (const plugin of plugins) {
        const result = validatePlugin(plugin);
        results.push(result);

        if (result.valid && typeof (plugin as Record<string, unknown>).id === "string") {
            const id = (plugin as Record<string, unknown>).id as string;
            if (seenIds.has(id)) {
                result.issues.push({
                    level: "error",
                    field: "id",
                    message: `Duplicate plugin id "${id}". Each plugin must have a unique id.`,
                });
                result.valid = false;
            }
            seenIds.add(id);
        }
    }

    // ── Cross-check dependencies ─────────────────────────────
    for (const result of results) {
        if (!result.valid) continue;
        const plugin = plugins.find(
            (p) => (p as Record<string, unknown>).id === result.pluginId,
        ) as Record<string, unknown> | undefined;
        const deps = plugin?.dependencies as string[] | undefined;
        if (deps) {
            for (const dep of deps) {
                if (!seenIds.has(dep)) {
                    result.issues.push({
                        level: "warning",
                        field: "dependencies",
                        message: `Dependency "${dep}" is not in the plugin list.`,
                    });
                }
            }
        }
    }

    return results;
}

/**
 * Pretty-print validation results to the console.
 * Returns the number of invalid plugins.
 */
export function logValidationResults(results: PluginValidationResult[]): number {
    let invalidCount = 0;
    for (const r of results) {
        if (r.issues.length === 0) continue;
        const prefix = r.valid ? "⚠" : "✕";
        if (!r.valid) invalidCount++;
        console.groupCollapsed(
            `%c[Plugin Validation] ${prefix} ${r.pluginId}`,
            r.valid ? "color: #f1fa8c" : "color: #ff5555; font-weight: bold",
        );
        for (const issue of r.issues) {
            const icon = issue.level === "error" ? "❌" : "⚠️";
            console.log(`${icon} ${issue.field}: ${issue.message}`);
        }
        console.groupEnd();
    }
    return invalidCount;
}
