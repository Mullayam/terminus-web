/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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

const SEARCH_DECORATIONS: ISearchOptions["decorations"] = {
  matchBackground: "#FFA50080",
  matchBorder: "#FFA500",
  matchOverviewRuler: "#FFA500",
  activeMatchBackground: "#FF8C00",
  activeMatchBorder: "#FFFFFF",
  activeMatchColorOverviewRuler: "#FF8C00",
};

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
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);
  useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);
  const [showSearch, setShowSearch] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInlineAI, setShowInlineAI] = useState(false);
  const showInlineAIRef = useRef(false);
  useEffect(() => { showInlineAIRef.current = showInlineAI; }, [showInlineAI]);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const allCommands = useCommandStore((s) => s.allCommands);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [suggestions, setSuggestions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`terminus-suggestions:${sessionHost ?? sessionId}`);
      return raw ? Array.from(JSON.parse(raw)) : [];
    } catch { return []; }
  });
  /** Extra ghost-text sources (store commands + context-engine packs). Not persisted to history. */
  const ghostSourcesRef = useRef<string[]>([]);
  const [ghostSourcesVersion, setGhostSourcesVersion] = useState(0);
  const suggestionsRef = useRef(suggestions);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  const diagnosticsEnabledRef = useRef(diagnosticsEnabled);
  useEffect(() => { diagnosticsEnabledRef.current = diagnosticsEnabled; }, [diagnosticsEnabled]);
  const [commandBuffer, setCommandBuffer] = useState<string>("");
  const commandBufferRef = useRef<string>("");
  const [isAltScreen, setIsAltScreen] = useState(false);
  const inputResyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyAtRef = useRef(0);
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
      setCommandBuffer(fullCommand);
      setIsVisible(false);
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
      setCommandBuffer(cmd);
      setIsVisible(false);
    }
  }, [socket]);

  const lastPromptPrefixRef = useRef('');

  const filteredSuggestions = useMemo(() => {
    const all = [...suggestions, ...ghostSourcesRef.current];
    if (commandBuffer === "") return all;
    return all.filter((command) => command.includes(commandBuffer));
  }, [commandBuffer, suggestions, ghostSourcesVersion])


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
      setCommandBuffer(input);
    }, 60);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      const next = !showInlineAIRef.current;
      showInlineAIRef.current = next;
      setShowInlineAI(next);
    } else if (e.key === 'Escape') {
      searchAddonRef.current?.clearDecorations();
      searchAddonRef.current?.clearActiveDecoration();
      setShowSearch(false);
    }
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

  // Right-click pastes whatever is on the clipboard.
  const handleContextMenu = async (e: MouseEvent) => {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        termRef.current?.paste(text);
      }
    } catch (err) {
      // clipboard read can be blocked; ignore
    }
  };

  const updateSuggestionBox = () => {
    const textarea = terminalRef.current?.querySelector(
      ".xterm-helper-textarea"
    ) as HTMLTextAreaElement | null;
    const terminalRect = terminalRef.current?.getBoundingClientRect();

    if (textarea && terminalRect) {
      const left = parseFloat(textarea.style.left);
      const top = parseFloat(textarea.style.top);

      setSuggestionPos({
        left: left,
        top: top + 20,
      });
    }
  };
  const handleFocus = () => {
    termRef.current?.focus();
  };
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

    // Block arrow keys from reaching xterm while suggestion box is open
    term.attachCustomKeyEventHandler((e) => {
      if (isVisibleRef.current && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        return false; // prevent xterm from sending escape sequences to shell
      }
      return true;
    });

    // Track alternate-screen switches (vim/htop/less/tmux) so the empty-line
    // placeholder and ghost text stay hidden inside full-screen apps.
    setIsAltScreen(term.buffer.active.type === 'alternate');
    const disposeBufferChange = term.buffer.onBufferChange(() => {
      setIsAltScreen(term.buffer.active.type === 'alternate');
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
        return arr.length > 500 ? arr.slice(-500) : arr;
      });
    });

    window.addEventListener("resize", handleResize);


    // Load store commands + context-engine data into ghost-text sources (NOT history)
    const storeCmds = allCommands.map((c) => c.command.toLocaleLowerCase());
    ghostSourcesRef.current = Array.from(new Set(storeCmds));

    getAllCommandData().then((cmdRecords) => {
      const cmds: string[] = [];
      for (const item of cmdRecords) {
        const data = item.data as any;
        if (data?.name) cmds.push(data.name);
        if (Array.isArray(data?.subcommands)) {
          for (const sub of data.subcommands) {
            if (sub?.name && data?.name) {
              cmds.push(`${data.name} ${sub.name}`);
            }
            if (Array.isArray(sub?.options) && data?.name && sub?.name) {
              for (const opt of sub.options) {
                if (opt?.name) cmds.push(`${data.name} ${sub.name} ${opt.name}`);
              }
            }
            if (Array.isArray(sub?.examples)) {
              for (const ex of sub.examples) {
                if (typeof ex === "string") cmds.push(ex);
              }
            }
          }
        }
      }
      if (cmds.length > 0) {
        ghostSourcesRef.current = Array.from(new Set([...ghostSourcesRef.current, ...cmds]));
        setGhostSourcesVersion(v => v + 1);
      }
    }).catch(() => { });

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off(SocketEventConstants.SSH_EMIT_DATA, handleSSHData);
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_RESULT);
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
        setIsVisible(true)
      }

      // Ctrl+C / Ctrl+D / Ctrl+Z → interrupt / EOF / suspend → clear buffer
      if (domEvent.ctrlKey && (domEvent.key === 'c' || domEvent.key === 'd' || domEvent.key === 'z')) {
        commandBufferRef.current = "";
        setCommandBuffer("");
        setIsVisible(false);
        return;
      }

      if (isEnter) {
        const trimmed = commandBufferRef.current.trim();
        if (trimmed.length > 0) {
          setSuggestions(prev => {
            if (prev.includes(trimmed)) return prev;
            const next = [...prev, trimmed];
            return next.length > 500 ? next.slice(-500) : next;
          });
          addShellHistoryCommand(shellHistoryHost, trimmed);
        }
        commandBufferRef.current = "";
        setCommandBuffer("");
        setIsVisible(false);
        return;
      }

      if (isBackspace) {
        lastKeyAtRef.current = Date.now();
        const updated = commandBufferRef.current.slice(0, -1);
        commandBufferRef.current = updated;
        setCommandBuffer(updated);
        setIsVisible(
          updated.trim() !== "" &&
          suggestionsRef.current.some((cmd) => cmd.includes(updated))
        );
        return;
      }

      if (isPrintable) {
        lastKeyAtRef.current = Date.now();
        const updated = commandBufferRef.current + key;
        commandBufferRef.current = updated;
        setCommandBuffer(updated);
        setIsVisible(
          updated.trim() !== "" &&
          suggestionsRef.current.some((cmd) => cmd.includes(updated))
        );
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
    el.addEventListener("mouseup", handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      disposeOnCursorMove?.dispose?.();
      disposeOnKey?.dispose?.();
      disposeBell?.dispose?.();
      disposeTitle?.dispose?.();
      window.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener("contextmenu", handleContextMenu);
      el.removeEventListener("mouseup", handleMouseUp);
      if (inputResyncTimerRef.current) clearTimeout(inputResyncTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!command) return;
    const toAppend = getRemainingSuggestion(commandBufferRef.current, command);

    // Paste only — write text into terminal without executing
    termRef.current?.input(toAppend);
    setIsVisible(false);
    setCommand("", "single");
    handleFocus();
  }, [command]);

  return (
    <div className="relative w-full h-full">
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
        <GhostText
          termRef={termRef}
          commandBuffer={commandBuffer}
          suggestions={filteredSuggestions}
          onAccept={handleGhostAccept}
          containerRef={terminalRef}
        />
      )}

      {autocomplete && suggestionBox && (
        <AISuggestionBox
          suggestionPos={suggestionPos}
          isVisible={isVisible}
          suggestions={filteredSuggestions}
          terminalHeight={terminalRef.current?.offsetHeight || 600}
          terminalWidth={terminalRef.current?.offsetWidth || 800}
          setSuggestions={setSuggestions}
          hostKey={hostKey}
          commandBuffer={commandBuffer}
          sessionId={sessionId}
        />
      )}

      {/* AI Ghost text (from Ask AI sidebar input) */}
      {suggestionBox && (
        <AIGhostText
          termRef={termRef}
          containerRef={terminalRef}
          sessionId={sessionId}
          onAccept={handleAIGhostAccept}
        />
      )}

      {/* Inline AI command input (Ctrl+Shift+I) */}
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

      {/* Collab typing indicator — shown when a joiner is typing */}
      {/* Collab typing indicator + placeholder — self-contained, no parent re-render */}
      <CollabTypingIndicator
        socket={socket}
        termRef={termRef}
        commandBuffer={commandBuffer}
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
