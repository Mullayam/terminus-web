/**
 * Filesystem-aware autocomplete helpers: detect `cd`/`ls`-style commands in the
 * input buffer, build a silent listing command for the immediate directory, and
 * turn the result into runnable command suggestions.
 */

export interface FsEntry {
  name: string;
  type: "file" | "directory";
}

/** Commands whose last argument is a path we can complete. */
export const FS_COMMANDS = new Set([
  "cd", "ls", "cat", "vim", "vi", "nano", "less", "more", "rm", "cp", "mv",
  "touch", "mkdir", "rmdir", "source", ".", "stat", "file", "head", "tail",
  "du", "chmod", "chown", "tree", "code",
]);

/** Commands that should only ever complete to directories. */
const DIR_ONLY = new Set(["cd", "rmdir", "tree"]);

/**
 * Detect a filesystem command and the last path token being typed.
 * Returns null when the buffer isn't a completable filesystem command.
 */
export function parseFsCommand(buffer: string): { command: string; path: string } | null {
  const m = buffer.match(/^\s*([a-zA-Z.]+)\s+(?:.*\s)?([^\s]*)$/);
  if (!m) return null;
  const command = m[1];
  if (!FS_COMMANDS.has(command)) return null;
  return { command, path: m[2] ?? "" };
}

/** Split a typed path into its directory part and the partial name being typed. */
export function splitPath(path: string): { dir: string; partial: string } {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return { dir: ".", partial: path };
  return { dir: path.slice(0, idx) || "/", partial: path.slice(idx + 1) };
}

function shQuote(s: string): string {
  // Preserve leading ~ / ~user for shell home expansion; single-quote the rest.
  const tilde = s.match(/^(~[^/]*)(\/.*)?$/);
  if (tilde) {
    const rest = tilde[2] ?? "";
    return rest ? `${tilde[1]}/'${rest.slice(1).replace(/'/g, `'\\''`)}'` : tilde[1];
  }
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Build a silent command listing the immediate (non-nested) entries of `dir`
 * as `name<TAB>type`, where type is `d` (directory) or otherwise a file.
 */
export function buildListCommand(dir: string): string {
  const d = shQuote(dir);
  return `find -L ${d} -maxdepth 1 -mindepth 1 -printf '%f\\t%y\\n' 2>/dev/null | head -n 500`;
}

/** Parse `name<TAB>type` lines into filesystem entries. */
export function parseListOutput(raw: string): FsEntry[] {
  const entries: FsEntry[] = [];
  for (const line of raw.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const name = line.slice(0, tab);
    const t = line.slice(tab + 1).trim();
    if (!name) continue;
    entries.push({ name, type: t === "d" ? "directory" : "file" });
  }
  return entries;
}

/**
 * Turn directory entries into full runnable command suggestions
 * (e.g. `cd typescript/`), directories first, matching the partial prefix.
 */
export function buildFsSuggestions(command: string, path: string, entries: FsEntry[]): string[] {
  const { partial } = splitPath(path);
  const prefix = path.slice(0, path.length - partial.length);
  const lower = partial.toLowerCase();
  const dirOnly = DIR_ONLY.has(command);

  return entries
    .filter((e) => (!dirOnly || e.type === "directory") && e.name.toLowerCase().startsWith(lower))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((e) => `${command} ${prefix}${e.name}${e.type === "directory" ? "/" : ""}`)
    .slice(0, 50);
}
