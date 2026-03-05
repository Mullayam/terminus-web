/**
 * @module monaco-editor/core/plugin-context
 *
 * Creates the PluginContext facade that is passed to each plugin
 * during `onMount`. Wraps the raw Monaco/editor APIs into a
 * friendly, safe surface.
 */

import type * as monacoNs from "monaco-editor";
import type {
  Monaco,
  MonacoEditorInstance,
  PluginContext,
  IDisposable,
  NotifyFn,
} from "../types";

interface EventBus {
  emit(event: string, data?: unknown): void;
  on(event: string, handler: (data?: unknown) => void): IDisposable;
}

export function createPluginContext(
  monaco: Monaco,
  editor: MonacoEditorInstance,
  options: {
    filePath?: string;
    onNotify?: NotifyFn;
    eventBus: EventBus;
  },
): PluginContext {
  const disposables: IDisposable[] = [];

  const addDisposable = (d: IDisposable) => {
    disposables.push(d);
  };

  const ctx: PluginContext = {
    monaco,
    editor,

    addDisposable,

    getContent: () => editor.getValue(),
    setContent: (value: string) => editor.setValue(value),

    getLanguage: () => {
      const model = editor.getModel();
      return model ? model.getLanguageId() : "";
    },
    setLanguage: (languageId: string) => {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, languageId);
      }
    },

    getFilePath: () => options.filePath,

    insertTextAtCursor: (text: string) => {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits("plugin", [
          { range: selection, text, forceMoveMarkers: true },
        ]);
      }
    },

    getSelectedText: () => {
      const selection = editor.getSelection();
      if (!selection) return "";
      const model = editor.getModel();
      return model ? model.getValueInRange(selection) : "";
    },

    replaceSelection: (text: string) => {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits("plugin", [
          { range: selection, text, forceMoveMarkers: true },
        ]);
      }
    },

    notify: (message, type) => {
      if (options.onNotify) {
        options.onNotify(message, type);
      } else {
        console.log(`[MonacoPlugin:${type ?? "info"}]`, message);
      }
    },

    addKeybinding: (keybinding, handler, label) => {
      const d = editor.addCommand(keybinding, handler);
      if (d !== null && d !== undefined) {
        // addCommand returns a string ID, not disposable — but we track via action
      }
      // Use addAction for better lifecycle management
      const actionId = `plugin-kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const actionDisposable = editor.addAction({
        id: actionId,
        label: label ?? actionId,
        keybindings: [keybinding],
        run: handler,
      });
      disposables.push(actionDisposable);
    },

    addAction: (action: monacoNs.editor.IActionDescriptor) => {
      const d = editor.addAction(action);
      disposables.push(d);
    },

    registerCompletionProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerCompletionItemProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerHoverProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerHoverProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerCodeActionProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerCodeActionProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerCodeLensProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerCodeLensProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDocumentFormattingProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDocumentFormattingEditProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerInlineCompletionsProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerInlineCompletionsProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDefinitionProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDefinitionProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDeclarationProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDeclarationProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerTypeDefinitionProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerTypeDefinitionProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerImplementationProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerImplementationProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerReferenceProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerReferenceProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDocumentHighlightProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDocumentHighlightProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDocumentSymbolProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDocumentSymbolProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerLinkProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerLinkProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerColorProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerColorProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerInlayHintsProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerInlayHintsProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerSignatureHelpProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerSignatureHelpProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerLinkedEditingRangeProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerLinkedEditingRangeProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDocumentRangeFormattingProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDocumentRangeFormattingEditProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerOnTypeFormattingProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerOnTypeFormattingEditProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerFoldingRangeProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerFoldingRangeProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerRenameProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerRenameProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerNewSymbolNameProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerNewSymbolNameProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerSelectionRangeProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerSelectionRangeProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDocumentSemanticTokensProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDocumentSemanticTokensProvider(lang, provider);
        disposables.push(d);
      }
    },

    registerDocumentRangeSemanticTokensProvider: (languageSelector, provider) => {
      const langs = Array.isArray(languageSelector)
        ? languageSelector
        : [languageSelector];
      for (const lang of langs) {
        const d = monaco.languages.registerDocumentRangeSemanticTokensProvider(lang, provider);
        disposables.push(d);
      }
    },

    setModelMarkers: (owner, markers) => {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, owner, markers);
      }
    },

    applyDecorations: (decorations) => {
      return editor.deltaDecorations([], decorations);
    },

    removeDecorations: (ids) => {
      editor.deltaDecorations(ids, []);
    },

    emit: (event, data) => options.eventBus.emit(event, data),
    on: (event, handler) => options.eventBus.on(event, handler),
  };

  // Attach a cleanup function so the host can dispose everything
  (ctx as PluginContext & { __dispose: () => void }).__dispose = () => {
    for (const d of disposables) {
      try {
        d.dispose();
      } catch {
        // Swallow disposal errors
      }
    }
    disposables.length = 0;
  };

  return ctx;
}
