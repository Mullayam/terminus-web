/**
 * @module editor/plugins/definePlugin
 *
 * Helper utilities for creating custom plugins.
 *
 * ## Quick Start
 *
 * ```ts
 * import { definePlugin } from "@/modules/editor";
 *
 * const myPlugin = definePlugin({
 *   id: "my-custom-plugin",
 *   name: "My Custom Plugin",
 *   version: "1.0.0",
 *   description: "Adds custom behavior to the editor",
 *   category: "tools",
 *   defaultEnabled: true,
 *
 *   onActivate(api) {
 *     api.showToast("My Plugin", "Activated!");
 *   },
 *
 *   onContentChange(content, api) {
 *     // React to content changes
 *   },
 *
 *   onSave(api) {
 *     // React to save events
 *   },
 * });
 *
 * // Pass to FileEditor
 * <FileEditor
 *   plugins={[...createAllBuiltinPlugins(), myPlugin]}
 *   ...
 * />
 * ```
 *
 * ## With Completions
 *
 * ```ts
 * const snippetPlugin = definePlugin({
 *   id: "my-snippets",
 *   name: "My Snippets",
 *   version: "1.0.0",
 *   category: "editor",
 *
 *   completionProviders: [
 *     {
 *       id: "my-snippets-provider",
 *       triggerCharacters: ["/"],
 *       provideCompletions(ctx) {
 *         if (!ctx.lineText.endsWith("/")) return [];
 *         return [
 *           { label: "/header", kind: "snippet", insertText: "// ── Header ──", detail: "Insert header comment" },
 *           { label: "/todo", kind: "snippet", insertText: "// TODO: ", detail: "Insert TODO" },
 *         ];
 *       },
 *     },
 *   ],
 * });
 * ```
 *
 * ## With AI (async provider function)
 *
 * ```ts
 * const aiPlugin = definePlugin({
 *   id: "my-ai-completions",
 *   name: "AI Completions",
 *   version: "1.0.0",
 *   category: "ai",
 *
 *   completionProviders: [{
 *     id: "my-ai",
 *     triggerCharacters: ["."],
 *     async provideCompletions(ctx) {
 *       const response = await myAiFunction({
 *         content: ctx.content,
 *         cursor: ctx.cursorOffset,
 *         language: ctx.language,
 *       });
 *       return response.suggestions.map(s => ({
 *         label: s.text,
 *         kind: "ai",
 *         insertText: s.text,
 *         detail: "AI suggestion",
 *       }));
 *     },
 *   }],
 * });
 * ```
 *
 * ## With Panels
 *
 * ```tsx
 * const previewPlugin = definePlugin({
 *   id: "my-preview",
 *   name: "My Preview",
 *   version: "1.0.0",
 *   category: "ui",
 *
 *   panels: [{
 *     id: "my-preview-panel",
 *     title: "Preview",
 *     position: "right",
 *     defaultSize: 300,
 *     render(api) {
 *       return <div>Preview of {api.getFileInfo().fileName}</div>;
 *     },
 *   }],
 * });
 * ```
 */
import type { ExtendedEditorPlugin } from "./types";
import { validatePlugin, type PluginValidationResult } from "./validatePlugin";

/**
 * Define a custom editor plugin with type safety and validation.
 *
 * Validates the plugin structure at creation time and logs
 * warnings for any issues. Throws on critical errors.
 *
 * @param config - Plugin configuration matching ExtendedEditorPlugin.
 * @returns A validated ExtendedEditorPlugin ready to pass to FileEditor.
 *
 * @throws If the plugin has critical validation errors (missing id/name/version).
 */
export function definePlugin(config: ExtendedEditorPlugin): ExtendedEditorPlugin {
    const result = validatePlugin(config);

    // Log warnings
    for (const issue of result.issues) {
        if (issue.level === "warning") {
            console.warn(`[definePlugin] ⚠ ${config.id ?? "<unknown>"}: ${issue.field} — ${issue.message}`);
        }
    }

    // Throw on errors
    if (!result.valid) {
        const errors = result.issues.filter((i) => i.level === "error");
        throw new Error(
            `[definePlugin] Plugin "${config.id ?? "<unknown>"}" has ${errors.length} validation error(s):\n` +
            errors.map((e) => `  - ${e.field}: ${e.message}`).join("\n"),
        );
    }

    return config;
}

/**
 * Validate a plugin without throwing. Returns the validation result.
 * Useful for checking user-provided plugins before passing them.
 */
export function checkPlugin(plugin: unknown): PluginValidationResult {
    return validatePlugin(plugin);
}

/**
 * Merge custom plugins with the built-in set.
 * Validates each custom plugin and filters out invalid ones,
 * logging errors to the console.
 *
 * @example
 * ```ts
 * import { createAllBuiltinPlugins, mergePlugins, definePlugin } from "@/modules/editor";
 *
 * const myPlugin = definePlugin({ ... });
 * const plugins = mergePlugins(createAllBuiltinPlugins(), [myPlugin]);
 *
 * <FileEditor plugins={plugins} ... />
 * ```
 */
export function mergePlugins(
    builtins: ExtendedEditorPlugin[],
    custom: ExtendedEditorPlugin[],
): ExtendedEditorPlugin[] {
    const validCustom: ExtendedEditorPlugin[] = [];
    const seenIds = new Set(builtins.map((p) => p.id));

    for (const plugin of custom) {
        const result = validatePlugin(plugin);

        if (!result.valid) {
            console.error(
                `[mergePlugins] Skipping invalid plugin "${result.pluginId}":`,
                result.issues.filter((i) => i.level === "error").map((i) => i.message),
            );
            continue;
        }

        if (seenIds.has(plugin.id)) {
            console.warn(
                `[mergePlugins] Custom plugin "${plugin.id}" conflicts with a built-in plugin — overriding.`,
            );
            // Remove the builtin with the same id
            const idx = builtins.findIndex((p) => p.id === plugin.id);
            if (idx !== -1) builtins.splice(idx, 1);
        }

        seenIds.add(plugin.id);
        validCustom.push(plugin);
    }

    return [...builtins, ...validCustom];
}
