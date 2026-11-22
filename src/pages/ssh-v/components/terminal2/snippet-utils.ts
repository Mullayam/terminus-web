/* Placeholder parsing for host snippets: `{{name}}` and `{{name:default}}`. */

export interface Placeholder {
  name: string;
  defaultValue: string;
}

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][\w-]*)\s*(?::([^}]*))?\}\}/g;

/** Unique placeholders in order of first appearance; the first default wins. */
export function parsePlaceholders(command: string): Placeholder[] {
  const seen = new Map<string, Placeholder>();
  for (const m of command.matchAll(PLACEHOLDER_RE)) {
    if (!seen.has(m[1])) seen.set(m[1], { name: m[1], defaultValue: m[2] ?? '' });
  }
  return [...seen.values()];
}

/** Substitute values as typed (no quoting — the user sees the final command). */
export function fillPlaceholders(command: string, values: Record<string, string>): string {
  return command.replace(PLACEHOLDER_RE, (_, name: string, def?: string) => values[name] ?? def ?? '');
}

export function hostKeyOf(session?: { username?: string; host?: string } | null): string | null {
  if (!session?.host) return null;
  return `${session.username ?? ''}@${session.host}`;
}

/** Comma/space separated tags → clean list. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
}
