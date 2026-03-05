/**
 * useCollabTerminalEffects — handles xterm-inline effects for:
 *   1. Theme changes → apply to xterm
 *   2. Kicked → ANSI art + sound + 10s countdown → redirect to jokes site
 *   3. Blocked → ANSI art in xterm
 */
import { useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { useCollabStore } from '../store';
import { useCollabTheme } from './useCollabTheme';

// ── ANSI escape helpers ────────────────────────────────────────────────
const ESC = '\x1b';
const CLEAR = `${ESC}[2J${ESC}[H`;
const BOLD = `${ESC}[1m`;
const RED = `${ESC}[31m`;
const YELLOW = `${ESC}[33m`;
const CYAN = `${ESC}[36m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;

function writeKickedArt(term: Terminal, message: string) {
  term.write(CLEAR);
  term.writeln('');
  term.writeln(`${RED}${BOLD}  ╔══════════════════════════════════════════════╗${RESET}`);
  term.writeln(`${RED}${BOLD}  ║                                              ║${RESET}`);
  term.writeln(`${RED}${BOLD}  ║         💋  YOU HAVE BEEN KICKED  💋        ║${RESET}`);
  term.writeln(`${RED}${BOLD}  ║                                              ║${RESET}`);
  term.writeln(`${RED}${BOLD}  ╚══════════════════════════════════════════════╝${RESET}`);
  term.writeln('');
  term.writeln(`  ${YELLOW}${message}${RESET}`);
  term.writeln('');
}

function writeCountdown(term: Terminal, seconds: number) {
  term.write(`\r  ${CYAN}Redirecting in ${BOLD}${seconds}${RESET}${CYAN} second${seconds !== 1 ? 's' : ''}...${RESET}   `);
}

function writeBlockedArt(term: Terminal, message: string) {
  term.write(CLEAR);
  term.writeln('');
  term.writeln(`${RED}${BOLD}  ╔══════════════════════════════════════════════╗${RESET}`);
  term.writeln(`${RED}${BOLD}  ║                                              ║${RESET}`);
  term.writeln(`${RED}${BOLD}  ║        🫷  YOU HAVE BEEN BLOCKED  🫸         ║${RESET}`);
  term.writeln(`${RED}${BOLD}  ║                                              ║${RESET}`);
  term.writeln(`${RED}${BOLD}  ╚══════════════════════════════════════════════╝${RESET}`);
  term.writeln('');
  term.writeln(`  ${DIM}${message}${RESET}`);
  term.writeln('');
  term.writeln(`  ${DIM}This session is no longer available.${RESET}`);
}

// ── Kick sound ────────────────────────────────────────────────────────
function playKickSound() {
  try {
    const audio = new Audio(`/FAHHHH.mp3`);
    audio.volume = 0.5;
    audio.play().catch(() => { /* autoplay policy */ });
  } catch {
    /* ignore */
  }
}

// ── Redirect target ───────────────────────────────────────────────────
const JOKES_URL = 'https://icanhazdadjoke.com/';

// ── Hook ──────────────────────────────────────────────────────────────
export function useCollabTerminalEffects(
  termRef: React.RefObject<Terminal | null>,
) {
  const { colors } = useCollabTheme();
  const kickedMessage = useCollabStore((s) => s.kickedMessage);
  const blockedMessage = useCollabStore((s) => s.blockedMessage);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Apply theme to xterm ─────────────────────────────────────────────
  useEffect(() => {
    const term = termRef.current;
    if (term) {
      term.options.theme = colors;
    }
  }, [colors, termRef]);

  // ── Kicked: ANSI art → sound → countdown → redirect ─────────────────
  useEffect(() => {
    const term = termRef.current;
    if (!kickedMessage || !term) return;

    writeKickedArt(term, kickedMessage);
    playKickSound();

    let remaining = 10;
    writeCountdown(term, remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        window.location.href = JOKES_URL;
      } else {
        writeCountdown(term, remaining);
      }
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [kickedMessage, termRef]);

  // ── Blocked: ANSI art in xterm ───────────────────────────────────────
  useEffect(() => {
    const term = termRef.current;
    if (!blockedMessage || !term) return;

    writeBlockedArt(term, blockedMessage);
  }, [blockedMessage, termRef]);
}
