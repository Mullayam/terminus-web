# Context Engine — Architecture & Usage Guide

> **Package**: `@enjoys/context-engine`  
> **CDN**: `https://cdn.jsdelivr.net/npm/@enjoys/context-engine`  
> **Storage**: IndexedDB via Dexie (two databases)

---

## What It Does

The Context Engine is a **local-first, CDN-synced intelligence system** that provides:

1. **Language Intelligence Packs** — Installable per-language JSON packs that register 25 Monaco provider types (completions, hover, definitions, code actions, etc.)
2. **Terminal Command Packs** — Installable command reference data used for ghost suggestions in integrated terminals

Users install packs from the sidebar UI. Data is fetched from CDN, persisted in IndexedDB, and registered into Monaco/terminal at runtime.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CDN (jsdelivr)                          │
│  @enjoys/context-engine/data/manifest.json                      │
│  @enjoys/context-engine/data/{type}/{lang}.json                 │
│  @enjoys/context-engine/data/commands/manifest.json             │
│  @enjoys/context-engine/data/commands/{cmd}.json                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ fetch
┌──────────────────────────▼──────────────────────────────────────┐
│                   API Layer (contextEngineApi.ts)                │
│  • fetchLanguageManifest()    • fetchTerminalCommandsManifest() │
│  • fetchLanguageData(lang)    • fetchCommandFiles(fileNames)    │
│  • fetchContextEngineVersion()                                  │
│  • PROVIDER_TYPES (25 keys)   • version comparison helpers      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ save/read
┌──────────────────────────▼──────────────────────────────────────┐
│               Storage Layer (contextEngineStorage.ts)            │
│  terminus-context-languages DB:                                  │
│    languages table  → { id, name, installedAt }                 │
│    data table       → { id: "type::langId", data: JSON }       │
│  terminus-context-commands DB:                                   │
│    categories table → { id, category, context[], files[] }      │
│    commands table   → { id: "category::file", data: JSON }     │
└───────────┬─────────────────────────────────────┬───────────────┘
            │                                     │
  ┌─────────▼──────────┐             ┌────────────▼──────────────┐
  │   Monaco Path      │             │   Terminal Path           │
  │                    │             │                           │
  │  contextEngine     │             │  getAllCommandData()      │
  │  Converters.ts     │             │       ↓                  │
  │  (25 to*Provider   │             │  EditorTerminalWithGhost  │
  │   functions)       │             │  Terminal.tsx (SSH)       │
  │       ↓            │             │  (ghost suggestions)     │
  │  contextEngine     │             └───────────────────────────┘
  │  Providers.ts      │
  │  (register into    │
  │   Monaco API)      │
  └────────────────────┘
```

---

## Layer Breakdown

### 1. API Layer — `src/lib/context-engine/contextEngineApi.ts`

CDN client. Fetches manifests and data files, provides version management.

| Export | Signature | Purpose |
|---|---|---|
| `fetchContextEngineVersion` | `() → Promise<string>` | Get latest published version from CDN |
| `getStoredContextEngineVersion` | `() → string \| null` | Read locally stored version (localStorage) |
| `setStoredContextEngineVersion` | `(version: string) → void` | Persist version after install |
| `isNewerVersion` | `(remote, local) → boolean` | Semver comparison |
| `fetchLanguageManifest` | `() → Promise<LanguageManifest>` | Language pack catalog (cached in-memory) |
| `fetchTerminalCommandsManifest` | `() → Promise<TerminalCommandsManifest>` | Command pack catalog (cached in-memory) |
| `fetchLanguageData` | `(lang: ManifestLanguage) → Promise<LanguageDataResult>` | Fetch all 25 provider JSON files for a language in parallel |
| `fetchCommandFiles` | `(fileNames: string[]) → Promise<{fileName, data}[]>` | Fetch command JSON files in parallel |
| `buildLangFileUrl` | `(relativePath) → string` | Build CDN URL for language data file |
| `buildCmdFileUrl` | `(fileName) → string` | Build CDN URL for command file |
| `fetchJsonFile` | `(url) → Promise<unknown>` | Generic JSON fetch helper |
| `PROVIDER_TYPES` | `const string[]` (25 items) | All provider type keys |

**Key Types:**

```typescript
// Language manifest entry
interface ManifestLanguage {
  id: string;          // e.g. "python", "bash"
  name: string;        // e.g. "Python", "Bash"
  files: ManifestLanguageFiles;  // 25 relative paths to JSON data files
}

// Terminal command category
interface TerminalCommandContext {
  category: string;    // e.g. "Cloud CLIs"
  context: string[];   // e.g. ["aws", "gcloud", "az"]
  files: string[];     // e.g. ["aws.json", "gcloud.json"]
}

// Result of fetching all data for a language
type LanguageDataResult = Record<ProviderType, unknown>;
```

### 2. Storage Layer — `src/lib/context-engine/contextEngineStorage.ts`

Two Dexie IndexedDB databases for offline persistence.

**Database: `terminus-context-languages`**

| Table | Schema | Key Pattern |
|---|---|---|
| `languages` | `id, name, installedAt` | Language ID (e.g. `"python"`) |
| `data` | `id, languageId, type, data` | `"completion::python"`, `"hover::bash"` |

**Database: `terminus-context-commands`**

| Table | Schema | Key Pattern |
|---|---|---|
| `categories` | `id, category, context[], files[], installedAt` | Category name (e.g. `"Cloud CLIs"`) |
| `commands` | `id, categoryId, fileName, data` | `"Cloud CLIs::aws.json"` |

**CRUD Functions:**

| Function | Purpose |
|---|---|
| `saveLanguagePack(id, name, data)` | Store language pack + all 25 provider data records |
| `removeLanguagePack(id)` | Delete language pack + all its data records |
| `getInstalledLanguages()` | List all installed language packs |
| `isLanguageInstalled(id)` | Check if a language is installed |
| `getLanguageData(languageId, type)` | Get single provider JSON for a language |
| `getAllLanguageCompletions()` | Get all completion records across languages |
| `saveCommandCategory(category, files)` | Store command category + command files |
| `removeCommandCategory(id)` | Delete command category + its files |
| `getInstalledCategories()` | List all installed command categories |
| `isCategoryInstalled(id)` | Check if a category is installed |
| `getCommandDataForCategory(categoryId)` | Get all command files for a category |
| `getAllCommandData()` | Get all command data across categories |
| `clearAllLanguageData()` | Wipe all language data |
| `clearAllCommandData()` | Wipe all command data |

### 3. Converter Layer — `src/modules/monaco-editor/lib/contextEngineConverters.ts`

**25 adapter functions** that transform stored JSON payloads into Monaco `register*Provider` contracts.

Each converter:
- Accepts a raw JSON data shape (from IDB)
- Returns a Monaco provider object implementing the correct interface
- Handles alternate JSON field names defensively (e.g. `raw.items` vs `raw.completions`)
- Uses regex-driven matching for symbol/reference/formatting providers
- Wraps logic in try/catch to gracefully handle invalid data

| Converter | Returns Monaco Provider |
|---|---|
| `toCompletionProvider(monaco, data)` | `CompletionItemProvider` |
| `toHoverProvider(monaco, data)` | `HoverProvider` |
| `toDefinitionProvider(monaco, data, langId)` | `{ definitionProvider, hoverProvider }` |
| `toDeclarationProvider(monaco, data)` | `DeclarationProvider` |
| `toTypeDefinitionProvider(monaco, data)` | `TypeDefinitionProvider` |
| `toImplementationProvider(monaco, data)` | `ImplementationProvider` |
| `toReferenceProvider(monaco, data)` | `ReferenceProvider` |
| `toDocumentHighlightProvider(monaco, data)` | `DocumentHighlightProvider` |
| `toDocumentSymbolProvider(monaco, data)` | `DocumentSymbolProvider` |
| `toCodeActionProvider(monaco, data)` | `CodeActionProvider` |
| `toLinkProvider(monaco, data)` | `LinkProvider` |
| `toSignatureHelpProvider(monaco, data)` | `SignatureHelpProvider` |
| `toFoldingRangeProvider(monaco, data)` | `FoldingRangeProvider` |
| `toInlayHintsProvider(monaco, data)` | `InlayHintsProvider` |
| `toCodeLensProvider(monaco, data)` | `CodeLensProvider` |
| `toColorProvider(monaco, data)` | `DocumentColorProvider` |
| `toRenameProvider(monaco, data)` | `RenameProvider` |
| `toSelectionRangeProvider(monaco, data)` | `SelectionRangeProvider` |
| `toLinkedEditingRangeProvider(monaco, data)` | `LinkedEditingRangeProvider` |
| `toFormattingProvider(monaco, data)` | `DocumentFormattingEditProvider` |
| `toRangeFormattingProvider(monaco, data)` | `DocumentRangeFormattingEditProvider` |
| `toOnTypeFormattingProvider(monaco, data)` | `OnTypeFormattingEditProvider` |
| `toSemanticTokensProvider(monaco, data)` | `DocumentSemanticTokensProvider` |
| `toRangeSemanticTokensProvider(monaco, data)` | `DocumentRangeSemanticTokensProvider` |
| `toInlineCompletionsProvider(monaco, data)` | `InlineCompletionsProvider` |

### 4. Registration Layer — `src/modules/monaco-editor/lib/contextEngineProviders.ts`

Orchestrates reading from IndexedDB and registering into Monaco.

| Export | Signature | Purpose |
|---|---|---|
| `registerContextEngineProviders(monaco)` | `Promise<void>` | Register all providers for ALL installed languages (idempotent) |
| `registerContextEngineForLanguage(monaco, langId)` | `Promise<void>` | Register all 25 providers for a single language |
| `disposeContextEngineProviders()` | `void` | Dispose all registered providers and clear tracking state |

**Internal flow per language:**
1. Check if already registered (skip if yes)
2. For each of the 25 provider types, in parallel:
   - Read raw JSON from IndexedDB via `getLanguageData(langId, type)`
   - Normalize alternate field names (e.g. `raw.completions ?? raw.items`)
   - Skip if no data
   - Convert via appropriate `to*Provider()` function
   - Register with `monaco.languages.register*Provider(langId, provider)`
   - Track returned `IDisposable`

### 5. UI Layer — `src/modules/monaco-editor/components/ContextEnginePanel.tsx`

Two-tab sidebar panel:

**Languages Tab:**
- Fetches language manifest from CDN
- Shows installed/available language packs
- Install: `fetchLanguageData()` → `saveLanguagePack()` → `registerContextEngineForLanguage()`
- Uninstall: `removeLanguagePack()` → `disposeContextEngineProviders()` → `registerContextEngineProviders()` (re-register remaining)

**Commands Tab:**
- Fetches terminal commands manifest from CDN
- Shows installed/available command categories
- Install: `fetchCommandFiles()` → `saveCommandCategory()`
- Uninstall: `removeCommandCategory()`

---

## The 25 Provider Types

These map 1:1 to `monaco.languages.register*` functions:

| Key | Monaco Registration | What It Provides |
|---|---|---|
| `completion` | `registerCompletionItemProvider` | IntelliSense suggestions |
| `hover` | `registerHoverProvider` | Hover tooltips |
| `definition` | `registerDefinitionProvider` + bonus `HoverProvider` | Go to Definition |
| `declaration` | `registerDeclarationProvider` | Go to Declaration |
| `typeDefinition` | `registerTypeDefinitionProvider` | Go to Type Definition |
| `implementation` | `registerImplementationProvider` | Go to Implementation |
| `references` | `registerReferenceProvider` | Find All References |
| `documentHighlight` | `registerDocumentHighlightProvider` | Highlight occurrences |
| `documentSymbol` | `registerDocumentSymbolProvider` | Outline / Breadcrumbs |
| `codeActions` | `registerCodeActionProvider` | Quick fixes / Refactors |
| `links` | `registerLinkProvider` | Clickable links |
| `signatureHelp` | `registerSignatureHelpProvider` | Parameter hints |
| `foldingRange` | `registerFoldingRangeProvider` | Code folding |
| `inlayHints` | `registerInlayHintsProvider` | Inline type/param hints |
| `codeLens` | `registerCodeLensProvider` | Inline code lenses |
| `color` | `registerColorProvider` | Color picker/decorator |
| `rename` | `registerRenameProvider` | Rename symbol (F2) |
| `selectionRange` | `registerSelectionRangeProvider` | Smart selection expand |
| `linkedEditingRange` | `registerLinkedEditingRangeProvider` | Linked tag editing |
| `formatting` | `registerDocumentFormattingEditProvider` | Format document |
| `documentRangeFormatting` | `registerDocumentRangeFormattingEditProvider` | Format selection |
| `onTypeFormatting` | `registerOnTypeFormattingEditProvider` | Format on type |
| `semanticTokens` | `registerDocumentSemanticTokensProvider` | Semantic highlighting |
| `rangeSemanticTokens` | `registerDocumentRangeSemanticTokensProvider` | Range semantic tokens |
| `inlineCompletions` | `registerInlineCompletionsProvider` | Ghost text / AI suggestions |

---

## Data Flow Diagrams

### Language Pack Install Flow

```
User clicks "Install" on Python pack
  │
  ├─→ fetchLanguageData(pythonManifestEntry)
  │     └─→ 25 parallel fetches from CDN
  │           /data/completion/python.json
  │           /data/definition/python.json
  │           /data/hover/python.json
  │           ...
  │
  ├─→ saveLanguagePack("python", "Python", dataResult)
  │     └─→ IDB transaction:
  │           languages.put({ id: "python", name: "Python", installedAt })
  │           data.bulkPut([
  │             { id: "completion::python", type: "completion", data: {...} },
  │             { id: "hover::python",      type: "hover",      data: {...} },
  │             ...25 records
  │           ])
  │
  └─→ registerContextEngineForLanguage(monaco, "python")
        └─→ For each of 25 types (parallel):
              getLanguageData("python", type) → from IDB
              normalize raw JSON fields
              to*Provider(monaco, data)   → converter
              monaco.languages.register*Provider("python", provider)
              track IDisposable
```

### Language Pack Uninstall Flow

```
User clicks "Uninstall" on Python pack
  │
  ├─→ removeLanguagePack("python")
  │     └─→ IDB transaction:
  │           languages.delete("python")
  │           data.where("languageId").equals("python").delete()
  │
  ├─→ disposeContextEngineProviders()
  │     └─→ dispose all tracked IDisposables
  │         clear registeredLangs set
  │
  └─→ registerContextEngineProviders(monaco)
        └─→ getInstalledLanguages() → remaining packs
            registerForLanguage() for each remaining
```

### Editor Mount Flow

```
MonacoEditor.tsx onMount
  │
  ├─→ registerContextEngineProviders(monaco)     ← static import
  │     └─→ reads all installed languages from IDB
  │         registers all providers for each
  │
  └─→ (on language change / model switch)
        └─→ dynamic import → registerContextEngineProviders(monaco)
```

### Terminal Ghost Suggestion Flow

```
EditorTerminalWithGhost.tsx / Terminal.tsx
  │
  └─→ getAllCommandData()   ← from IDB
        └─→ Extract command names, subcommands, options, examples
            Feed into ghost suggestion / autocomplete source
```

---

## Consumers

| File | What It Does |
|---|---|
| `MonacoEditor.tsx` | Registers providers on mount; re-registers on model/extension changes |
| `ContextEnginePanel.tsx` | Sidebar UI for install/uninstall with immediate provider updates |
| `EditorTerminalWithGhost.tsx` | Reads command data for terminal ghost suggestions |
| `pages/ssh-v/Terminal.tsx` | Reads command data for SSH terminal suggestions |
| `pages/ssh-v/commandPacks.tsx` | SSH-side command pack installer UI |
| `pages/ssh-v/rightSidebar.tsx` | Shows installed command category count |
| `store/rightSidebarTabStore.ts` | Version detection, update banners, dismiss state |

---

## Version Management

```
App start → rightSidebarTabStore
  ├─→ fetchContextEngineVersion()        → latest from CDN
  ├─→ getStoredContextEngineVersion()    → last installed (localStorage)
  └─→ isNewerVersion(remote, local)      → show update badge in sidebar

User installs/updates packs
  └─→ setStoredContextEngineVersion(latest)
```

---

## Adding a New Provider Type

1. Add the key to `PROVIDER_TYPES` in `contextEngineApi.ts`
2. Add the file path field to `ManifestLanguageFiles` interface
3. Add the directory entry to `ManifestDirectories` interface
4. Create the data interface in `lib/lsp/interfaces/`
5. Create the `to*Provider()` converter in `contextEngineConverters.ts`
6. Create the `register*()` function in `contextEngineProviders.ts`
7. Add to the `providerRegistrars` map in `contextEngineProviders.ts`
