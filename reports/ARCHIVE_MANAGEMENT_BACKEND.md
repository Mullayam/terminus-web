# Archive Management — Backend Spec

What to add on the server so the SFTP file browser can offer **Compress → ZIP**,
**Compress → TAR.GZ**, **Extract**, and **Extract Here**. Everything runs on the
**remote host** through the session's existing SSH/SFTP connection. Once these land,
the frontend wires the four context‑menu items, format submenu, spinner, and
auto‑refresh.

> Namespace: `/sftp` (same socket the other SFTP mutations use — `SFTP_COPY_FILE`,
> `SFTP_MOVE_FILE`, etc.).

---

## 1. Events to add

### Client → server

#### `@@SFTP_COMPRESS` — create an archive
```jsonc
{
  "sources": ["/var/www/app", "/var/www/config.yml"], // absolute paths to include
  "destination": "/var/www/app.zip",                  // absolute output path (with extension)
  "format": "zip",                                    // "zip" | "tar.gz"
  "cwd": "/var/www"                                   // base dir → relative entry names
}
```
- `sources` — one or more files/dirs. Entry names in the archive should be **relative
  to `cwd`** (so `app.zip` contains `app/…`, not `/var/www/app/…`).
- `destination` — full output path including extension. Frontend guarantees a
  collision‑free name.

#### `@@SFTP_EXTRACT` — extract an archive (covers "Extract" and "Extract Here")
```jsonc
{
  "archivePath": "/var/www/app.zip",  // absolute path of the archive
  "destination": "/var/www/app"       // absolute target directory (create if missing)
}
```
- **Extract Here** → frontend sends `destination = <currentDir>`.
- **Extract** → frontend sends `destination = <currentDir>/<archiveBaseName>`.
- Detect the format from the archive extension (`.zip` vs `.tar.gz` / `.tgz` / `.gz`);
  one handler covers both.

> You can reuse the existing dead `@@SFTP_ZIP_EXTRACT` enum slot by renaming it to
> `@@SFTP_EXTRACT`, or add fresh constants — your call. Keep the string values in
> sync with the frontend `SocketEventConstants`.

### Server → client (lifecycle — required)

| Event | Payload | When |
| ----- | ------- | ---- |
| `@@SUCCESS` | `"Archive created: app.zip"` / `"Extracted to /var/www/app"` | on completion → frontend refreshes the listing |
| `@@SFTP_EMIT_ERROR` (or `@@ERROR`) | `"<message>"` | on failure (missing binary, bad path, no disk space, non‑zero exit) |

### Server → client (progress — optional)

Archives don't expose easy byte progress. If you want a bar, emit a **dedicated**
event so it never collides with download/upload progress:

```jsonc
// @@SFTP_ARCHIVE_PROGRESS
{ "op": "compress", "name": "app.zip", "percent": 42, "status": "running" } // status: "running" | "completed" | "error"
```

> ⚠️ Do **not** reuse `@@COMPRESSING` / `@@EXTRACTING` for this. Those already carry
> directory‑download and upload‑extract progress and will cross‑talk. For v1, a
> spinner + `@@SUCCESS`/`@@ERROR` is enough — progress can come later.

---

## 2. Implementation (remote exec)

Run these over the session's SSH connection. Prefer `tar`/`gzip` (near‑universal);
`zip`/`unzip` are frequently **not** installed.

| Operation | Command |
| --------- | ------- |
| Compress ZIP | `zip -r <destination> <sources…>` (run with `cwd`) |
| Compress TAR.GZ | `tar -czf <destination> -C <cwd> <relative sources…>` |
| Extract ZIP | `unzip -o <archivePath> -d <destination>` |
| Extract TAR.GZ | `tar -xzf <archivePath> -C <destination>` |

**Binary fallback:** if `zip`/`unzip` is absent (`command -v zip`), either return a
clear `@@SFTP_EMIT_ERROR` ("`zip` not installed on the remote host") **or** fall back
to a Node stream (`archiver` for zip, `tar` package for tar.gz) piped over SFTP so it
works without remote binaries. `tar.gz` should always work via `tar`.

**Create target dir** on extract: `mkdir -p <destination>` before extracting.

---

## 3. Security (must‑have)

- **No shell string concatenation.** Pass paths as an **argument array**
  (`spawn`/`exec` with an argv array) or shell‑escape rigorously. Paths with spaces,
  quotes, `;`, `$()`, backticks, etc. must not break out (OWASP A03 — command
  injection).
- **Confine to the session root.** Reject any `sources`, `destination`, or
  `archivePath` containing `..` or resolving outside the connected user's allowed
  directory (path traversal).
- **Validate `format`** against an allow‑list (`zip`, `tar.gz`) — never derive a
  command from raw input.

---

## 4. Edge cases

- **Overwrite policy:** decide whether extract overwrites (`unzip -o`, `tar` default
  overwrite) or errors on existing files. "Extract Here" may overwrite; "Extract"
  gets a unique folder name from the frontend.
- **Empty / missing sources:** return `@@SFTP_EMIT_ERROR` if any `source` doesn't
  exist.
- **Large archives:** these can be long‑running — keep the socket handler async and
  stream stderr into the error message on non‑zero exit.
- **Disk space:** surface `No space left on device` verbatim in the error.

---

## 5. Frontend contract (what you can rely on)

- Frontend always sends **absolute** `sources`/`destination`/`archivePath`/`cwd`.
- Frontend computes collision‑free names (`app.zip`, `app-1.zip`, …) and the
  "Extract" target folder name (`<archiveBaseName>/`).
- After `@@SUCCESS`, frontend re‑emits `@@SFTP_GET_FILE { dirPath }` to refresh — you
  don't need to push a new listing yourself.
- On `@@SFTP_EMIT_ERROR` / `@@ERROR`, the message string is shown directly in a toast.

---

## Summary — checklist

- [ ] `@@SFTP_COMPRESS` handler (`zip` / `tar.gz`, relative to `cwd`)
- [ ] `@@SFTP_EXTRACT` handler (format from extension, `mkdir -p` target)
- [ ] Emit `@@SUCCESS` on done, `@@SFTP_EMIT_ERROR` on failure
- [ ] (optional) `@@SFTP_ARCHIVE_PROGRESS` for a progress bar
- [ ] Argv‑array exec + path‑traversal guard + format allow‑list
- [ ] `zip`/`unzip` availability check or Node stream fallback
