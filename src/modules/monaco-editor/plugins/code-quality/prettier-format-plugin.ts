/**
 * @module monaco-editor/plugins/code-quality/prettier-format-plugin
 *
 * Monaco Plugin that provides Prettier-based code formatting.
 * - Registers as a DocumentFormattingEditProvider per language
 * - Lazy-loads only the Prettier parser plugins needed for the active language
 * - Adds Shift+Alt+F keybinding and "Format Document with Prettier" command
 * - Preloads parser in the background on language switch
 * - Reads user preferences from code-quality settings store
 * - Optional format-on-save via Ctrl+S interception
 */

import type { MonacoPlugin, PluginContext } from "../../types";
import {
  formatWithPrettier,
  isPrettierSupported,
  preloadPrettier,
} from "./prettier-service";
import {
  getCodeQualitySettings,
  updateCodeQualitySettings,
  subscribeCodeQualitySettings,
} from "./settings";

export const prettierFormatPlugin: MonacoPlugin = {
  id: "builtin-prettier-format",
  name: "Prettier Format",
  version: "1.1.0",
  description:
    "Code formatting via Prettier (lazy-loaded per language from CDN)",
  priority: -5, // low priority — runs after core plugins

  onMount(ctx: PluginContext) {
    const registeredLanguages = new Set<string>();

    // ── Build Prettier options from settings + model ─────────
    function buildOptions(model: ReturnType<typeof ctx.editor.getModel>) {
      const s = getCodeQualitySettings().prettier;
      const modelOpts = model!.getOptions();
      return {
        tabWidth: modelOpts.tabSize ?? s.tabWidth,
        useTabs: modelOpts.insertSpaces === false || s.useTabs,
        printWidth: s.printWidth,
        semi: s.semi,
        singleQuote: s.singleQuote,
        trailingComma: s.trailingComma,
        bracketSpacing: s.bracketSpacing,
        arrowParens: s.arrowParens,
      };
    }

    // ── Format the current document ──────────────────────────
    async function formatCurrentDocument() {
      const settings = getCodeQualitySettings();
      if (!settings.prettierEnabled) return;

      const model = ctx.editor.getModel();
      if (!model) return;
      const lang = model.getLanguageId();
      if (!isPrettierSupported(lang)) return;

      const code = model.getValue();
      const formatted = await formatWithPrettier(
        code,
        lang,
        buildOptions(model),
      );

      if (formatted !== code) {
        ctx.editor.executeEdits("prettier", [
          { range: model.getFullModelRange(), text: formatted },
        ]);
      }
    }

    // ── Register formatting provider for a language ──────────
    function registerForLanguage(languageId: string) {
      if (registeredLanguages.has(languageId)) return;
      if (!isPrettierSupported(languageId)) return;

      registeredLanguages.add(languageId);

      ctx.registerDocumentFormattingProvider(languageId, {
        displayName: "Prettier",
        async provideDocumentFormattingEdits(model) {
          const settings = getCodeQualitySettings();
          if (!settings.prettierEnabled) return [];

          const code = model.getValue();
          const lang = model.getLanguageId();
          const formatted = await formatWithPrettier(
            code,
            lang,
            buildOptions(model),
          );
          if (formatted === code) return [];
          return [{ range: model.getFullModelRange(), text: formatted }];
        },
      });
    }

    // ── Register for current language ────────────────────────
    const currentLang = ctx.getLanguage();
    registerForLanguage(currentLang);
    preloadPrettier(currentLang);

    // ── "Format Document with Prettier" (context menu + Shift+Alt+F)
    ctx.addAction({
      id: "prettier.formatDocument",
      label: "Format Document with Prettier",
      keybindings: [
        ctx.monaco.KeyMod.Shift |
          ctx.monaco.KeyMod.Alt |
          ctx.monaco.KeyCode.KeyF,
      ],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1.5,
      run: () => formatCurrentDocument(),
    });

    // ── "Toggle Prettier" (context menu + command palette) ───
    ctx.addAction({
      id: "prettier.toggle",
      label: "Prettier: Toggle Enable/Disable",
      contextMenuGroupId: "z_commands",
      contextMenuOrder: 10,
      run: () => {
        const s = getCodeQualitySettings();
        updateCodeQualitySettings({ prettierEnabled: !s.prettierEnabled });
        const state = !s.prettierEnabled ? "enabled" : "disabled";
        ctx.notify(`Prettier ${state}`, "info");
      },
    });

    // ── Format on save (Ctrl+S / Cmd+S) ──────────────────────
    ctx.addKeybinding(
      ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.KeyS,
      () => {
        const settings = getCodeQualitySettings();
        if (settings.prettierEnabled && settings.prettier.formatOnSave) {
          formatCurrentDocument();
        }
        // Note: the actual file-save is handled by the host, this just
        // intercepts format-on-save. The keybinding system chains handlers.
      },
      "Format on Save (Prettier)",
    );

    // ── Listen for language changes to register new providers ─
    ctx.addDisposable(
      ctx.on("language-changed", (data) => {
        const lang = (data as { languageId: string }).languageId;
        registerForLanguage(lang);
        preloadPrettier(lang);
      }),
    );

    // ── Re-read settings when they change ────────────────────
    const unsubscribe = subscribeCodeQualitySettings(() => {
      // Settings are read on-the-fly in formatWithPrettier,
      // no action needed here beyond potential UI updates
    });
    ctx.addDisposable({ dispose: unsubscribe });
  },

  onLanguageChange(language: string, ctx: PluginContext) {
    ctx.emit("language-changed", { languageId: language });
  },
};
