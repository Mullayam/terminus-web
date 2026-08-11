import type React from "react";
import { memo, useMemo } from "react";

/** Structured command metadata used to surface flag/subcommand hints. */
export interface ArgCommandInfo {
  name: string;
  options: string[];
  subcommands: Record<string, { options: string[] }>;
}

export type CommandIndex = Record<string, ArgCommandInfo>;

interface ArgHintBarProps {
  /** Current partial command the user is typing. */
  buffer: string;
  commandIndex: CommandIndex;
  bg: string;
  fg: string;
  accent: string;
  border: string;
  /** Insert a flag/subcommand into the live terminal input. */
  onInsert: (text: string) => void;
}

const MAX_HINTS = 16;

/**
 * Computes which flags/subcommands to hint for the current buffer.
 * Returns null when there is nothing useful to show.
 */
function computeHints(
  buffer: string,
  index: CommandIndex,
): { label: string; hints: string[] } | null {
  const trimmedStart = buffer.replace(/^\s+/, "");
  if (!trimmedStart) return null;

  const endsWithSpace = /\s$/.test(buffer);
  const tokens = trimmedStart.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  // Still typing the command itself — let the suggestion box handle it.
  if (tokens.length === 1 && !endsWithSpace) return null;

  const cmd = tokens[0];
  const info = index[cmd];
  if (!info) return null;

  const subNames = Object.keys(info.subcommands);
  const hasSubs = subNames.length > 0;
  // Token currently being typed (empty right after a space).
  const partial = endsWithSpace ? "" : tokens[tokens.length - 1];
  const sub = tokens[1];
  // A subcommand is "locked in" once it's an exact match followed by a space or
  // further tokens (e.g. `git commit ` / `git commit -m`).
  const subLocked = !!(sub && info.subcommands[sub] && (tokens.length > 2 || endsWithSpace));

  let label: string;
  let items: string[];
  if (subLocked) {
    label = `${cmd} ${sub}`;
    items = info.subcommands[sub].options;
  } else if (hasSubs && !partial.startsWith("-") && tokens.length <= 2) {
    // Right after the command (`git `) or typing the subcommand name (`git co`)
    // → offer subcommands, narrowed below by the partial prefix.
    label = cmd;
    items = subNames;
  } else {
    // Flags for the command (`git -`, `ls -a`, or a command with no subcommands).
    label = cmd;
    items = info.options;
  }

  const typed = new Set(tokens);
  const p = partial.toLowerCase();
  const hints = Array.from(new Set(items))
    .filter((h) => !typed.has(h))
    .filter((h) => (p ? h.toLowerCase().startsWith(p) : true))
    .slice(0, MAX_HINTS);
  if (hints.length === 0) return null;
  return { label, hints };
}

/**
 * Fig/Warp-style hint strip docked at the bottom of the terminal showing the
 * available flags/subcommands for the command being typed. Clicking a hint
 * inserts it into the live input.
 */
const ArgHintBar: React.FC<ArgHintBarProps> = ({ buffer, commandIndex, bg, fg, accent, border, onInsert }) => {
  const result = useMemo(() => computeHints(buffer, commandIndex), [buffer, commandIndex]);
  if (!result) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        bottom: 8,
        maxWidth: "calc(100% - 16px)",
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        background: `${bg}f2`,
        border: `1px solid ${border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
        overflow: "hidden",
      }}
    >
      <span style={{ color: accent, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
        {result.label}
      </span>
      <span style={{ color: `${fg}66`, flexShrink: 0 }}>▸</span>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
        {result.hints.map((hint) => (
          <button
            key={hint}
            onClick={() => onInsert(hint)}
            title={`Insert ${hint}`}
            style={{
              padding: "1px 6px",
              borderRadius: 5,
              border: `1px solid ${border}`,
              background: "transparent",
              color: `${fg}cc`,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${accent}22`;
              (e.currentTarget as HTMLElement).style.color = fg;
              (e.currentTarget as HTMLElement).style.borderColor = `${accent}80`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = `${fg}cc`;
              (e.currentTarget as HTMLElement).style.borderColor = border;
            }}
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
};

export default memo(ArgHintBar);
