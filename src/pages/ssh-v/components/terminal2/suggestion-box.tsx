
import type React from "react"
import { useMemo } from "react"
import { useCommandStore } from "@/store";
import { useSessionTheme } from "@/hooks/useSessionTheme";

interface SuggestionBoxProps {
  suggestionPos: { top: number; left: number }
  suggestions: string[]
  isVisible?: boolean
  terminalHeight: number;
  terminalWidth: number;
  setSuggestions: React.Dispatch<React.SetStateAction<string[]>>
  /** localStorage key used to persist suggestions per host */
  hostKey?: string
}

/**
 * Mix two hex colors. `t` is 0-1 where 0 = c1, 1 = c2.
 */
function mixHex(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "").slice(0, 6);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const m = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${m(r1, r2).toString(16).padStart(2, "0")}${m(g1, g2).toString(16).padStart(2, "0")}${m(b1, b2).toString(16).padStart(2, "0")}`;
}

/**
 * Derive suggestion-box UI colors from the active terminal theme.
 * Falls back to the current hardcoded palette (tokyoNight-ish).
 */
function useBoxColors() {
  const { colors } = useSessionTheme();

  return useMemo(() => {
    // Cast to a loose record so we can safely read any xterm color key
    const c = colors as Record<string, string | undefined>;

    const bg = c.background ?? "#1a1b26";
    const fg = c.foreground ?? "#e0e0e0";
    const accent = c.green ?? c.cyan ?? "#22c55e";
    const accentBright = c.brightGreen ?? c.brightCyan ?? "#4ade80";
    const border = c.brightBlack ?? "#2c2d3c";
    // Mix bg toward fg at 12% so hover is always visible regardless of theme
    const hoverBg = mixHex(bg, fg, 0.12);
    const dimFg = c.brightBlack ?? "#6272a4";
    const errorFg = c.red ?? "#f43f5e";
    const errorBright = c.brightRed ?? "#fb7185";

    const hoverBorder = `${accent}40`; // subtle accent border on hover
    return { bg, fg, accent, accentBright, border, hoverBg, hoverBorder, dimFg, errorFg, errorBright };
  }, [colors]);
}

const AISuggestionBox: React.FC<SuggestionBoxProps> = ({ terminalHeight, setSuggestions, terminalWidth, suggestionPos, suggestions, isVisible = true, hostKey }) => {
  const { setCommand } = useCommandStore();
  const c = useBoxColors();
  const BOX_HEIGHT = 160;
  const BOX_WIDTH = 280;
  const OUTER_PADDING = 16; // p-2 = 0.5rem = 8px per side, total 16px
  const GAP = 30


  const handleCommandClick = (command: string) => {
    setCommand(command, "single");
  };

  if (!isVisible) return null;

  // Horizontal position
  const fitsRight = suggestionPos.left + BOX_WIDTH < terminalWidth;
  const adjustedLeft = fitsRight
    ? suggestionPos.left
    : Math.max(0, terminalWidth - BOX_WIDTH - 10); // 10px padding

  // Vertical position
  const fitsBelow = suggestionPos.top + BOX_HEIGHT + GAP < terminalHeight;
  const adjustedTop = fitsBelow
    ? suggestionPos.top + 8
    : suggestionPos.top - BOX_HEIGHT - GAP;
  return (
    <div
      className="absolute rounded-lg z-50 p-2"
      style={{
        top: adjustedTop,
        left: suggestionPos.left,
        width: BOX_WIDTH,
        height: BOX_HEIGHT,
        overflow: "hidden",
        background: c.bg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: c.border,
        color: c.accent,
      }}
    >
      <div
        className="overflow-y-auto scrollbar-thin scrollbar-green"
        style={{ height: BOX_HEIGHT - OUTER_PADDING }}
      >
        {suggestions.map((command, index) => (
          <div
            key={index}
            className="group flex justify-between items-center font-mono whitespace-nowrap overflow-hidden px-2 py-1 rounded text-xs transition-colors duration-150 cursor-pointer"
            style={{
              color: c.accent,
              borderBottom: index < suggestions.length - 1 ? `1px solid ${c.border}` : "none",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = c.hoverBg;
              el.style.color = c.accentBright;
              el.style.borderRadius = "4px";
              el.style.outline = `1px solid ${c.hoverBorder}`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = c.accent;
              el.style.outline = "none";
            }}
            onClick={() => handleCommandClick(command)}
          >
            <span className="truncate">{command}</span>

            {/* Cross button - visible only on hover */}
            <button
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: c.errorFg }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.errorBright; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = c.errorFg; }}
              onClick={(e) => {
                e.stopPropagation();
                setSuggestions((prevSuggestions) => {
                  const updated = Array.from(new Set(prevSuggestions.filter((s) => s !== command)));
                  // Persist removal to localStorage immediately
                  if (hostKey) {
                    try { localStorage.setItem(`terminus-suggestions:${hostKey}`, JSON.stringify(updated)); } catch { /* ignore */ }
                  }
                  return updated;
                });
              }}
            >
              ×
            </button>
          </div>

        ))}
      </div>
    </div>

  )
}


export default AISuggestionBox
