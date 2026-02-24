/**
 * @module editor/plugins/mock
 *
 * Barrel export for all mock plugins.
 *
 * These plugins simulate the four AI suggestion types defined in
 * `AiSuggestionRequest.type`:
 *
 *   | Type            | Plugin                      | What it does                                                     |
 *   |-----------------|-----------------------------|------------------------------------------------------------------|
 *   | `ghost-text`    | `createMockGhostTextPlugin`  | Streams inline transparent suggestions after a typing pause       |
 *   | `completion`    | `createMockCompletionPlugin` | Autocomplete dropdown with canned items                           |
 *   | `intellisense`  | `createMockIntelliSensePlugin` | Smart dot-completions, diagnostics, type hints                 |
 *   | `codelens`      | `createMockCodeLensPlugin`   | References / Run / Peek / AI Explain lenses above symbols         |
 *
 * ## Quick Start
 *
 * ```tsx
 * import { createAllMockPlugins } from "@/modules/editor/plugins/mock";
 *
 * <FileEditor
 *   sessionId="demo"
 *   remotePath="/tmp/demo.ts"
 *   provider={myProvider}
 *   plugins={createAllMockPlugins()}
 * />
 * ```
 *
 * ## Cherry-pick individual plugins
 *
 * ```tsx
 * import {
 *   createMockGhostTextPlugin,
 *   createMockCompletionPlugin,
 *   createMockIntelliSensePlugin,
 *   createMockCodeLensPlugin,
 * } from "@/modules/editor/plugins/mock";
 *
 * // Mix with builtin plugins
 * import { createAllBuiltinPlugins } from "@/modules/editor/plugins/builtin";
 *
 * <FileEditor
 *   plugins={[
 *     ...createAllBuiltinPlugins(),
 *     createMockGhostTextPlugin(),   // ghost-text
 *     createMockCompletionPlugin(),  // completion
 *     createMockIntelliSensePlugin(),// intellisense
 *     createMockCodeLensPlugin(),    // codelens
 *   ]}
 *   …
 * />
 * ```
 *
 * ## Use with AiProviderManager (optional)
 *
 * The mock plugins work standalone without any AI backend.
 * If you also want to test the `AiProviderManager` route / handler
 * flow, you can wire them together:
 *
 * ```ts
 * import { AiProviderManager } from "@/modules/editor/plugins/AiProvider";
 *
 * // Option 1: mock handler function
 * AiProviderManager.setHandler(async (req) => {
 *   // req.type is "ghost-text" | "completion" | "intellisense" | "codelens"
 *   return { text: `Mock suggestion for ${req.type} at line ${req.line}` };
 * });
 *
 * // Option 2: mock streaming handler
 * AiProviderManager.setStreamHandler(async (req, onChunk) => {
 *   const words = `Mock streamed ${req.type} response`.split(" ");
 *   for (const word of words) {
 *     await new Promise((r) => setTimeout(r, 100));
 *     onChunk(word + " ", false);
 *   }
 *   onChunk("", true);
 * });
 *
 * // Option 3: point to your backend
 * AiProviderManager.setRoute("/api/ai/suggest", { streaming: true });
 * ```
 */

export { createMockGhostTextPlugin } from "./mock-ghost-text";
export { createMockCompletionPlugin } from "./mock-completion";
export { createMockIntelliSensePlugin } from "./mock-intellisense";
export { createMockCodeLensPlugin } from "./mock-codelens";

import { createMockGhostTextPlugin } from "./mock-ghost-text";
import { createMockCompletionPlugin } from "./mock-completion";
import { createMockIntelliSensePlugin } from "./mock-intellisense";
import { createMockCodeLensPlugin } from "./mock-codelens";
import type { ExtendedEditorPlugin } from "../types";

/**
 * Create all four mock plugins at once.
 *
 * ```tsx
 * <FileEditor plugins={createAllMockPlugins()} … />
 * ```
 */
export function createAllMockPlugins(): ExtendedEditorPlugin[] {
    return [
        createMockGhostTextPlugin(),
        createMockCompletionPlugin(),
        createMockIntelliSensePlugin(),
        createMockCodeLensPlugin(),
    ];
}
