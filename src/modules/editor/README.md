# File Editor Module

A feature-rich, extensible code editor built with React + a plain `<textarea>`.  
No Monaco, no CodeMirror — just a highly composable module with syntax highlighting, completions, AI ghost-text, diagnostics, code-lens, themes, and a full plugin system.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [FileEditor Props](#fileeditor-props)
4. [Content Providers](#content-providers)
5. [Plugin System](#plugin-system)
   - [Builtin Plugins](#builtin-plugins)
   - [Mock Plugins](#mock-plugins)
   - [Writing a Custom Plugin](#writing-a-custom-plugin)
   - [Plugin Lifecycle](#plugin-lifecycle)
6. [AI Provider Manager](#ai-provider-manager)
   - [What It Is](#what-it-is)
   - [Option 1 — Async Handler Function](#option-1--async-handler-function)
   - [Option 2 — Backend Route (REST)](#option-2--backend-route-rest)
   - [Option 3 — Streaming (SSE)](#option-3--streaming-sse)
   - [Relationship to Plugins / ContentProvider](#relationship-to-plugins--contentprovider)
7. [Themes](#themes)
8. [Examples](#examples)
   - [Minimal Setup](#minimal-setup)
   - [With Builtin Plugins](#with-builtin-plugins)
   - [With Mock Plugins (No Backend)](#with-mock-plugins-no-backend)
   - [Mixed: Builtins + Mock + Custom](#mixed-builtins--mock--custom)
   - [With AiProviderManager](#with-aiprovidermanager)
   - [Full Production Page](#full-production-page)

---

## Quick Start

```tsx
import { useMemo } from "react";
import { FileEditor, BaseContentProvider, createContentProvider } from "@/modules/editor";
import { ApiCore } from "@/lib/api"; // your own API layer

// Option A — extend BaseContentProvider
class MyApiProvider extends BaseContentProvider {
  async fetchContent(sessionId: string, path: string) {
    const data = await ApiCore.fetchFileContent(sessionId, path);
    return data.status ? { content: data.result } : { content: "", error: data.message };
  }
  async saveContent(sessionId: string, path: string, content: string) {
    await ApiCore.saveFileContent(sessionId, path, content);
    return { success: true };
  }
}

// Option B — factory with raw functions
const provider = createContentProvider(
  async (sid, path) => { /* fetch */ return { content: "..." }; },
  async (sid, path, content) => { /* save */ return { success: true }; },
);

function MyEditorPage() {
  const provider = useMemo(() => new MyApiProvider(), []);

  return (
    <FileEditor
      sessionId="abc123"
      remotePath="/etc/nginx/nginx.conf"
      provider={provider}
    />
  );
}
```

That's the minimum. The editor will load the file, auto-detect the language, and give you syntax highlighting, a toolbar, status bar, find/replace, go-to-line, and a context menu out of the box.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  <FileEditor>  (public API)                             │
│                                                         │
│   ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│   │ ContentProv  │  │  PluginHost │  │ ThemeManager │  │
│   │ (API/Socket) │  │  (manages   │  │ (CSS vars)   │  │
│   │              │  │   plugins)  │  │              │  │
│   └──────┬───────┘  └──────┬──────┘  └──────────────┘  │
│          │                 │                            │
│   ┌──────▼─────────────────▼─────────────────────────┐  │
│   │             EditorProvider (Zustand store)        │  │
│   │   content, cursor, language, fontSize, …         │  │
│   └──────────────────────────────────────────────────┘  │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  Editor Body                                    │   │
│   │  ┌────────┐ ┌────────────┐ ┌────────────────┐   │   │
│   │  │ Gutter │ │ SyntaxOver │ │   <textarea>   │   │   │
│   │  │        │ │ lay       │ │                │   │   │
│   │  └────────┘ └────────────┘ └────────────────┘   │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   ┌───────────────────┐  ┌───────────────────────────┐  │
│   │ CompletionWidget  │  │ GhostTextOverlay          │  │
│   │ CodeLensOverlay   │  │ DiagnosticsOverlay        │  │
│   │ InlineAnnotations │  │ PluginPanelRenderer       │  │
│   └───────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
             │                         │
     AiProviderManager          Backend / REST API
     (optional, for AI          (file read/write)
      suggestion routing)
```

**Key distinction:**

| Concern | Who handles it |
|---|---|
| **Reading / writing files** | `ContentProvider` (user-supplied via `BaseContentProvider` or `createContentProvider`) |
| **Editor features** (completions, ghost-text, diagnostics, codelens) | **Plugins** |
| **Routing AI requests** to a backend or handler fn | `AiProviderManager` (optional singleton) |

---

## FileEditor Props

```ts
interface FileEditorProps {
  sessionId: string;              // SSH/SFTP session ID
  remotePath: string;             // Remote file path
  provider: ContentProvider;      // How to load/save files
  themeId?: string;               // "dracula" | "vs-dark" | "monokai" | "one-dark" | ...
  readOnly?: boolean;             // Start in read-only mode
  showMinimap?: boolean;          // Show code minimap
  wordWrap?: boolean;             // Enable word wrap (default: true)
  fontSize?: number;              // Initial font size (default: 13)
  className?: string;             // CSS class on root
  style?: CSSProperties;          // Inline styles on root
  plugins?: ExtendedEditorPlugin[]; // Plugins to register
}
```

---

## Content Providers

A `ContentProvider` is responsible for **loading and saving files**. It has nothing to do with AI or completions.

### Built-in Providers

| Provider | Description |
|---|---|
| `SocketContentProvider` | Socket.IO — pass your own socket or a URL + event names |
| `NoopContentProvider` | In-memory / offline / demo — no network calls |
| `BaseContentProvider` | Abstract class — extend to build your own provider |
| `defineContentProvider()` | Functional helper — create a provider from plain functions |
| `createContentProvider()` | Factory — pass raw functions, or `"socket"` / `"noop"` with options |

### Interface

```ts
interface ContentProvider {
  fetchContent(sessionId: string, path: string): Promise<{ content: string; error?: string }>;
  saveContent(sessionId: string, path: string, content: string): Promise<{ success: boolean; error?: string }>;
  onContentUpdate?(callback: (content: string) => void): () => void;
}
```

### Usage

```tsx
import { BaseContentProvider, createContentProvider } from "@/modules/editor";

// 1. Extend BaseContentProvider with your own API logic
class MyApiProvider extends BaseContentProvider {
  async fetchContent(sessionId: string, path: string) { /* ... */ }
  async saveContent(sessionId: string, path: string, content: string) { /* ... */ }
}
const provider = useMemo(() => new MyApiProvider(), []);

// 2. Or use the factory with raw functions
const provider = useMemo(() => createContentProvider(
  async (sid, path) => ({ content: await loadFile(sid, path) }),
  async (sid, path, content) => { await saveFile(sid, path, content); return { success: true }; },
), []);

// 3. Socket provider — pass existing socket or a URL
const provider = useMemo(() => createContentProvider("socket", {
  socket: mySocket,               // or: url: "http://localhost:4000"
  events: {
    fetchRequest:  "sftp:edit:file:request",
    fetchResponse: "sftp:edit:file:request:response",
    saveRequest:   "sftp:edit:file:done",
    saveResponse:  "sftp:edit:file:done:response",
  },
}), []);

<FileEditor provider={provider} sessionId="abc" remotePath="/path/to/file" />
```

### Custom Provider

```ts
const myProvider: ContentProvider = {
  async fetchContent(sessionId, path) {
    const res = await fetch(`/my-api/files?session=${sessionId}&path=${path}`);
    const data = await res.json();
    return { content: data.text };
  },
  async saveContent(sessionId, path, content) {
    await fetch(`/my-api/files`, {
      method: "PUT",
      body: JSON.stringify({ sessionId, path, content }),
    });
    return { success: true };
  },
};
```

---

## Plugin System

Plugins add editor features: completions, diagnostics, code lenses, ghost text, side panels, keybindings, commands, decorations, and more.

### Plugin Types (the four AI suggestion categories)

These map directly to `AiSuggestionRequest.type`:

| Type | What it does | UI Component |
|---|---|---|
| `ghost-text` | Inline transparent text that streams after a typing pause | `GhostTextOverlay` |
| `completion` | Autocomplete dropdown that appears while typing | `CompletionWidget` |
| `intellisense` | Smart context-aware completions + diagnostics + type hints | `CompletionWidget` + `DiagnosticsOverlay` + `InlineAnnotationsOverlay` |
| `codelens` | Clickable action links above functions/classes | `CodeLensOverlay` |

### Builtin Plugins

```tsx
import { createAllBuiltinPlugins } from "@/modules/editor";

<FileEditor plugins={createAllBuiltinPlugins()} … />
```

Individual builtins:

| Factory function | Category |
|---|---|
| `createAutoCompletionPlugin()` | completion |
| `createIntelliSensePlugin()` | intellisense |
| `createCodeLensPlugin()` | codelens |
| `createAiGhostTextPlugin()` | ghost-text |
| `createAiSuitePlugin()` | ai (multi-feature) |
| `createMarkdownPreviewPlugin()` | ui |
| `createDiffViewerPlugin()` | ui |
| `createJsonSchemaValidationPlugin()` | validation |
| `createYamlSchemaValidationPlugin()` | validation |
| `createInlineAnnotationsPlugin()` | editor |
| `createFileMetadataPlugin()` | tools |
| `createAutoDetectIndentPlugin()` | editor |
| `createFocusModePlugin()` | ui |

### Mock Plugins

Mock plugins simulate all four AI suggestion types **without any backend**. Perfect for development, demos, and testing.

```tsx
import { createAllMockPlugins } from "@/modules/editor/plugins/mock";

<FileEditor plugins={createAllMockPlugins()} … />
```

Individual mocks:

| Factory function | Simulates |
|---|---|
| `createMockGhostTextPlugin()` | `ghost-text` — streams inline suggestions after typing pause |
| `createMockCompletionPlugin()` | `completion` — canned autocomplete dropdown |
| `createMockIntelliSensePlugin()` | `intellisense` — dot-completions, diagnostics, type hints |
| `createMockCodeLensPlugin()` | `codelens` — references, run, peek, AI explain |

### Writing a Custom Plugin

Use `definePlugin()` for type safety and validation:

```ts
import { definePlugin } from "@/modules/editor";

const myPlugin = definePlugin({
  id: "my-custom-plugin",
  name: "My Custom Plugin",
  version: "1.0.0",
  description: "Does something cool",
  category: "tools",       // "editor" | "language" | "ai" | "ui" | "validation" | "tools"
  defaultEnabled: true,

  // Called when plugin is activated
  onActivate(api) {
    api.showToast("My Plugin", "Activated!", "default");
  },

  // Called on every content change (debounced by the host)
  onContentChange(content, api) {
    console.log("Content changed, length:", content.length);
  },

  // Called on save
  onSave(api) {
    console.log("File saved!");
  },
});
```

#### Adding Completions

```ts
const snippetPlugin = definePlugin({
  id: "my-snippets",
  name: "My Snippets",
  version: "1.0.0",
  category: "editor",

  completionProviders: [{
    id: "my-snippets-provider",
    triggerCharacters: ["/"],
    provideCompletions(ctx) {
      if (!ctx.lineText.endsWith("/")) return [];
      return [
        { label: "/header", kind: "snippet", insertText: "// ── Header ──", detail: "Header comment" },
        { label: "/todo",   kind: "snippet", insertText: "// TODO: ",       detail: "TODO marker" },
      ];
    },
  }],
});
```

#### Adding Diagnostics & Code Lenses

```ts
const lintPlugin = definePlugin({
  id: "my-linter",
  name: "My Linter",
  version: "1.0.0",
  category: "validation",

  onActivate(api) {
    runLint(api.getContent(), api);
  },

  onContentChange(content, api) {
    runLint(content, api);
  },

  onDeactivate(api) {
    api.clearDiagnostics("my-linter");
    api.clearCodeLenses("my-linter");
  },
});

function runLint(content: string, api: ExtendedPluginAPI) {
  const diagnostics = [];
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    if (/\bconsole\.log\b/.test(line)) {
      diagnostics.push({
        id: `lint:${i}`,
        line: i + 1,
        startCol: line.indexOf("console"),
        endCol: line.indexOf("console") + 11,
        message: "Unexpected console.log",
        severity: "warning",
        source: "my-linter",
      });
    }
  });

  api.setDiagnostics(diagnostics);
}
```

### Plugin Lifecycle

```
FileEditor mounts
  └─► PluginHost registers plugins
       └─► onActivate(api)           ← plugin initializes
            └─► User types …
                 └─► onContentChange(content, api)
                 └─► completionProviders[].provideCompletions(ctx)
            └─► User saves …
                 └─► onSave(api)
            └─► Language changes …
                 └─► onLanguageChange(language, api)
            └─► Selection changes …
                 └─► onSelectionChange(selection, api)

FileEditor unmounts
  └─► onDeactivate(api)              ← plugin cleans up
```

---

## AI Provider Manager

### What It Is

`AiProviderManager` is a **singleton** that routes AI suggestion requests to your backend or a custom handler function. It is **completely separate** from `ContentProvider` (file loading/saving) and from the plugin system.

```
┌──────────────────┐         ┌───────────────────┐
│   Plugin          │────────►│  AiProviderManager │
│  (ghost-text,     │ request │     (singleton)     │
│   completion, …)  │         └─────────┬───────────┘
└──────────────────┘                   │
                                       ▼
                              ┌───────────────────┐
                              │  Your Backend /    │
                              │  AI API / Handler  │
                              └───────────────────┘
```

**Important:** `AiProviderManager` is NOT a content provider. Here's the difference:

| | `ContentProvider` | `AiProviderManager` |
|---|---|---|
| **Purpose** | Load & save files | Route AI suggestion requests |
| **Used by** | `<FileEditor provider={…}>` | AI plugins (ghost-text, ai-suite, etc.) |
| **Required?** | Yes (editor won't work without it) | No (editor works fine without AI) |
| **Instance** | One per editor (passed as prop) | Global singleton |

### Option 1 — Async Handler Function

Use this when you want full control over how AI requests are handled:

```ts
import { AiProviderManager } from "@/modules/editor";

AiProviderManager.setHandler(async (req) => {
  // req.type is "ghost-text" | "completion" | "intellisense" | "codelens"
  // req.content — full file content
  // req.line — cursor line (1-based)
  // req.col — cursor column (0-based)
  // req.lineText — text of the current line
  // req.language — file language
  // req.fileName — file name
  // req.prefix — lines before cursor
  // req.suffix — lines after cursor

  const res = await fetch("/my-ai-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  return { text: data.suggestion };
});
```

### Option 2 — Backend Route (REST)

Let the manager handle the fetch for you:

```ts
AiProviderManager.setRoute("/api/ai/suggest");

// With custom headers:
AiProviderManager.setRoute("https://my-server.com/ai", {
  headers: { "Authorization": `Bearer ${token}` },
});
```

The manager POSTs `AiSuggestionRequest` as JSON and expects `{ text: string }` back.

### Option 3 — Streaming (SSE)

For real-time streaming suggestions:

```ts
// Via route:
AiProviderManager.setRoute("/api/ai/suggest", { streaming: true });

// Via handler:
AiProviderManager.setStreamHandler(async (req, onChunk) => {
  const stream = await myStreamingAPI(req);
  for await (const chunk of stream) {
    onChunk(chunk.text, false);   // intermediate chunks
  }
  onChunk("", true);              // signal completion
});
```

### Relationship to Plugins / ContentProvider

```tsx
import { useMemo } from "react";
import {
  FileEditor,
  BaseContentProvider,        // ← Extend to build your own
  AiProviderManager,          // ← For routing AI requests
  createAllBuiltinPlugins,    // ← For editor features
} from "@/modules/editor";

class MyApiProvider extends BaseContentProvider {
  async fetchContent(sid: string, path: string) { /* your API call */ }
  async saveContent(sid: string, path: string, content: string) { /* your API call */ }
}

function MyEditorPage({ sessionId, remotePath }) {
  // ContentProvider: how files are loaded/saved
  const provider = useMemo(() => new MyApiProvider(), []);

  // AiProviderManager: how AI requests are routed (optional, global)
  // Set this once at app startup or in a useEffect:
  useEffect(() => {
    AiProviderManager.setHandler(async (req) => {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        body: JSON.stringify(req),
      });
      const data = await res.json();
      return { text: data.suggestion };
    });

    return () => AiProviderManager.clear();
  }, []);

  return (
    <FileEditor
      sessionId={sessionId}
      remotePath={remotePath}
      provider={provider}            // ← file I/O
      plugins={createAllBuiltinPlugins()}  // ← features
    />
  );
}
```

---

## Themes

Built-in themes: `dracula`, `vs-dark`, `monokai`, `one-dark`, `darcula`, `solarized-dark`, `github-dark`

```tsx
<FileEditor themeId="vs-dark" … />

// Switch theme at runtime via the theme selector panel (built into the toolbar)
```

Custom themes:

```ts
import { ThemeManager } from "@/modules/editor";

ThemeManager.register({
  id: "my-theme",
  name: "My Theme",
  type: "dark",
  colors: {
    background: "#1a1a2e",
    foreground: "#e0e0e0",
    accent: "#e94560",
    // …
  },
  syntax: {
    keyword: "#e94560",
    string: "#0f3460",
    // …
  },
});
```

---

## Examples

### Minimal Setup

```tsx
import { useMemo } from "react";
import { FileEditor, BaseContentProvider } from "@/modules/editor";

// Define your own provider outside the module
class MyApiProvider extends BaseContentProvider {
  async fetchContent(sid: string, path: string) { /* ... */ return { content: "" }; }
  async saveContent(sid: string, path: string, c: string) { /* ... */ return { success: true }; }
}

export default function Editor({ sessionId, path }) {
  const provider = useMemo(() => new MyApiProvider(), []);

  return (
    <FileEditor
      sessionId={sessionId}
      remotePath={path}
      provider={provider}
    />
  );
}
```

### With Builtin Plugins

```tsx
import { useMemo } from "react";
import { FileEditor, BaseContentProvider, createAllBuiltinPlugins } from "@/modules/editor";

class MyApiProvider extends BaseContentProvider {
  async fetchContent(sid: string, path: string) { /* ... */ return { content: "" }; }
  async saveContent(sid: string, path: string, c: string) { /* ... */ return { success: true }; }
}

export default function Editor({ sessionId, path }) {
  const provider = useMemo(() => new MyApiProvider(), []);

  return (
    <FileEditor
      sessionId={sessionId}
      remotePath={path}
      provider={provider}
      plugins={createAllBuiltinPlugins()}
      themeId="dracula"
      showMinimap
      wordWrap
      fontSize={14}
    />
  );
}
```

### With Mock Plugins (No Backend)

Perfect for development and demos — all features work with canned data:

```tsx
import { useMemo } from "react";
import { FileEditor, createContentProvider } from "@/modules/editor";
import { createAllMockPlugins } from "@/modules/editor/plugins/mock";

export default function EditorDemo({ sessionId, path }) {
  // NoopContentProvider for demos — works offline
  const provider = useMemo(() => createContentProvider("noop", "// demo content"), []);

  return (
    <FileEditor
      sessionId={sessionId}
      remotePath={path}
      provider={provider}
      plugins={createAllMockPlugins()}
      themeId="vs-dark"
      wordWrap
    />
  );
}
```

### Mixed: Builtins + Mock + Custom

```tsx
import { useMemo } from "react";
import {
  FileEditor,
  BaseContentProvider,
  createAllBuiltinPlugins,
  definePlugin,
  mergePlugins,
} from "@/modules/editor";
import {
  createMockGhostTextPlugin,
  createMockCodeLensPlugin,
} from "@/modules/editor/plugins/mock";

class MyApiProvider extends BaseContentProvider {
  async fetchContent(sid: string, path: string) { /* ... */ return { content: "" }; }
  async saveContent(sid: string, path: string, c: string) { /* ... */ return { success: true }; }
}

const myPlugin = definePlugin({
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  category: "tools",
  onActivate(api) {
    api.showToast("Hello", "My plugin is active!", "default");
  },
});

export default function Editor({ sessionId, path }) {
  const provider = useMemo(() => new MyApiProvider(), []);

  const plugins = useMemo(
    () =>
      mergePlugins(createAllBuiltinPlugins(), [
        createMockGhostTextPlugin(),
        createMockCodeLensPlugin(),
        myPlugin,
      ]),
    [],
  );

  return (
    <FileEditor
      sessionId={sessionId}
      remotePath={path}
      provider={provider}
      plugins={plugins}
    />
  );
}
```

### With AiProviderManager

```tsx
import { useMemo, useEffect } from "react";
import {
  FileEditor,
  BaseContentProvider,
  AiProviderManager,
  createAllBuiltinPlugins,
} from "@/modules/editor";

class MyApiProvider extends BaseContentProvider {
  async fetchContent(sid: string, path: string) { /* ... */ return { content: "" }; }
  async saveContent(sid: string, path: string, c: string) { /* ... */ return { success: true }; }
}

export default function Editor({ sessionId, path, aiToken }) {
  const provider = useMemo(() => new MyApiProvider(), []);

  // Configure AI routing — runs once
  useEffect(() => {
    AiProviderManager.setRoute("/api/ai/suggest", {
      headers: { Authorization: `Bearer ${aiToken}` },
      streaming: true,
    });

    return () => AiProviderManager.clear();
  }, [aiToken]);

  return (
    <FileEditor
      sessionId={sessionId}
      remotePath={path}
      provider={provider}
      plugins={createAllBuiltinPlugins()}
      themeId="dracula"
    />
  );
}
```

### Full Production Page

This is the pattern used in the real SFTP editor page:

```tsx
import { useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FileEditor,
  BaseContentProvider,
  AiProviderManager,
  createAllBuiltinPlugins,
  mergePlugins,
} from "@/modules/editor";
import { createAllMockPlugins } from "@/modules/editor/plugins/mock";

class MyApiProvider extends BaseContentProvider {
  async fetchContent(sid: string, path: string) {
    // your own REST / gRPC / whatever call
    return { content: "" };
  }
  async saveContent(sid: string, path: string, c: string) {
    return { success: true };
  }
}

export default function FileEditorPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = params.get("tabId") ?? "";
  const remotePath = params.get("path") ?? "";

  // 1. Content provider — user-supplied, lives outside the module
  const provider = useMemo(() => new MyApiProvider(), []);

  // 2. Plugins — editor features (completions, ghost-text, codelens, etc.)
  //    Use createAllBuiltinPlugins() for production,
  //    or createAllMockPlugins() for development/demos.
  const plugins = useMemo(
    () =>
      process.env.NODE_ENV === "development"
        ? mergePlugins(createAllBuiltinPlugins(), createAllMockPlugins() as any)
        : createAllBuiltinPlugins(),
    [],
  );

  // 3. AI Provider — routes AI suggestion requests (optional)
  useEffect(() => {
    AiProviderManager.setRoute("/api/ai/suggest", { streaming: true });
    return () => AiProviderManager.clear();
  }, []);

  if (!sessionId || !remotePath) {
    return <div>Missing tabId or path parameters</div>;
  }

  return (
    <div style={{ height: "100vh" }}>
      <FileEditor
        sessionId={sessionId}
        remotePath={remotePath}
        provider={provider}
        plugins={plugins}
        themeId="dracula"
        wordWrap
        fontSize={13}
      />
    </div>
  );
}
```

---

## File Structure

```
src/modules/editor/
├── index.ts                    # Public barrel exports
├── FileEditor.tsx              # Main component
├── types.ts                    # Core type definitions
├── api/
│   └── providers.ts            # BaseContentProvider, SocketContentProvider, NoopContentProvider, createContentProvider
├── components/                 # Toolbar, FindBar, GoToLine, StatusBar, etc.
├── core/                       # detect-lang, syntax, snippets, utils
├── hooks/                      # useEditor, useTheme, useKeybindings, etc.
├── formatters/                 # Code formatting registry
├── state/                      # Zustand store + React context
├── styles/                     # CSS files
├── themes/                     # Theme manager + built-in themes
├── workers/                    # Web workers (syntax, lint)
└── plugins/
    ├── types.ts                # Plugin type definitions
    ├── PluginHost.ts           # Plugin host (manages lifecycle)
    ├── usePluginHost.ts        # React hook for plugin host
    ├── definePlugin.ts         # Plugin creation helpers
    ├── validatePlugin.ts       # Plugin validation
    ├── AiProvider.ts           # AI Provider Manager (singleton)
    ├── components/             # CompletionWidget, CodeLensOverlay, etc.
    ├── builtin/                # Built-in plugins (13 plugins)
    │   └── index.ts
    └── mock/                   # Mock plugins for testing (4 plugins)
        ├── index.ts
        ├── mock-ghost-text.ts
        ├── mock-completion.ts
        ├── mock-intellisense.ts
        └── mock-codelens.ts
```
