# Monaco Editor Module

A fully extensible, plugin-driven Monaco Editor wrapper for React.  
Lives alongside the existing custom editor module — **does not replace it**.

## Structure

```
src/modules/monaco-editor/
├── index.ts                  # Public API (barrel exports)
├── types.ts                  # All TypeScript types/interfaces
├── MonacoEditor.tsx          # Main reusable editor component
├── MonacoDiffEditor.tsx      # Diff editor component
├── core/
│   ├── plugin-registry.ts    # Global plugin registry (singleton)
│   ├── plugin-context.ts     # PluginContext facade factory
│   ├── event-bus.ts          # Inter-plugin communication
│   ├── theme-registry.ts     # Theme registration helpers
│   └── language-registry.ts  # Custom language registration
├── hooks/
│   ├── useMonacoEditor.ts    # Imperative editor access hook
│   └── useMonacoPlugins.ts   # Runtime plugin management hook
├── plugins/
│   ├── save-state-plugin.ts      # Persist cursor/scroll state
│   ├── bracket-colorizer-plugin.ts # Enhanced bracket matching
│   ├── word-highlight-plugin.ts   # Highlight word under cursor
│   ├── todo-highlight-plugin.ts   # TODO/FIXME/HACK markers
│   └── minimap-colors-plugin.ts   # Colored minimap indicators
├── themes/
│   └── index.ts              # Built-in themes (One Dark, Dracula, etc.)
└── utils/
    ├── language-detect.ts    # Detect language from file path
    └── create-plugin.ts      # Plugin factory helper
```

## Quick Start

```tsx
import {
  MonacoEditor,
  todoHighlightPlugin,
  bracketColorizerPlugin,
  ALL_BUILTIN_PLUGINS,
} from "@/modules/monaco-editor";

function MyEditor() {
  const [code, setCode] = useState("");

  return (
    <MonacoEditor
      value={code}
      language="typescript"
      theme="one-dark"
      plugins={ALL_BUILTIN_PLUGINS}
      onChange={setCode}
      onSave={(content) => console.log("Saved!", content)}
      height="600px"
    />
  );
}
```

## Creating a Custom Plugin

Plugins implement the `MonacoPlugin` interface. Use the `createPlugin` factory for convenience:

```typescript
import { createPlugin, type PluginContext } from "@/modules/monaco-editor";

export const myPlugin = createPlugin({
  id: "my-awesome-plugin",
  name: "My Awesome Plugin",
  version: "1.0.0",
  description: "Does awesome things",

  // Called when Monaco loads (before editor creation)
  onBeforeMount(monaco) {
    // Register custom languages, themes, etc.
  },

  // Called when the editor is created — main hook
  onMount(ctx: PluginContext) {
    // Add a command palette action
    ctx.addAction({
      id: "my-action",
      label: "Do Something Cool",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.KeyK],
      run: () => ctx.notify("Hello!", "success"),
    });

    // Register a completion provider
    ctx.registerCompletionProvider("javascript", {
      provideCompletionItems: (model, position) => ({
        suggestions: [{
          label: "mySnippet",
          kind: ctx.monaco.languages.CompletionItemKind.Snippet,
          insertText: "console.log('${1:message}');",
          insertTextRules:
            ctx.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: undefined!,
        }],
      }),
    });

    // Add a keybinding
    ctx.addKeybinding(
      ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.KeyL,
      () => console.log(ctx.getContent()),
      "Log Content",
    );

    // Listen for events from other plugins
    ctx.addDisposable(
      ctx.on("some-event", (data) => console.log("Received:", data)),
    );
  },

  // Called when content changes (debounced)
  onContentChange(content, ctx) {
    // Run linting, analysis, etc.
  },

  // Called when language changes
  onLanguageChange(language, ctx) {
    // React to language switch
  },

  // Cleanup
  onDispose() {
    // Any manual cleanup not tracked via addDisposable
  },
});
```

## Plugin Context API

The `PluginContext` provides these methods:

| Method | Description |
|--------|-------------|
| `getContent()` / `setContent(v)` | Get/set editor value |
| `getLanguage()` / `setLanguage(id)` | Get/set language |
| `getFilePath()` | Get file path (if provided) |
| `insertTextAtCursor(text)` | Insert at cursor |
| `getSelectedText()` | Get selected text |
| `replaceSelection(text)` | Replace selection |
| `notify(msg, type)` | Show notification |
| `addKeybinding(kb, handler, label)` | Add keybinding |
| `addAction(action)` | Add command palette action |
| `registerCompletionProvider(lang, p)` | Register completions |
| `registerHoverProvider(lang, p)` | Register hover tooltips |
| `registerCodeActionProvider(lang, p)` | Register code actions |
| `registerCodeLensProvider(lang, p)` | Register code lenses |
| `registerDocumentFormattingProvider(lang, p)` | Register formatter |
| `registerInlineCompletionsProvider(lang, p)` | Register ghost text / AI |
| `setModelMarkers(owner, markers)` | Set diagnostics |
| `applyDecorations(decs)` | Apply decorations |
| `removeDecorations(ids)` | Remove decorations |
| `emit(event, data)` / `on(event, handler)` | Inter-plugin events |
| `addDisposable(d)` | Auto-cleanup on unmount |

## Global Plugin Registry

Register plugins globally so **all** editor instances pick them up:

```typescript
import { pluginRegistry, myPlugin } from "@/modules/monaco-editor";

// Register globally
pluginRegistry.register(myPlugin);

// Manage at runtime
pluginRegistry.disable("my-awesome-plugin");
pluginRegistry.enable("my-awesome-plugin");
pluginRegistry.toggle("my-awesome-plugin");
pluginRegistry.unregister("my-awesome-plugin");

// Query
pluginRegistry.getSnapshot(); // [{ id, name, enabled, version }]
pluginRegistry.getEnabled();  // MonacoPlugin[]
pluginRegistry.validateDependencies(); // string[] of errors
```

### Using the hook:

```tsx
const { snapshot, register, togglePlugin } = useMonacoPlugins();

return (
  <ul>
    {snapshot.map(p => (
      <li key={p.id}>
        {p.name} [{p.enabled ? "ON" : "OFF"}]
        <button onClick={() => togglePlugin(p.id)}>Toggle</button>
      </li>
    ))}
  </ul>
);
```

## Custom Themes

```typescript
import { registerTheme, type MonacoThemeDef } from "@/modules/monaco-editor";

const myTheme: MonacoThemeDef = {
  id: "my-theme",
  name: "My Theme",
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6a737d", fontStyle: "italic" },
    { token: "keyword", foreground: "f97583" },
  ],
  colors: {
    "editor.background": "#1a1b26",
    "editor.foreground": "#a9b1d6",
  },
};

// Register in onBeforeMount or at module level
// Then use: <MonacoEditor theme="my-theme" />
```

## Custom Languages

```typescript
import { registerLanguage, type CustomLanguageDef } from "@/modules/monaco-editor";

const myLang: CustomLanguageDef = {
  id: "my-dsl",
  extensions: [".mydsl"],
  aliases: ["MyDSL"],
  monarchTokens: {
    tokenizer: {
      root: [
        [/\b(if|else|while|return)\b/, "keyword"],
        [/"[^"]*"/, "string"],
        [/\/\/.*$/, "comment"],
      ],
    },
  },
};
```

## Diff Editor

```tsx
import { MonacoDiffEditor } from "@/modules/monaco-editor";

<MonacoDiffEditor
  original={oldCode}
  modified={newCode}
  language="json"
  theme="one-dark"
  height="400px"
/>
```

## Built-in Themes

- `one-dark` (default)
- `dracula`
- `github-dark`
- `monokai`
- `nord`

## Built-in Plugins

| Plugin | Description |
|--------|-------------|
| `saveStatePlugin` | Persists cursor/scroll across remounts |
| `bracketColorizerPlugin` | Highlights matching bracket pairs |
| `wordHighlightPlugin` | Highlights all occurrences of word under cursor |
| `todoHighlightPlugin` | Marks TODO/FIXME/HACK/NOTE/XXX with colors |
| `minimapColorsPlugin` | Colors minimap based on markers/diagnostics |
