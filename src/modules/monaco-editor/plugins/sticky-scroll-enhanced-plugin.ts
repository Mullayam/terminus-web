/**
 * @module monaco-editor/plugins/sticky-scroll-enhanced-plugin
 *
 * Enhanced sticky scroll: shows nested scope headers
 * (class → method → block) pinned at the top of the viewport
 * with subtle styling and click-to-jump.
 */

import type { MonacoPlugin, PluginContext } from "../types";

export const stickyScrollEnhancedPlugin: MonacoPlugin = {
  id: "builtin-sticky-scroll-enhanced",
  name: "Enhanced Sticky Scroll",
  version: "1.0.0",
  description: "Configures enhanced sticky scroll with optimal defaults",

  onMount(ctx: PluginContext) {
    // Enable Monaco's built-in sticky scroll with optimized settings
    ctx.editor.updateOptions({
      stickyScroll: {
        enabled: true,
        maxLineCount: 5,
        defaultModel: "outlineModel",
        scrollWithEditor: true,
      },
    });

    /* Toggle action */
    ctx.addAction({
      id: "sticky-scroll.toggle",
      label: "Toggle Sticky Scroll",
      run(editor) {
        const current = editor.getOption(ctx.monaco.editor.EditorOption.stickyScroll as any) as any;
        editor.updateOptions({
          stickyScroll: {
            enabled: !current?.enabled,
          },
        });
      },
    });
  },
};
