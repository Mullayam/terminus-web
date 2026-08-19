/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useMemo, useRef, useState, memo, type Dispatch, type SetStateAction, type RefObject } from "react";
import { ChevronUp, ChevronDown, X, Search, Check } from "lucide-react";
import { Terminal } from "@xterm/xterm";

import { WebglAddon } from "@xterm/addon-webgl";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ImageAddon } from "@xterm/addon-image";
import { CanvasAddon } from "@xterm/addon-canvas";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { SerializeAddon } from "@xterm/addon-serialize";
import { Unicode11Addon } from "@xterm/addon-unicode11";

// import { AttachAddon } from '@xterm/addon-attach';

import { SocketEventConstants } from "@/lib/sockets/event-constants";

import { useCommandStore } from "@/store";
import { sound } from "@/lib/utils";
import { Socket } from "socket.io-client";
import { useTerminalStore } from "@/store/terminalStore";
import { useSSHStore } from "@/store/sshStore";
import { useTabStore } from '@/store/rightSidebarTabStore';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import AISuggestionBox from "./terminal2/suggestion-box";
import GhostText from "./terminal2/ghost-text";
import AIGhostText from "./terminal2/ai-ghost-text";
import InlineCommandInput from "./terminal2/inline-command-input";
import CollabTypingIndicator from "./terminal2/collab-typing-indicator";
import {
  useDiagnostics,
  TerminalInfoOverlay,
  DiagnosticsChat,
} from "./terminal2/diagnostics";
import useAudio from "@/hooks/useAudio";
import { XtermTheme, ThemeName } from "./themes";
import { getAllCommandData } from "@/lib/context-engine/contextEngineStorage";
import { useAIChatStore } from "@/store/aiChatStore";
import { createTerminalInputStore, useTerminalInput, shallowEqualObj, type TerminalInputStore, type TerminalInputSnapshot } from "./terminal2/inputStore";
import { rankSuggestions, type UsageMap } from "./terminal2/fuzzyRank";
import ArgHintBar, { type CommandIndex, type ArgCommandInfo } from "./terminal2/arg-hint-bar";
import { BUILTIN_COMMAND_INDEX } from "./terminal2/builtinCommands";
import CommandBlocks from "./terminal2/command-blocks";
import { useCommandBlocksStore, type CommandBlock } from "@/store/commandBlocksStore";
import { useMonitorStore } from "@/store/monitorStore";
import { useDockerStore } from "@/store/dockerStore";
import { useKubernetesStore } from "@/store/kubernetesStore";
import { fetchAICommand, stripAnsi as stripAnsiCmd } from "./terminal2/aiCommand";
import CommandPalette from "./terminal2/command-palette";
import CommandExplain from "./terminal2/command-explain";
import ShareSessionDialog from "./terminal2/share-session-dialog";
import { terminalEvents, TerminalEventKey } from "@/lib/terminalEvents";
import { parseFsCommand, splitPath, buildListCommand, parseListOutput, buildFsSuggestions, type FsEntry } from "./terminal2/fsSuggest";

const SEARCH_DECORATIONS: ISearchOptions["decorations"] = {
  matchBackground: "#FFA50080",
  matchBorder: "#FFA500",
  matchOverviewRuler: "#FFA500",
  activeMatchBackground: "#FF8C00",
  activeMatchBorder: "#FFFFFF",
  activeMatchColorOverviewRuler: "#FF8C00",
};

/* ── Overlay bridges ─────────────────────────────
 * These subscribe to the per-terminal input store so a keystroke re-renders
 * only the overlay leaf, never the parent XTerminal (which owns the xterm
 * canvas). The parent writes to the store but never subscribes to it.
 */
const GhostTextBridge = memo(function GhostTextBridge({
  store,
  termRef,
  containerRef,
  onAccept,
}: {
  store: TerminalInputStore;
  termRef: RefObject<Terminal | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onAccept: (fullCommand: string) => void;
}) {
  // Only re-render on buffer/suggestions changes — skip pos-only (cursor move) updates.
  const { buffer, suggestions } = useTerminalInput(
    store,
    (s) => ({ buffer: s.buffer, suggestions: s.suggestions }),
    shallowEqualObj,
  );
  return (
    <GhostText
      termRef={termRef}
      commandBuffer={buffer}
      suggestions={suggestions}
      onAccept={onAccept}
      containerRef={containerRef}
    />
  );
});

const SuggestionBoxBridge = memo(function SuggestionBoxBridge({
  store,
  terminalRef,
  setSuggestions,
  hostKey,
  sessionId,
  onDismiss,
}: {
  store: TerminalInputStore;
  terminalRef: RefObject<HTMLDivElement | null>;
  setSuggestions: Dispatch<SetStateAction<string[]>>;
  hostKey: string;
  sessionId: string;
  onDismiss: () => void;
}) {
  const { buffer, visible, pos, suggestions } = useTerminalInput(store);
  return (
    <AISuggestionBox
      suggestionPos={pos}
      isVisible={visible}
      suggestions={suggestions}
      terminalHeight={visible ? terminalRef.current?.offsetHeight || 600 : 600}
      terminalWidth={visible ? terminalRef.current?.offsetWidth || 800 : 800}
      setSuggestions={setSuggestions}
      hostKey={hostKey}
      commandBuffer={buffer}
      sessionId={sessionId}
      onDismiss={onDismiss}
    />
  );
});

const CollabTypingBridge = memo(function CollabTypingBridge({
  store,
  socket,
  termRef,
  containerRef,
  placeholderDisabled,
}: {
  store: TerminalInputStore;
  socket: Socket;
  termRef: RefObject<Terminal | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  placeholderDisabled: boolean;
}) {
  const buffer = useTerminalInput(store, (s) => s.buffer);
  return (
    <CollabTypingIndicator
      socket={socket}
      termRef={termRef}
      commandBuffer={buffer}
      containerRef={containerRef}
      placeholderDisabled={placeholderDisabled}
    />
  );
});

const ArgHintBridge = memo(function ArgHintBridge({
  store,
  commandIndex,
  bg,
  fg,
  accent,
  border,
  onInsert,
}: {
  store: TerminalInputStore;
  commandIndex: CommandIndex;
  bg: string;
  fg: string;
  accent: string;
  border: string;
  onInsert: (text: string) => void;
}) {
  const buffer = useTerminalInput(store, (s) => s.buffer);
  return (
    <ArgHintBar
      buffer={buffer}
      commandIndex={commandIndex}
      bg={bg}
      fg={fg}
      accent={accent}
      border={border}
      onInsert={onInsert}
    />
  );
});

// https://github.com/xtermjs/xterm.js/blob/master/demo/client.ts
const XTerminal = memo(function XTerminal({
  socket,
  sessionId,
  backgroundColor = "#181818",
}: {
  socket: Socket;
  sessionId: string;
  backgroundColor?: string;
}) {
  const { play } = useAudio(sound)
  const sessionHost = useSSHStore((s) => s.sessions[sessionId]?.host);
  const autocomplete = useTabStore((s) => s.settings.autocomplete);
  const suggestionBox = useTabStore((s) => s.settings.suggestionBox);
  const diagnosticsEnabled = useTabStore((s) => s.settings.diagnostics);
  const commandPaletteEnabled = useTabStore((s) => s.settings.commandPalette);
  const commandExplainEnabled = useTabStore((s) => s.settings.commandExplain);
  const commandBlocksEnabled = useTabStore((s) => s.settings.commandBlocks);
  const isRightSidebarOpen = useTabStore((s) => s.rightSidebarOpen);
  const isAIChatOpen = useAIChatStore((s) => s.isOpen);
  const sessionTheme = useSSHStore((s) => s.sessionThemes[sessionId]) || 'custom';
  const { fontSize = 15, fontWeight = '400', fontWeightBold = '700' } = useSSHStore((s) => s.sessionFonts[sessionId]) || {};

  // ── Diagnostics (error/warning detection) ──
  const { entries: diagEntries, counts: diagCounts, feed: diagFeed, clear: diagClear } = useDiagnostics();
  const setSessionDiagnostics = useDiagnosticsStore((s) => s.setSessionDiagnostics);
  const showDiagChat = useDiagnosticsStore((s) => s.showDiagChat);
  const diagFilter = useDiagnosticsStore((s) => s.diagFilter);
  const closeDiagChat = useDiagnosticsStore((s) => s.closeDiagChat);

  // ── AI Chat: capture terminal selection ──
  const setTerminalSelection = useAIChatStore((s) => s.setTerminalSelection);
  const setTerminalContent = useAIChatStore((s) => s.setTerminalContent);

  // Derive localStorage key from the session host/IP
  const hostKey = useMemo(() => {
    return `terminus-suggestions:${sessionHost ?? sessionId}`;
  }, [sessionId, sessionHost]);

  const termRef = useRef<Terminal | null>(null);
  // Access logs/addLogLine directly — avoid subscribing to the whole store
  const addLogLine = useTerminalStore((s) => s.addLogLine);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Per-terminal input store — overlays subscribe; the parent only writes.
  const inputStoreRef = useRef<TerminalInputStore | null>(null);
  if (!inputStoreRef.current) inputStoreRef.current = createTerminalInputStore();
  const isVisibleRef = useRef(false);
  // Set when the user dismisses the suggestion box with Escape; reset on the next
  // keystroke so it can re-appear.
  const suggestDismissedRef = useRef(false);
  // Mirrors the render gate below so key handling never blocks arrows when the
  // suggestion box is disabled in settings.
  const suggestBoxEnabledRef = useRef(false);
  // True while autocomplete (ghost text OR box) is on — lets us skip all
  // suggestion work when the whole feature is disabled.
  const autocompleteEnabledRef = useRef(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks an in-progress right-button drag (used to distinguish select vs paste)
  const rightDragRef = useRef<{
    startX: number;
    startY: number;
    startCell: { col: number; row: number } | null;
    t: number;
    dragged: boolean;
  } | null>(null);
  const [showInlineAI, setShowInlineAI] = useState(false);
  const showInlineAIRef = useRef(false);
  useEffect(() => { showInlineAIRef.current = showInlineAI; }, [showInlineAI]);
  const [showPalette, setShowPalette] = useState(false);
  const [explainCommand, setExplainCommand] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  useEffect(() => {
    autocompleteEnabledRef.current = autocomplete;
    suggestBoxEnabledRef.current = autocomplete && suggestionBox;
    // Disabling the box must free arrow keys immediately, not on next keystroke.
    if (!suggestBoxEnabledRef.current) {
      isVisibleRef.current = false;
      inputStoreRef.current?.set({ visible: false });
    }
  }, [autocomplete, suggestionBox]);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  // Wrapper (xterm + overlays) used to scope app shortcuts to this instance.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const allCommands = useCommandStore((s) => s.allCommands);
  const [suggestions, setSuggestions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`terminus-suggestions:${sessionHost ?? sessionId}`);
      return raw ? Array.from(JSON.parse(raw)) : [];
    } catch { return []; }
  });
  /** Extra ghost-text sources (store commands + context-engine packs). Not persisted to history. */
  const ghostSourcesRef = useRef<string[]>([]);
  const [ghostSourcesVersion, setGhostSourcesVersion] = useState(0);
  // Transient `cd`/`ls` directory-entry suggestions (never persisted).
  const fsSuggestionsRef = useRef<string[]>([]);
  const fsQueryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsPendingRef = useRef<{ requestId: string; command: string; path: string } | null>(null);
  // Cache the last listed directory so typing more chars filters locally (no refetch).
  const fsCacheRef = useRef<{ key: string; entries: FsEntry[] }>({ key: "", entries: [] });
  // Structured command metadata (flags/subcommands) for the arg-hint bar.
  const [commandIndex, setCommandIndex] = useState<CommandIndex>(BUILTIN_COMMAND_INDEX);
  const suggestionsRef = useRef(suggestions);
  // Set mirror of the user's history/typed commands, so the ranker can boost
  // them above generic pack suggestions. Rebuilt only when suggestions change.
  const historySetRef = useRef<Set<string>>(new Set(suggestions));
  useEffect(() => { suggestionsRef.current = suggestions; historySetRef.current = new Set(suggestions); }, [suggestions]);
  // Per-command usage stats (frequency + recency) used to rank suggestions.
  const usageKey = useMemo(() => `terminus-usage:${sessionHost ?? sessionId}`, [sessionId, sessionHost]);
  const usageRef = useRef<UsageMap>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(usageKey);
      usageRef.current = raw ? JSON.parse(raw) : {};
    } catch { usageRef.current = {}; }
  }, [usageKey]);
  // Load persisted shell history (IndexedDB) and seed suggestions from it.
  useEffect(() => {
    let cancelled = false;
    const host = sessionHost ?? sessionId;
    useCommandStore.getState().loadShellHistory(host).then(() => {
      if (cancelled) return;
      const hist = useCommandStore.getState().shellHistory[host] ?? [];
      if (hist.length) setSuggestions((prev) => Array.from(new Set([...prev, ...hist])));
    });
    return () => { cancelled = true; };
  }, [sessionHost, sessionId]);
  const diagnosticsEnabledRef = useRef(diagnosticsEnabled);
  useEffect(() => { diagnosticsEnabledRef.current = diagnosticsEnabled; }, [diagnosticsEnabled]);
  const commandBlocksEnabledRef = useRef(commandBlocksEnabled);
  useEffect(() => { commandBlocksEnabledRef.current = commandBlocksEnabled; }, [commandBlocksEnabled]);
  const commandBufferRef = useRef<string>("");
  const [isAltScreen, setIsAltScreen] = useState(false);
  const isAltScreenRef = useRef(false);
  useEffect(() => { isAltScreenRef.current = isAltScreen; }, [isAltScreen]);
  const inputResyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Coalesces overlay store updates to one per frame (off the keystroke path).
  const inputRafRef = useRef<number | null>(null);
  // Latest pushInputState() opts; the expensive ranking runs once per frame in
  // the rAF, so a burst of keystrokes never re-ranks the pack pool N times.
  const pendingInputOptsRef = useRef<{ forceVisible?: boolean } | undefined>(undefined);
  const lastKeyAtRef = useRef(0);
  // Cached xterm helper textarea — avoids re-querying + reflow on cursor move.
  const helperTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Latest input-state pusher, kept in a ref so callbacks never go stale.
  const pushInputStateRef = useRef<(opts?: { forceVisible?: boolean }) => void>(() => { });
  const command = useCommandStore((s) => s.command);
  const setCommand = useCommandStore((s) => s.setCommand);
  const addShellHistoryCommand = useCommandStore((s) => s.addShellHistoryCommand);
  const addShellHistoryBatch = useCommandStore((s) => s.addShellHistoryBatch);
  const shellHistoryHost = sessionHost ?? sessionId;

  /* ── Ghost text: accept the inline autocomplete suggestion ── */
  const handleGhostAccept = useCallback((fullCommand: string) => {
    // Type the remaining characters into the terminal
    const remaining = fullCommand.slice(commandBufferRef.current.length);
    if (remaining && termRef.current) {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, remaining);
      commandBufferRef.current = fullCommand;
      pushInputStateRef.current({ forceVisible: false });
    }
  }, [socket]);

  /* ── AI Ghost text: accept the AI-suggested command ── */
  const handleAIGhostAccept = useCallback((cmd: string) => {
    if (cmd) {
      // Clear current input by sending backspaces, then type the AI command
      const currentLen = commandBufferRef.current.length;
      if (currentLen > 0) {
        socket.emit(SocketEventConstants.SSH_EMIT_INPUT, '\x7f'.repeat(currentLen));
      }
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd);
      commandBufferRef.current = cmd;
      pushInputStateRef.current({ forceVisible: false });
    }
  }, [socket]);

  const lastPromptPrefixRef = useRef('');

  /* ── Arg-hint bar: insert a flag/subcommand into the live input ── */
  const handleArgInsert = useCallback((text: string) => {
    const buf = commandBufferRef.current;
    const needsSpace = buf.length > 0 && !buf.endsWith(' ');
    const ins = (needsSpace ? ' ' : '') + text + ' ';
    socket.emit(SocketEventConstants.SSH_EMIT_INPUT, ins);
    commandBufferRef.current = buf + ins;
    pushInputStateRef.current({ forceVisible: false });
    termRef.current?.focus();
  }, [socket]);

  /* ── Command blocks: re-run a captured command ── */
  const handleBlockRerun = useCallback((cmd: string) => {
    if (!isAltScreenRef.current) {
      const store = useCommandBlocksStore.getState();
      store.finalizeCurrent(sessionId);
      store.startBlock(sessionId, cmd);
    }
    commandBufferRef.current = "";
    socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd + '\r');
    pushInputStateRef.current({ forceVisible: false });
    termRef.current?.focus();
  }, [socket, sessionId]);

  /* ── Command blocks: ask AI to fix a failed command ── */
  const handleBlockFix = useCallback(async (block: CommandBlock): Promise<string> => {
    const logs = useTerminalStore.getState().logs[sessionId] ?? [];
    const termContext = stripAnsiCmd(logs.slice(-40).join('')).trim();
    const question =
      `The shell command \`${block.command}\` produced this output:\n` +
      `${block.output.slice(-1500)}\n\n` +
      `If it failed, reply with a single corrected shell command that fixes the problem. ` +
      `Reply ONLY with the raw command — no explanation, no markdown, no code fences.`;
    const cmd = await fetchAICommand({
      sessionId,
      question,
      context: termContext ? `Recent terminal output:\n${termContext}` : '',
    });
    if (cmd) useAIChatStore.getState().setGhostCommand(sessionId, cmd);
    return cmd;
  }, [sessionId]);

  const handleSearchNext = () => {
    const query = searchInputRef.current?.value || '';
    searchAddonRef.current?.findNext(query, {
      decorations: SEARCH_DECORATIONS
    });
  };

  const handleSearchPrev = () => {
    const query = searchInputRef.current?.value || '';
    searchAddonRef.current?.findPrevious(query, {
      decorations: SEARCH_DECORATIONS
    });
  };

  function getRemainingSuggestion(input: string, suggestion: string) {
    if (suggestion.startsWith(input)) {
      return suggestion.slice(input.length);
    }
    return suggestion;
  }

  function capturePrompt() {
    const buffer = termRef.current?.buffer.active;

    if (buffer) {

      const line = buffer.getLine(buffer.cursorY - 1);
      const text = line?.translateToString(true) ?? '';

      const match = text.match(/^(.*?[#$>] )/);
      if (match) {
        lastPromptPrefixRef.current = match[1];
      }
    }

  }

  // Reads the user-typed portion of the current prompt line straight from the
  // xterm buffer. Returns null when the cursor isn't on a recognizable prompt
  // line (streaming output or a full-screen TUI on the alternate buffer).
  function readCurrentInput(): string | null {
    const term = termRef.current;
    if (!term) return null;
    const buf = term.buffer.active;
    if (buf.type === 'alternate') return null;
    const raw = buf.getLine(buf.baseY + buf.cursorY)?.translateToString(true) ?? '';
    const stored = lastPromptPrefixRef.current;
    let prompt = '';
    if (stored && raw.startsWith(stored)) {
      prompt = stored;
    } else {
      const match = raw.match(/^(.*?[#$>] )/);
      if (!match) return null;
      prompt = match[1];
      lastPromptPrefixRef.current = prompt; // self-heal to the live prompt
    }
    return raw.slice(prompt.length).replace(/\s+$/, '');
  }

  // Re-derives commandBuffer from the real terminal line once the cursor
  // settles — fixes desyncs from history recall (↑/↓), remote tab-complete,
  // kill-line, and paste that the keystroke tracker never sees. Skipped right
  // after a keystroke so the optimistic value isn't reverted mid-typing.
  const scheduleInputResync = () => {
    if (inputResyncTimerRef.current) clearTimeout(inputResyncTimerRef.current);
    inputResyncTimerRef.current = setTimeout(() => {
      if (Date.now() - lastKeyAtRef.current < 100) return;
      const input = readCurrentInput();
      if (input === null || input === commandBufferRef.current) return;
      commandBufferRef.current = input;
      pushInputStateRef.current();
    }, 60);
  };

  // App-level shortcuts. Routed through xterm's customKeyEventHandler so keys the
  // terminal would otherwise consume (Ctrl+F, Ctrl+K, …) are caught before being
  // sent to the shell, and only while the terminal is focused. Returns true when
  // the event was consumed (so xterm ignores it).
  const handleAppShortcut = (e: KeyboardEvent): boolean => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
      return true;
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      const next = !showInlineAIRef.current;
      showInlineAIRef.current = next;
      setShowInlineAI(next);
      // Hide the suggestion box so it doesn't swallow Escape while inline AI is open.
      pushInputStateRef.current();
      return true;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
      e.preventDefault();
      if (useTabStore.getState().settings.commandBlocks) useCommandBlocksStore.getState().togglePanel(sessionId);
      return true;
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (useTabStore.getState().settings.commandPalette) setShowPalette((v) => !v);
      return true;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      if (useTabStore.getState().settings.commandExplain) {
        const cmd = commandBufferRef.current.trim();
        setExplainCommand((prev) => (prev !== null ? null : cmd || ''));
      }
      return true;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      setShowShare((v) => !v);
      return true;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      e.preventDefault();
      useMonitorStore.getState().toggle();
      return true;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      useDockerStore.getState().toggle();
      return true;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
      e.preventDefault();
      useKubernetesStore.getState().toggle();
      return true;
    }
    if (e.key === 'Escape') {
      // Close overlays but let Escape still reach the shell (vim, less, …).
      searchAddonRef.current?.clearDecorations();
      searchAddonRef.current?.clearActiveDecoration();
      setShowSearch(false);
      setShowShare(false);
      setExplainCommand(null);
    }
    return false;
  };
  // Copy-on-select: when a left-drag selection ends, copy it to the clipboard
  // and clear the selection (PuTTY-style).
  const handleMouseUp = async (e: MouseEvent) => {
    if (e.button !== 0) return;
    const selection = termRef.current?.getSelection()?.trim();
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection);
    } catch (err) {
      // clipboard write can be blocked; ignore
    }
    termRef.current?.clearSelection();
    setShowCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setShowCopied(false), 1200);
  };

  // ── Right button: drag to select, plain click to paste ──
  // xterm only drag-selects with the left button, so right-drag selection is
  // implemented manually; a simple click (no drag) pastes instead.
  const getCellFromEvent = (e: MouseEvent): { col: number; row: number } | null => {
    const term = termRef.current;
    const dims = (term as any)?._core?._renderService?.dimensions;
    const screen = term?.element?.querySelector(".xterm-screen") as HTMLElement | null;
    if (!term || !dims || !screen) return null;
    const rect = screen.getBoundingClientRect();
    const cellW = dims.css.cell.width || 1;
    const cellH = dims.css.cell.height || 1;
    const col = Math.max(0, Math.min(term.cols - 1, Math.floor((e.clientX - rect.left) / cellW)));
    const row = Math.max(0, Math.min(term.rows - 1, Math.floor((e.clientY - rect.top) / cellH)));
    return { col, row };
  };

  const selectRightDragRange = (start: { col: number; row: number }, end: { col: number; row: number }) => {
    const term = termRef.current;
    if (!term) return;
    const cols = term.cols;
    const top = term.buffer.active.viewportY;
    let a = (top + start.row) * cols + start.col;
    let b = (top + end.row) * cols + end.col;
    if (b < a) [a, b] = [b, a];
    const selRow = Math.floor(a / cols);
    term.select(a - selRow * cols, selRow, b - a + 1);
  };

  const handleRightMouseMove = (e: MouseEvent) => {
    const st = rightDragRef.current;
    if (!st) return;
    if (!st.dragged && (Math.abs(e.clientX - st.startX) > 4 || Math.abs(e.clientY - st.startY) > 4)) {
      st.dragged = true;
    }
    if (st.dragged && st.startCell) {
      const cell = getCellFromEvent(e);
      if (cell) selectRightDragRange(st.startCell, cell);
      e.preventDefault();
    }
  };

  const handleRightMouseUp = async (e: MouseEvent) => {
    const st = rightDragRef.current;
    rightDragRef.current = null;
    window.removeEventListener("mousemove", handleRightMouseMove, true);
    window.removeEventListener("mouseup", handleRightMouseUp, true);
    if (!st || e.button !== 2) return;

    if (st.dragged) {
      // Selection gesture — copy and keep the highlight visible
      const selection = termRef.current?.getSelection()?.trim();
      if (selection) {
        try { await navigator.clipboard.writeText(selection); } catch { /* clipboard blocked */ }
        setShowCopied(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setShowCopied(false), 1200);
      }
      return;
    }

    // Simple click (no drag) within the click window → paste
    if (Date.now() - st.t < 400) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) termRef.current?.paste(text);
      } catch { /* clipboard blocked */ }
    }
  };

  const handleRightMouseDown = (e: MouseEvent) => {
    if (e.button !== 2) return;
    rightDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCell: getCellFromEvent(e),
      t: Date.now(),
      dragged: false,
    };
    window.addEventListener("mousemove", handleRightMouseMove, true);
    window.addEventListener("mouseup", handleRightMouseUp, true);
  };

  // Suppress the native context menu; right-click paste/select runs on mouse up.
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  // Reads the suggestion-box anchor from the xterm helper textarea. The
  // textarea is cached so we don't re-query the DOM or force a layout reflow
  // (getBoundingClientRect) on every cursor move.
  const readSuggestionPos = (): { top: number; left: number } | null => {
    let textarea = helperTextareaRef.current;
    if (!textarea || !textarea.isConnected) {
      textarea = terminalRef.current?.querySelector(
        ".xterm-helper-textarea"
      ) as HTMLTextAreaElement | null;
      helperTextareaRef.current = textarea;
    }
    if (!textarea) return null;
    return {
      left: parseFloat(textarea.style.left),
      top: parseFloat(textarea.style.top) + 20,
    };
  };

  // Debounced: detect a `cd`/`ls` command in the buffer and announce the
  // partial path so the filesystem-autocomplete listener can fetch entries.
  const scheduleFsQuery = (buffer: string) => {
    const fs = parseFsCommand(buffer);
    if (!fs) {
      if (fsSuggestionsRef.current.length) fsSuggestionsRef.current = [];
      fsPendingRef.current = null;
      return;
    }
    const { dir } = splitPath(fs.path);
    const key = `${fs.command}|${dir}`;
    // Same directory as last listing → just re-filter locally, no network.
    if (key === fsCacheRef.current.key) {
      fsSuggestionsRef.current = buildFsSuggestions(fs.command, fs.path, fsCacheRef.current.entries);
      return;
    }
    if (fsQueryTimerRef.current) clearTimeout(fsQueryTimerRef.current);
    fsQueryTimerRef.current = setTimeout(() => {
      terminalEvents.emit(TerminalEventKey.FILESYSTEM_COMMAND, { command: fs.command, path: fs.path, sessionId });
    }, 160);
  };

  // Push current input state to the overlay store. The expensive ranking runs
  // ONCE per animation frame (off the synchronous keystroke path), so typing
  // stays smooth even with large command-pack pools; only the overlay bridges
  // re-render, never the parent.
  const pushInputState = (opts?: { forceVisible?: boolean }) => {
    // Feature fully off → do no suggestion work and keep arrow keys free.
    if (!autocompleteEnabledRef.current) {
      isVisibleRef.current = false;
      return;
    }
    // Reset the Escape-dismiss latch synchronously so a forced re-show survives
    // frame coalescing.
    if (opts?.forceVisible) suggestDismissedRef.current = false;
    // Record the latest intent; ranking + store update happen in the rAF below.
    pendingInputOptsRef.current = opts;
    if (inputRafRef.current != null) return;
    inputRafRef.current = requestAnimationFrame(() => {
      inputRafRef.current = null;
      const o = pendingInputOptsRef.current;
      const buffer = commandBufferRef.current;
      // Detect `cd`/`ls`-style commands → fetch immediate directory entries.
      scheduleFsQuery(buffer);
      const fsList = fsSuggestionsRef.current;
      let suggestions: string[];
      if (buffer === "") {
        suggestions = [...fsList, ...suggestionsRef.current, ...ghostSourcesRef.current];
      } else {
        // Live `cd`/`ls` directory entries stay on top; then user history ranks
        // above generic pack/context-engine suggestions.
        const fsRanked = fsList.length ? rankSuggestions(buffer, fsList, usageRef.current) : [];
        const restRanked = rankSuggestions(
          buffer,
          [...suggestionsRef.current, ...ghostSourcesRef.current],
          usageRef.current,
          historySetRef.current,
        );
        const seen = new Set(fsRanked);
        suggestions = [...fsRanked, ...restRanked.filter((s) => !seen.has(s))];
      }
      // `suggestions` already blends fs entries + history + command packs (filtered
      // by the ranker), so gate visibility on it — otherwise pack-only matches
      // (with no matching history) would never open the box.
      const visible =
        suggestBoxEnabledRef.current &&
        !showInlineAIRef.current &&
        !suggestDismissedRef.current &&
        (o?.forceVisible ??
          (buffer.trim() !== "" && suggestions.length > 0));
      isVisibleRef.current = visible;
      const patch: Partial<TerminalInputSnapshot> = { buffer, visible, suggestions };
      if (visible) {
        const p = readSuggestionPos();
        if (p) patch.pos = p;
      }
      inputStoreRef.current!.set(patch);
    });
  };
  pushInputStateRef.current = pushInputState;

  // Cursor-move handler: only reposition while the box is actually visible.
  const updateSuggestionBox = () => {
    if (!isVisibleRef.current) return;
    const p = readSuggestionPos();
    if (p) inputStoreRef.current!.set({ pos: p });
  };

  const handleFocus = () => {
    termRef.current?.focus();
  };

  // Escape from the suggestion box hides it until the next keystroke.
  const dismissSuggestions = useCallback(() => {
    suggestDismissedRef.current = true;
    isVisibleRef.current = false;
    inputStoreRef.current?.set({ visible: false });
  }, []);

  // (Re)builds ghost-text sources (command packs + store commands) and the
  // arg-hint command index. Runs on mount and whenever `allCommands` changes
  // (e.g. after a pack is installed/uninstalled) so packs surface in the
  // suggestion box and ghost text without remounting the terminal.
  const reloadCommandSources = useCallback(() => {
    const storeCmds = useCommandStore.getState().allCommands.map((c) => c.command.toLocaleLowerCase());
    const base = Array.from(new Set(storeCmds));
    ghostSourcesRef.current = base;

    getAllCommandData().then((cmdRecords) => {
      const cmds: string[] = [];
      // Start from a deep copy of the built-ins so installed packs extend them
      // without mutating the shared constant.
      const index: CommandIndex = {};
      for (const [k, v] of Object.entries(BUILTIN_COMMAND_INDEX)) {
        index[k] = {
          name: v.name,
          options: [...v.options],
          subcommands: Object.fromEntries(
            Object.entries(v.subcommands).map(([s, o]) => [s, { options: [...o.options] }]),
          ),
        };
      }
      for (const item of cmdRecords) {
        // A record's data may be a single command object or an array of them.
        const objects: any[] = Array.isArray(item.data) ? item.data : (item.data ? [item.data] : []);
        for (const data of objects) {
          const name = data?.name;
          if (!name) continue;
          cmds.push(name);
          const info: ArgCommandInfo = index[name] ?? { name, options: [], subcommands: {} };
          // Packs store top-level flags under `globalOptions`; keep `options` as fallback.
          const topOptions = Array.isArray(data?.globalOptions) ? data.globalOptions : data?.options;
          if (Array.isArray(topOptions)) {
            for (const opt of topOptions) if (opt?.name) info.options.push(opt.name);
          }
          if (Array.isArray(data?.subcommands)) {
            for (const sub of data.subcommands) {
              if (!sub?.name) continue;
              cmds.push(`${name} ${sub.name}`);
              const subInfo = info.subcommands[sub.name] ?? { options: [] };
              if (Array.isArray(sub?.options)) {
                for (const opt of sub.options) {
                  if (opt?.name) {
                    cmds.push(`${name} ${sub.name} ${opt.name}`);
                    subInfo.options.push(opt.name);
                  }
                }
              }
              if (Array.isArray(sub?.examples)) {
                for (const ex of sub.examples) {
                  if (typeof ex === "string") cmds.push(ex);
                }
              }
              info.subcommands[sub.name] = subInfo;
            }
          }
          index[name] = info;
        }
      }
      // Rebuild fresh from store + pack commands (not a merge) so uninstalled
      // pack commands are actually dropped.
      ghostSourcesRef.current = Array.from(new Set([...base, ...cmds]));
      setGhostSourcesVersion((v) => v + 1);
      if (Object.keys(index).length > 0) setCommandIndex(index);
    }).catch(() => { });
  }, []);

  // Reload ghost-text sources when the installed command set changes.
  useEffect(() => { reloadCommandSources(); }, [allCommands, reloadCommandSources]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      cursorWidth: 1,
      fontFamily: "monospace",
      fontSize,
      fontWeight: fontWeight as any,
      fontWeightBold: fontWeightBold as any,
      theme: XtermTheme[sessionTheme] || XtermTheme.default,
    });

    termRef.current = term;
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;

    const searchAddon = new SearchAddon({
      highlightLimit: 1000,

    });
    try { term.loadAddon(new WebglAddon()); } catch { term.loadAddon(new CanvasAddon()); }
    term.loadAddon(new ImageAddon());
    term.loadAddon(new SerializeAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new ClipboardAddon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    term.open(terminalRef.current);
    requestAnimationFrame(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        socket.emit(SocketEventConstants.SSH_EMIT_RESIZE, { cols: term.cols, rows: term.rows });
      }
    });
    searchAddonRef.current = searchAddon;

    new LigaturesAddon().activate(term);

    // Arrow Up/Down kept free for shell history — box no longer blocks them.
    // term.attachCustomKeyEventHandler((e) => {
    //   if (isVisibleRef.current && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    //     return false; // prevent xterm from sending escape sequences to shell
    //   }
    //   return true;
    // });

    // Track alternate-screen switches (vim/htop/less/tmux) so the empty-line
    // placeholder and ghost text stay hidden inside full-screen apps.
    setIsAltScreen(term.buffer.active.type === 'alternate');
    isAltScreenRef.current = term.buffer.active.type === 'alternate';
    const disposeBufferChange = term.buffer.onBufferChange(() => {
      const alt = term.buffer.active.type === 'alternate';
      isAltScreenRef.current = alt;
      setIsAltScreen(alt);
      // Stop attributing full-screen-app output to the last command block.
      if (alt) useCommandBlocksStore.getState().finalizeCurrent(sessionId);
    });

    if (!sessionHost) {
      term.write("\x1b[32mConnecting...\r\n\x1b[0m");
    }

    const disposeOnData = term.onData((input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, input);
      if (input === '\r') {
        capturePrompt();
      }
    });

    const disposeOnResize = term.onResize((size) => {
      socket.emit(SocketEventConstants.SSH_EMIT_RESIZE, size);
    });


    const currentLogs = useTerminalStore.getState().logs[sessionId];
    if (currentLogs?.length) {
      term.write(currentLogs.join(""));
    }
    const handleResize = () => {
      fitAddon.fit();
    };

    const handleSSHData = (input: string) => {
      term.write(input);
      term.scrollToBottom();
      addLogLine(sessionId, input);
      // Clear any pending background-activity flag while the tab is visible
      useSSHStore.getState().clearSessionActivity(sessionId);
      // Feed output to diagnostics scanner (only if enabled)
      if (diagnosticsEnabledRef.current) diagFeed(input);
      // Attribute output to the current command block (skip full-screen apps)
      if (!isAltScreenRef.current && commandBlocksEnabledRef.current) useCommandBlocksStore.getState().appendOutput(sessionId, input);
    };
    socket.on(SocketEventConstants.SSH_EMIT_DATA, handleSSHData);
    // Server sends shell history after ready
    socket.on(SocketEventConstants.SSH_EXEC_SILENT_RESULT, (history: string[]) => {
      if (!Array.isArray(history)) return;
      const cleaned = history.map(c => (typeof c === "string" ? c.trim() : "")).filter(Boolean);

      // 1. Add to zustand shell history (sidebar reads this — in-memory only)
      // Read host fresh from store to avoid stale closure (session may not be connected at mount time)
      const currentHost = useSSHStore.getState().sessions[sessionId]?.host ?? sessionId;
      addShellHistoryBatch(currentHost, cleaned);

      // 2. Also merge into suggestions so ghost-text can autocomplete from shell history
      setSuggestions((prev) => {
        const set = new Set(prev);
        let added = false;
        for (const cmd of cleaned) {
          if (!set.has(cmd)) { set.add(cmd); added = true; }
        }
        if (!added) return prev;
        const arr = Array.from(set);
        return arr.length > 5000 ? arr.slice(-5000) : arr;
      });
    });

    // Filesystem autocomplete: turn a detected `cd`/`ls` into a silent listing
    // request, and feed the parsed entries back into the suggestions.
    const offFsEvent = terminalEvents.on(TerminalEventKey.FILESYSTEM_COMMAND, ({ command, path, sessionId: sid }) => {
      if (sid !== sessionId) return;
      const { dir } = splitPath(path);
      const requestId = `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      fsPendingRef.current = { requestId, command, path };
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId, cmd: buildListCommand(dir) });
    });
    const handleFsOutput = (payload: { requestId: string; output: string }) => {
      const pending = fsPendingRef.current;
      if (!pending || !payload || pending.requestId !== payload.requestId) return;
      const entries = parseListOutput(payload.output ?? "");
      const { dir } = splitPath(pending.path);
      fsCacheRef.current = { key: `${pending.command}|${dir}`, entries };
      fsSuggestionsRef.current = buildFsSuggestions(pending.command, pending.path, entries);
      pushInputStateRef.current();
    };
    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, handleFsOutput);

    window.addEventListener("resize", handleResize);


    // Ghost-text sources + arg-hint index are loaded by reloadCommandSources()
    // in a dedicated effect keyed on `allCommands`, so newly installed/uninstalled
    // command packs refresh live without remounting the terminal.

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off(SocketEventConstants.SSH_EMIT_DATA, handleSSHData);
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_RESULT);
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, handleFsOutput);
      offFsEvent();
      if (fsQueryTimerRef.current) clearTimeout(fsQueryTimerRef.current);
      disposeOnData.dispose();
      disposeOnResize.dispose();
      disposeBufferChange.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, socket]);

  // Reactively apply theme changes to the live terminal instance
  useEffect(() => {
    if (termRef.current) {
      const newTheme = XtermTheme[sessionTheme] || XtermTheme.default;
      termRef.current.options.theme = newTheme;
    }
  }, [sessionTheme]);

  // Track terminal text selection for AI chat context
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const disposeSelection = term.onSelectionChange(() => {
      const selection = term.getSelection()?.trim();
      if (selection) {
        setTerminalSelection(sessionId, selection);
      }
    });
    return () => disposeSelection.dispose();
  }, [sessionId, setTerminalSelection]);

  // Capture full visible terminal screen for AI context when chat is open
  useEffect(() => {
    if (!isAIChatOpen || !termRef.current) return;
    const term = termRef.current;
    const buf = term.buffer.active;
    const lines: string[] = [];
    const start = Math.max(0, buf.baseY);
    const end = buf.baseY + term.rows;
    for (let i = start; i < end; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    setTerminalContent(sessionId, lines.join('\n').trimEnd());
  }, [isAIChatOpen, sessionId, setTerminalContent]);

  // Reactively apply font settings changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      termRef.current.options.fontWeight = fontWeight as any;
      termRef.current.options.fontWeightBold = fontWeightBold as any;
      fitAddonRef.current?.fit();
    }
  }, [fontSize, fontWeight, fontWeightBold]);

  // Persist suggestions to localStorage keyed by host
  useEffect(() => {
    try {
      localStorage.setItem(hostKey, JSON.stringify(suggestions));
    } catch { /* quota exceeded — silently ignore */ }
  }, [suggestions, hostKey]);

  // Keep overlay suggestions in sync when the suggestion pool changes.
  useEffect(() => {
    pushInputStateRef.current({ forceVisible: isVisibleRef.current });
  }, [suggestions, ghostSourcesVersion]);

  // Sync diagnostics to the shared store so the status bar can read them
  useEffect(() => {
    if (diagnosticsEnabled) {
      setSessionDiagnostics(sessionId, diagEntries, diagCounts);
    }
  }, [diagEntries, diagCounts, diagnosticsEnabled, sessionId, setSessionDiagnostics]);

  useEffect(() => {
    const handleKey = ({
      key,
      domEvent,
    }: {
      key: string;
      domEvent: KeyboardEvent;
    }) => {
      const isEnter = domEvent.key === "Enter";
      const isBackspace = domEvent.key === "Backspace";
      const isPrintable =
        domEvent.key.length === 1 &&
        !domEvent.ctrlKey &&
        !domEvent.metaKey &&
        !domEvent.altKey;

      if (domEvent.ctrlKey && domEvent.code === "Space") {
        domEvent.preventDefault();
        pushInputStateRef.current({ forceVisible: true });
      }

      // Ctrl+C / Ctrl+D / Ctrl+Z → interrupt / EOF / suspend → clear buffer
      if (domEvent.ctrlKey && (domEvent.key === 'c' || domEvent.key === 'd' || domEvent.key === 'z')) {
        commandBufferRef.current = "";
        fsSuggestionsRef.current = [];
        fsCacheRef.current = { key: "", entries: [] };
        pushInputStateRef.current({ forceVisible: false });
        return;
      }

      if (isEnter) {
        const trimmed = commandBufferRef.current.trim();
        if (trimmed.length > 0) {
          setSuggestions(prev => {
            if (prev.includes(trimmed)) return prev;
            const next = [...prev, trimmed];
            return next.length > 5000 ? next.slice(-5000) : next;
          });
          addShellHistoryCommand(shellHistoryHost, trimmed);
          // Bump frequency/recency stats for ranking.
          const u = usageRef.current;
          const prev = u[trimmed];
          u[trimmed] = { count: (prev?.count ?? 0) + 1, last: Date.now() };
          try { localStorage.setItem(usageKey, JSON.stringify(u)); } catch { /* quota */ }
          // Start a new command block to capture this command's output.
          if (!isAltScreenRef.current && commandBlocksEnabledRef.current) useCommandBlocksStore.getState().startBlock(sessionId, trimmed);
        }
        commandBufferRef.current = "";
        fsSuggestionsRef.current = [];
        fsCacheRef.current = { key: "", entries: [] };
        pushInputStateRef.current({ forceVisible: false });
        return;
      }

      if (isBackspace) {
        lastKeyAtRef.current = Date.now();
        suggestDismissedRef.current = false;
        commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        pushInputStateRef.current();
        return;
      }

      if (isPrintable) {
        lastKeyAtRef.current = Date.now();
        suggestDismissedRef.current = false;
        // Starting a new command → stop capturing output into the previous block.
        if (commandBufferRef.current === "" && !isAltScreenRef.current && commandBlocksEnabledRef.current) {
          useCommandBlocksStore.getState().finalizeCurrent(sessionId);
        }
        commandBufferRef.current = commandBufferRef.current + key;
        pushInputStateRef.current();
      }
    };

    const disposeOnCursorMove = termRef.current?.onCursorMove(() => {
      updateSuggestionBox();
      scheduleInputResync();
    });
    const disposeOnKey = termRef.current?.onKey(handleKey);
    const disposeBell = termRef.current?.onBell(() => play());
    const disposeTitle = termRef.current?.onTitleChange((title) => document.title = `Terminal: ${title}`);
    const el = terminalRef.current!;
    el.addEventListener("contextmenu", handleContextMenu);
    el.addEventListener("mousedown", handleRightMouseDown);
    el.addEventListener("mouseup", handleMouseUp);
    // App shortcuts on a window capture listener scoped to this terminal instance
    // (rootRef). Capture runs before xterm (so keys aren't swallowed) and lets us
    // preventDefault browser shortcuts like Ctrl+K; stopPropagation on a consumed
    // shortcut keeps it from also reaching the shell.
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement)) return;
      if (handleAppShortcut(e)) e.stopPropagation();
    };
    window.addEventListener('keydown', onWindowKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onWindowKeyDown, true);
      disposeOnCursorMove?.dispose?.();
      disposeOnKey?.dispose?.();
      disposeBell?.dispose?.();
      disposeTitle?.dispose?.();
      el.removeEventListener("contextmenu", handleContextMenu);
      el.removeEventListener("mousedown", handleRightMouseDown);
      el.removeEventListener("mouseup", handleMouseUp);
      if (inputResyncTimerRef.current) clearTimeout(inputResyncTimerRef.current);
      if (inputRafRef.current != null) cancelAnimationFrame(inputRafRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!command) return;
    const toAppend = getRemainingSuggestion(commandBufferRef.current, command);

    // Paste only — write text into terminal without executing
    termRef.current?.input(toAppend);
    pushInputStateRef.current({ forceVisible: false });
    setCommand("", "single");
    handleFocus();
  }, [command]);

  return (
    <div className="relative w-full h-full" ref={rootRef}>
      <div
        ref={terminalRef}
        id="terminal"
        style={{ width: "100%", height: "100%" }}

      />
      {showSearch && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <div
            className="absolute top-0 z-20 flex items-center gap-0.5 rounded-bl-md shadow-lg px-2 py-1 transition-[right] duration-300 ease-in-out"
            style={{
              right: isRightSidebarOpen && isAIChatOpen
                ? 'calc(25rem + 400px)'
                : isRightSidebarOpen
                  ? '25rem'
                  : isAIChatOpen
                    ? '26rem'
                    : '1rem',
              backgroundColor: t.background,
              border: `1px solid ${t.foreground}20`,
              borderTop: 'none',
            }}
          >
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-2 pointer-events-none"
                style={{ color: `${t.foreground}60` }}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Find"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.shiftKey) { handleSearchPrev(); }
                  else if (e.key === 'Enter') { handleSearchNext(); }
                  else if (e.key === 'Escape') {
                    searchAddonRef.current?.clearDecorations();
                    searchAddonRef.current?.clearActiveDecoration();
                    setShowSearch(false);
                  }
                }}
                className="pl-7 pr-2 py-[3px] text-xs rounded-sm w-52 outline-none focus:ring-1"
                style={{
                  backgroundColor: `${t.foreground}10`,
                  color: t.foreground,
                  border: `1px solid ${t.foreground}30`,
                  caretColor: ('cursor' in t ? t.cursor : t.foreground) as string,
                }}
                onFocus={(e) => (e.target.style.borderColor = (t as any).cyan ?? (t as any).blue ?? `${t.foreground}60`)}
                onBlur={(e) => (e.target.style.borderColor = `${t.foreground}30`)}
              />
            </div>

            <button
              onClick={handleSearchPrev}
              title="Previous Match (Shift+Enter)"
              className="p-1 rounded-sm transition-colors"
              style={{ color: `${t.foreground}cc` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${t.foreground}20`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronUp size={16} />
            </button>

            <button
              onClick={handleSearchNext}
              title="Next Match (Enter)"
              className="p-1 rounded-sm transition-colors"
              style={{ color: `${t.foreground}cc` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${t.foreground}20`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronDown size={16} />
            </button>

            <button
              onClick={() => {
                searchAddonRef.current?.clearDecorations();
                searchAddonRef.current?.clearActiveDecoration();
                setShowSearch(false);
              }}
              title="Close (Escape)"
              className="p-1 rounded-sm transition-colors ml-0.5"
              style={{ color: `${t.foreground}cc` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${t.foreground}20`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>
        );
      })()}

      {/* Suggestion box positioned relative to .xterm-helper-textarea */}

      {/* Ghost text inline autocomplete (grey overlay at cursor) */}
      {autocomplete && !isAltScreen && (
        <GhostTextBridge
          store={inputStoreRef.current!}
          termRef={termRef}
          containerRef={terminalRef}
          onAccept={handleGhostAccept}
        />
      )}

      {autocomplete && suggestionBox && (
        <SuggestionBoxBridge
          store={inputStoreRef.current!}
          terminalRef={terminalRef}
          setSuggestions={setSuggestions}
          hostKey={hostKey}
          sessionId={sessionId}
          onDismiss={dismissSuggestions}
        />
      )}

      {/* Inline argument/flag hint bar (docked bottom-left) */}
      {autocomplete && !isAltScreen && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <ArgHintBridge
            store={inputStoreRef.current!}
            commandIndex={commandIndex}
            bg={t.background}
            fg={t.foreground}
            accent={(t as any).green ?? (t as any).cyan ?? t.foreground}
            border={(t as any).brightBlack ?? `${t.foreground}22`}
            onInsert={handleArgInsert}
          />
        );
      })()}

      {/* AI Ghost text (from Ask AI sidebar input) */}
      {suggestionBox && (
        <AIGhostText
          termRef={termRef}
          containerRef={terminalRef}
          sessionId={sessionId}
          onAccept={handleAIGhostAccept}
        />
      )}

      {/* Inline AI command input (Ctrl+I) */}
      {showInlineAI && (
        <InlineCommandInput
          sessionId={sessionId}
          termRef={termRef}
          isRightSidebarOpen={isRightSidebarOpen}
          isAIChatOpen={isAIChatOpen}
          onClose={() => {
            setShowInlineAI(false);
            showInlineAIRef.current = false;
            termRef.current?.focus();
          }}
        />
      )}

      {/* Placeholder hint when shell is empty */}

      {/* Info overlay — shown once per host, self-managed */}
      <TerminalInfoOverlay hostKey={sessionHost ?? sessionId} />

      {/* Command blocks (Warp-style) — capture, copy, re-run, share */}
      {commandBlocksEnabled && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <CommandBlocks
            sessionId={sessionId}
            onRerun={handleBlockRerun}
            onFix={handleBlockFix}
            onApplyFix={handleAIGhostAccept}
            bg={t.background}
            fg={t.foreground}
            accent={(t as any).green ?? (t as any).cyan ?? t.foreground}
            border={(t as any).brightBlack ?? `${t.foreground}22`}
          />
        );
      })()}

      {/* Ctrl+K natural-language command palette */}
      {commandPaletteEnabled && showPalette && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <CommandPalette
            sessionId={sessionId}
            onInsert={handleAIGhostAccept}
            onRun={handleBlockRerun}
            onClose={() => { setShowPalette(false); termRef.current?.focus(); }}
            bg={t.background}
            fg={t.foreground}
            accent={(t as any).cyan ?? (t as any).green ?? t.foreground}
            border={(t as any).brightBlack ?? `${t.foreground}22`}
            error={(t as any).red ?? '#f43f5e'}
          />
        );
      })()}

      {/* Ctrl+Shift+E AI command explanation (pre-exec) */}
      {commandExplainEnabled && explainCommand !== null && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <CommandExplain
            sessionId={sessionId}
            command={explainCommand}
            onRun={handleBlockRerun}
            onClose={() => { setExplainCommand(null); termRef.current?.focus(); }}
            bg={t.background}
            fg={t.foreground}
            accent={t.cyan}
            border={`${t.foreground}22`}
            error={t.red}
          />
        );
      })()}

      {/* Ctrl+Shift+S share session (read-only spectator + collab links) */}
      {showShare && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <ShareSessionDialog
            sessionId={sessionId}
            onClose={() => { setShowShare(false); termRef.current?.focus(); }}
            bg={t.background}
            fg={t.foreground}
            accent={(t as any).cyan ?? (t as any).green ?? t.foreground}
            border={(t as any).brightBlack ?? `${t.foreground}22`}
          />
        );
      })()}

      {/* Collab typing indicator — shown when a joiner is typing */}
      {/* Collab typing indicator + placeholder — self-contained, no parent re-render */}
      <CollabTypingBridge
        store={inputStoreRef.current!}
        socket={socket}
        termRef={termRef}
        containerRef={terminalRef}
        placeholderDisabled={isAltScreen}
      />

      {/* Diagnostics AI chat modal */}
      {diagnosticsEnabled && showDiagChat && (
        <DiagnosticsChat
          entries={diagEntries}
          initialFilter={diagFilter}
          onClose={closeDiagChat}
          onClear={diagClear}
          sessionId={sessionId}
        />
      )}

      {/* Copy-on-select confirmation toast (center bottom) */}
      {showCopied && (() => {
        const t = XtermTheme[sessionTheme] || XtermTheme.default;
        return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border"
              style={{
                backgroundColor: `${t.background}f2`,
                color: t.foreground,
                borderColor: `${t.foreground}20`,
              }}
            >
              <Check className="h-3.5 w-3.5" style={{ color: t.green }} />
              Copied
            </div>
          </div>
        );
      })()}
    </div>
  );
});

export default XTerminal;
