# Codeium Inline Completions — Backend Specification

**Status:** frontend complete, backend not started
**Audience:** whoever implements the Terminus API companion service
**Frontend contract owner:** [src/modules/monaco-editor/plugins/codeium-plugin.ts](../src/modules/monaco-editor/plugins/codeium-plugin.ts)

---

## 1. What this is

Inline ghost-text completions in the Monaco editor, powered by Codeium's
`language_server`. **This is not an LLM-provider integration.** There is no
prompt, no model id, no temperature. The backend runs a closed-source native
binary that speaks its own protocol to `server.codeium.com`, and we proxy to it.

```
Browser (codeium-plugin)
   │  HTTPS  POST /api/codeium/complete        Monaco coords, 1-based UTF-16
   ▼
Terminus API (companion)  ◄── owns binary, api_key, coordinate conversion
   │  HTTP   POST 127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetCompletions
   ▼
language_server (native, ~170 MB)
   │  proprietary
   ▼
server.codeium.com
```

The browser never sees Codeium's wire format. All byte-offset ↔ UTF-16
conversion, language enum mapping, and metadata injection happen in the
companion.

---

## 2. Endpoints the backend must expose

### 2.1 `POST /api/codeium/complete`

Optional query param `?user=base64(hostId)` — same convention as `/api/chat`.

**Request** (sent by the browser):

```jsonc
{
  "requestId": 12,                       // monotonic per browser tab
  "document": {
    "filePath": "/srv/app/index.ts",     // remote SFTP path
    "languageId": "typescript",          // Monaco language id
    "text": "<entire buffer>",           // full file, not a window
    "cursorPosition": { "lineNumber": 1, "column": 10 },  // 1-based, UTF-16
    "lineEnding": "\n"                   // "\n" | "\r\n"
  },
  "otherDocuments": [                    // max 3, ≤60k chars each
    { "filePath": "…", "languageId": "…", "text": "…" }
  ],
  "editorOptions": { "tabSize": 2, "insertSpaces": true }
}
```

**Response** — plain JSON, HTTP 200. No SSE.

```jsonc
{
  "completions": [
    {
      "id": "<Codeium completionId>",
      "text": "hello() {\n  return 1;",
      "range": {                          // optional; omit to insert at cursor
        "startLineNumber": 1, "startColumn": 10,
        "endLineNumber": 1,   "endColumn": 10
      }
    }
  ]
}
```

Rules:

- `completions: []` with HTTP 200 means "no suggestion". Non-2xx is logged as an
  error by the client and produces no ghost text.
- `id` must be the Codeium `completionId` verbatim — it is echoed back on accept.
- `range` is **1-based UTF-16 Monaco coordinates**. The companion converts from
  Codeium's byte offsets (see §6). Omit it and the client inserts at the cursor.
- A `{ "data": { "completions": [...] } }` wrapper is also accepted, matching
  the existing `/api/ai/providers` response style.
- Client timeout is **10 s**; it aborts the request and cancels on every
  keystroke. Anything slower than ~500 ms feels broken.

### 2.2 `POST /api/codeium/accept`

```jsonc
{ "completionId": "<Codeium completionId>" }
```

Fire-and-forget from the browser (`keepalive: true`). Return **204**.
The companion forwards this to the language server's `AcceptCompletion` — it
feeds Codeium's ranking and is required for correct suggestion quality over time.

If you want to ship before wiring the forward, return 204 immediately so the
browser doesn't log failures.

### 2.3 `POST /api/codeium/auth` (needed for per-user keys)

See §4. Only required if each user brings their own Codeium account.

---

## 3. The language server binary

### 3.1 Acquisition

Download at boot (or bake into the image — see §9):

```
https://github.com/Exafunction/codeium/releases/download/language-server-v<VERSION>/language_server_<SUFFIX>.gz
```

| Platform | `<SUFFIX>` |
|---|---|
| Linux x86_64 | `linux_x64` |
| Linux arm64 | `linux_arm` |
| macOS Intel | `macos_x64` |
| macOS Apple Silicon | `macos_arm` |
| Windows x64 | `windows_x64.exe` |

Steps: download `.gz` → gunzip → `chmod +x` → cache under a sha/version-keyed
directory so restarts don't re-download.

**Pin the version.** `windsurf.vim` pins `1.20.8`
(sha `37f12b83df389802b7d4e293b3e1a986aca289c0`). Newer tags exist
(`language-server-v2.x`) but the request/response shapes below are only verified
against the 1.x line. Do not auto-follow `latest`.

Sizes: ~35–38 MB compressed, ~165–173 MB on disk.

### 3.2 Launch

```
language_server \
  --api_server_url https://server.codeium.com \
  --manager_dir /tmp/terminus/codeium/manager
```

Notes on flags:

- `--manager_dir` is **required** — it is the only way to learn the RPC port.
- Omit `--enable_local_search --enable_index_service --search_max_workspace_file_count 5000`.
  Those index a **local** workspace directory. Our files live on remote hosts
  over SFTP, so indexing burns CPU and disk for nothing.
- Omit `--enable_chat_web_server --enable_chat_client`. We are not using chat,
  and they open extra listening ports.
- Enterprise only: add `--enterprise_mode --portal_url <url>` and set
  `--api_server_url` to the enterprise API URL.

### 3.3 Port discovery

The server writes a file into `manager_dir` **whose filename is the port number**.

```
1. mkdir -p <manager_dir>
2. spawn the binary
3. poll every 500 ms:
     for each entry in readdir(manager_dir):
       if it is a file AND (now - mtime) <= 5 s:
         port = parseInt(entry.name)
4. stop polling once found
```

Add a hard timeout (~30 s). If no port appears, kill the process and surface a
degraded-mode flag rather than hanging every completion request.

### 3.4 Supervision

- **Heartbeat every 5 s**: `POST .../Heartbeat { metadata }`. The server may
  shut itself down without it.
- **`GetStatus` once** after port discovery; log `status.message` (it reports
  auth/quota problems in plain text).
- **Restart on exit** with exponential backoff. On restart the port changes —
  re-run discovery. Never cache the port across process lifetimes.
- **Graceful shutdown**: kill the child on `SIGTERM`/`SIGINT`, otherwise you
  leak a 170 MB process per deploy.

### 3.5 One process, many users

`api_key` is passed **per request** in `metadata`, not at launch. A single
binary instance can therefore serve all users, each with their own key. This is
not a documented guarantee — validate it before relying on it. The fallback
(one process per user) is not viable at ~500 MB RSS each.

---

## 4. Authentication

### 4.1 Obtaining an API key

```
1. User opens:
   https://www.codeium.com/profile?response_type=token
     &redirect_uri=vim-show-auth-token&state=a
     &scope=openid%20profile%20email&redirect_parameters_type=query

2. User copies the token from that page and submits it to your backend.

3. Backend:
   POST https://api.codeium.com/register_user/
   Content-Type: application/json
   { "firebase_id_token": "<token>" }

   → 200 { "api_key": "<uuid>" }

4. Persist the api_key server-side, keyed by Terminus user.
```

Retry up to 3× on failure. Enterprise variant posts to
`<api_url>/exa.seat_management_pb.SeatManagementService/RegisterUser`.

### 4.2 Storage

- The `api_key` is a **long-lived bearer credential**. Encrypt at rest.
- It must never reach the browser. The current frontend sends no
  `Authorization` header and holds no key — keep it that way.
- Options: a single shared service account key (simplest, one quota pool,
  everyone shares suggestion history exposure) or per-user keys (correct, needs
  the auth flow above plus a small UI).

---

## 5. Calling the language server

All RPC calls are:

```
POST http://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/<Method>
Content-Type: application/json

<JSON body>
```

Connect-style RPC: protobuf messages encoded as JSON, `snake_case` on the way
in, `camelCase` on the way out.

### 5.1 Metadata

```jsonc
{
  "api_key": "<uuid>",
  "ide_name": "web",
  "ide_version": "1.0.0",
  "extension_name": "terminus",
  "extension_version": "1.20.8"     // the language server version
}
```

**`request_id` is NOT part of metadata generally.** It is added *only* to
`GetCompletions`, and only to enable `CancelRequest`.

### 5.2 Per-method body shapes

These are **not uniform** — do not build a generic `{metadata, ...}` envelope.

| Method | Body |
|---|---|
| `GetCompletions` | `{ metadata: {…, request_id}, document, editor_options, other_documents }` |
| `AcceptCompletion` | `{ metadata, completion_id }` |
| `CancelRequest` | `{ request_id }` — **no metadata** |
| `Heartbeat` | `{ metadata }` |
| `GetStatus` | `{ metadata }` |
| `RefreshContextForIdeAction` | `{ active_document }` — **no metadata** |
| `AddTrackedWorkspace` | `{ workspace }` — **no metadata** |
| `GetProcesses` | the metadata object **as the entire body**, unwrapped |

### 5.3 `GetCompletions` request

```jsonc
{
  "metadata": { /* §5.1 + "request_id": 12 */ },
  "document": {
    "text": "<entire buffer, lines joined by line_ending>",
    "editor_language": "typescript",   // raw language id, or "unspecified" if unknown
    "language": 45,                     // numeric enum, see §7
    "cursor_position": { "row": 0, "col": 9 },   // 0-based; col is a UTF-8 BYTE offset
    "absolute_path_migrate_me_to_uri": "/srv/app/index.ts",
    "line_ending": "\n"                 // omit if unknown
  },
  "editor_options": { "tab_size": 2, "insert_spaces": true },
  "other_documents": [
    { /* same document shape; cursor_position {row:0,col:0} */ }
  ]
}
```

### 5.4 `GetCompletions` response

```jsonc
{
  "completionItems": [
    {
      "completion": { "completionId": "…", "text": "full suggestion" },
      "range": { "startOffset": 0, "endOffset": 0 },
      "suffix": { "text": "", "deltaCursorOffset": 0 },
      "completionParts": [
        { "type": "COMPLETION_PART_TYPE_INLINE", "prefix": "", "text": "…", "line": 12 }
      ]
    }
  ]
}
```

Error detection: a response containing a top-level **`code`** key is an error,
regardless of HTTP status. Check for it before parsing `completionItems`.

Mapping to our response:

- `id` ← `completion.completionId`
- `text` ← `completion.text` **+** `suffix.text` (concatenate; see §6.3)
- `range` ← converted from `range.startOffset`/`endOffset` (see §6.2)
- `completionParts` can be **ignored**. Monaco renders ghost text natively; the
  INLINE / BLOCK / INLINE_MASK part types exist for editors that must do their
  own column arithmetic.

### 5.5 Cancellation

Track the in-flight Codeium `request_id` per browser session. When a new
`/api/codeium/complete` arrives, or the HTTP request is aborted, fire
`CancelRequest { request_id }` for the previous one. The client already aborts
on every keystroke — without forwarding the cancel you will pile up work and
quota usage server-side.

---

## 6. Coordinate conversion (the part that breaks silently)

Monaco uses **1-based lines, 1-based UTF-16 code-unit columns**.
Codeium uses **0-based rows, UTF-8 byte columns**, and byte offsets in ranges.

Get this wrong and everything looks fine until someone types a non-ASCII
character, then completions insert at the wrong place.

### 6.1 Monaco cursor → Codeium `cursor_position`

```ts
const lineText = lines[position.lineNumber - 1];
const prefix = lineText.slice(0, position.column - 1);   // UTF-16 slice
const cursor = {
  row: position.lineNumber - 1,
  col: Buffer.byteLength(prefix, "utf8"),                // UTF-8 bytes
};
```

### 6.2 Codeium `range` → Monaco range

`range.startOffset` / `endOffset` are byte offsets. The observable semantics in
the reference client: when `endOffset > startOffset`, the suggestion replaces
the **first `(endOffset - startOffset)` bytes of the cursor's line**.

```ts
function toMonacoRange(lineText: string, startOffset: number, endOffset: number, lineNumber: number) {
  const deleteBytes = endOffset - startOffset;
  if (deleteBytes <= 0) return undefined;                // insert at cursor

  // Walk the line converting bytes → UTF-16 columns
  let bytes = 0, utf16 = 0;
  for (const ch of lineText) {
    if (bytes >= deleteBytes) break;
    bytes += Buffer.byteLength(ch, "utf8");
    utf16 += ch.length;                                   // 2 for astral chars
  }

  return {
    startLineNumber: lineNumber, startColumn: 1,
    endLineNumber: lineNumber,   endColumn: utf16 + 1,
  };
}
```

Log a warning whenever `deleteBytes > 0` until you have verified this against
real traffic — it is the least-documented part of the protocol.

### 6.3 `suffix` / `deltaCursorOffset`

`suffix.text` is text to append after the completion; `deltaCursorOffset` shifts
the cursor backwards into it (e.g. to land inside `()`).

Monaco's inline-completion API has no post-accept cursor hook, so:
append `suffix.text` to `text` and **drop `deltaCursorOffset`**. The cursor
lands at the end of the inserted text. Accept this limitation, or filter out
items with a non-zero `deltaCursorOffset` if the cursor position matters more
than the suggestion.

---

## 7. Language enum

`document.language` is a numeric enum; `document.editor_language` is the raw
string. Both are required — Codeium uses the enum for model routing.

Map the Monaco language id, applying aliases first (`bash`→`shell`,
`cs`→`csharp`, `javascriptreact`→`javascript`, `sh`→`shell`, `objc`→`objectivec`,
`proto`→`protobuf`, `make`→`makefile`, `dosini`→`ini`, `coffee`→`coffeescript`,
`cuda`→`cudacpp`, `raku`→`perl`, `text`→`plaintext`, `tex`→`latex`).

```
unspecified 0    c 1        clojure 2       coffeescript 3   cpp 4
csharp 5         css 6      cudacpp 7       dockerfile 8     go 9
groovy 10        handlebars 11  haskell 12  hcl 13           html 14
ini 15           java 16    javascript 17   json 18          julia 19
kotlin 20        latex 21   less 22         lua 23           makefile 24
markdown 25      objectivec 26  objectivecpp 27  perl 28     php 29
plaintext 30     protobuf 31    pbtxt 32    python 33        r 34
ruby 35          rust 36    sass 37         scala 38         scss 39
shell 40         sql 41     starlark 42     swift 43         typescriptreact 44
typescript 45    visualbasic 46  vue 47     xml 48           xsl 49
yaml 50          svelte 51  toml 52         dart 53          rst 54
ocaml 55         cmake 56   pascal 57       elixir 58        fsharp 59
lisp 60          matlab 61  ps1 62          solidity 63      ada 64
blade 84         astro 85
```

Unknown language → `0` and `editor_language: "unspecified"`.

---

## 8. Request pipeline (recommended shape)

```
POST /api/codeium/complete
  1. Resolve user → api_key.               403 if none.
  2. Rate limit / concurrency gate.        429 if exceeded.
  3. Reject oversized payloads.            413 if over cap.
  4. Cancel this session's previous Codeium request_id.
  5. Build the Codeium document:
       - text        ← document.text
       - language    ← enum(languageId)
       - cursor      ← §6.1 conversion
       - path        ← document.filePath
       - line_ending ← document.lineEnding
  6. Build other_documents from otherDocuments (cursor 0,0).
  7. POST GetCompletions with a fresh monotonic request_id.
  8. If the response has a `code` key → log, return { completions: [] }.
  9. Map completionItems → { id, text, range } via §5.4 / §6.2.
 10. Return 200.
```

Store the last Codeium `request_id` per browser session (derive a session key
from `?user=` plus a client-supplied session id, or just per socket/connection).

---

## 9. Operations

**Resources.** ~170 MB on disk, expect 400–800 MB RSS once warm. Provision
accordingly; this will not fit in a 512 MB container.

**Cold start.** First boot downloads ~37 MB and gunzips ~170 MB. Bake the
binary into the Docker image instead — otherwise every deploy adds a minute of
downtime and a GitHub dependency in your startup path.

**Health.** Expose the companion's state (`downloading` / `starting` /
`port:<n>` / `failed`) on your existing health endpoint. A dead language server
is currently indistinguishable from "the model had no suggestion".

**Metrics worth having:** completions requested, returned, accepted (from
`/api/codeium/accept`), p50/p95 latency, cancel rate, language server restarts.

**Logs.** The binary writes to stderr. Capture it — auth and quota failures
surface there and in `GetStatus.message`, not in HTTP status codes.

---

## 10. Security

- **API key never leaves the backend.** No exceptions.
- **Whole files leave the user's host.** Every keystroke ships the full buffer,
  plus up to 3 other open files, to Codeium's cloud. Users editing production
  configs over SFTP will be sending secrets to a third party. This needs to be
  opt-in and clearly disclosed, not a default-on editor feature.
- **No auth on the current API surface.** Nothing in `src/lib/api.ts` sends an
  `Authorization` header; identity is a `sessionId` in the body. If completions
  cost money or quota, `/api/codeium/complete` is an open, expensive endpoint.
  Add authentication before enabling this in production.
- **Rate limit per user, not per IP.** The client debounces at 120 ms and
  cancels aggressively, but a stuck tab can still generate sustained load.
- **Never expose the localhost RPC port.** Bind the language server to
  `127.0.0.1` only and do not proxy arbitrary method names from the browser.
- **Do not copy the reference client's chat URL pattern**, which puts the raw
  `api_key` in a query string.

---

## 11. Legal

The binary is closed-source, redistributed under Codeium/Windsurf's terms, and
`register_user/` is an undocumented endpoint. Running this binary inside a
hosted multi-tenant product is a different use case from a single developer
running it on their laptop. **Get this reviewed before shipping**, and confirm
whether per-user Codeium accounts are required rather than a shared service key.

---

## 12. Delivery order

| # | Step | Unblocks |
|---|---|---|
| 1 | Stub `/api/codeium/complete` returning `{"completions":[]}`, and `/api/codeium/accept` returning 204 | Frontend end-to-end, no errors in console |
| 2 | Binary download + spawn + port discovery + heartbeat, exposed on health | Everything below |
| 3 | Auth: obtain and store one shared `api_key` | Real completions |
| 4 | `GetCompletions` proxy with §6.1 conversion, `range` omitted | Working ghost text |
| 5 | `AcceptCompletion` forwarding | Suggestion quality over time |
| 6 | `CancelRequest` forwarding | Cost control |
| 7 | Byte-offset `range` conversion (§6.2) | Correctness on replace-type suggestions |
| 8 | Per-user keys, rate limits, metrics | Production |

Steps 1–2 are independently testable and worth landing first: step 1 proves the
frontend contract, step 2 proves the binary runs in your deployment target,
which is the single biggest unknown in this project.

---

## Appendix — frontend files

| File | Role |
|---|---|
| [src/modules/monaco-editor/plugins/codeium-plugin.ts](../src/modules/monaco-editor/plugins/codeium-plugin.ts) | Provider, debounce, abort, cache, accept command |
| [src/store/openDocumentsStore.ts](../src/store/openDocumentsStore.ts) | Open tabs mirror → `otherDocuments` |
| [src/modules/monaco-editor/components/AICompletionsPanel.tsx](../src/modules/monaco-editor/components/AICompletionsPanel.tsx) | Provider selector + endpoint + contract docs |
| [src/modules/monaco-editor/components/EditorSettingsPanel.tsx](../src/modules/monaco-editor/components/EditorSettingsPanel.tsx) | `codeiumEndpoint` setting, `"codeium"` provider value |
| [src/pages/sftp/components/FileEditorMonacoPage.tsx](../src/pages/sftp/components/FileEditorMonacoPage.tsx) | Plugin wiring + tab→store sync |

Client defaults: 120 ms debounce, 10 s timeout, 400k char document cap,
3 other documents at ≤60k chars each, endpoint defaults to `__config.API_URL`.
