/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
import TerminalPlaceholder from "./terminal2/terminal-placeholder";
import {
  useDiagnostics,
  TerminalInfoOverlay,
  DiagnosticsChat,
} from "./terminal2/diagnostics";
import useAudio from "@/hooks/useAudio";
import { XtermTheme, ThemeName } from "./themes";
import { getAllCommandData } from "@/lib/context-engine/contextEngineStorage";
import { useAIChatStore } from "@/store/aiChatStore";


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
  const isRendered = useRef(false);
  const sessionHost = useSSHStore((s) => s.sessions[sessionId]?.host);
  const autocomplete = useTabStore((s) => s.settings.autocomplete);
  const diagnosticsEnabled = useTabStore((s) => s.settings.diagnostics);
  const sessionTheme = useSSHStore((s) => s.sessionThemes[sessionId]) || 'custom';
  const { fontSize = 15, fontWeight = '400', fontWeightBold = '700' } = useSSHStore((s) => s.sessionFonts[sessionId]) || {};

  // ── Diagnostics (error/warning detection) ──
  const { entries: diagEntries, counts: diagCounts, feed: diagFeed, clear: diagClear } = useDiagnostics();
  const setSessionDiagnostics = useDiagnosticsStore((s) => s.setSessionDiagnostics);
  const showDiagChat = useDiagnosticsStore((s) => s.showDiagChat);
  const diagFilter = useDiagnosticsStore((s) => s.diagFilter);
  const closeDiagChat = useDiagnosticsStore((s) => s.closeDiagChat);
  const [showInfoOverlay, setShowInfoOverlay] = useState(true);

  // ── AI Chat: capture terminal selection ──
  const setTerminalSelection = useAIChatStore((s) => s.setTerminalSelection);
  const toggleAIChat = useAIChatStore((s) => s.toggle);

  // Derive localStorage key from the session host/IP
  const hostKey = useMemo(() => {
    return `terminus-suggestions:${sessionHost ?? sessionId}`;
  }, [sessionId, sessionHost]);

  const termRef = useRef<Terminal | null>(null);
  const { logs, addLogLine } = useTerminalStore();
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const { allCommands } = useCommandStore();
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [suggestions, setSuggestions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`terminus-suggestions:${sessionHost ?? sessionId}`);
      return raw ? Array.from(JSON.parse(raw)) : [];
    } catch { return []; }
  });
  /** Extra ghost-text sources (store commands + context-engine packs). Not persisted to history. */
  const ghostSourcesRef = useRef<string[]>([]);
  const [commandBuffer, setCommandBuffer] = useState<string>("");
  const { command, clickType, setCommand, addShellHistoryCommand, addShellHistoryBatch } = useCommandStore();
  const shellHistoryHost = sessionHost ?? sessionId;

  /* ── Ghost text: accept the inline autocomplete suggestion ── */
  const handleGhostAccept = useCallback((fullCommand: string) => {
    // Type the remaining characters into the terminal
    const remaining = fullCommand.slice(commandBuffer.length);
    if (remaining && termRef.current) {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, remaining);
      setCommandBuffer(fullCommand);
      setIsVisible(false);
    }
  }, [commandBuffer, socket]);

  /* ── AI Ghost text: accept the AI-suggested command ── */
  const handleAIGhostAccept = useCallback((cmd: string) => {
    if (cmd) {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd);
    }
  }, [socket]);

  let lastPromptPrefix = '';

  const filteredSuggestions = useMemo(() => {
    const all = [...suggestions, ...ghostSourcesRef.current];
    if (commandBuffer === "") return all;
    return all.filter((command) => command.includes(commandBuffer));
  }, [commandBuffer, suggestions])


  const handleSearchNext = () => {
    const query = searchInputRef.current?.value || '';
    searchAddonRef.current?.findNext(query, {
      decorations: getSearchOptions()
    });
  };

  const handleSearchPrev = () => {
    const query = searchInputRef.current?.value || '';
    searchAddonRef.current?.findPrevious(query, {
      decorations: getSearchOptions()

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
        lastPromptPrefix = match[1];

      }
    }

  }
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      toggleAIChat();
    } else if (e.key === 'Escape') {
      searchAddonRef.current?.clearDecorations();
      searchAddonRef.current?.clearActiveDecoration();
      setShowSearch(false);
    }
  };
  function getCurrentCommandInput() {
    const buffer = termRef.current?.buffer.active;
    if (buffer) {
      const line = buffer.getLine(buffer.cursorY);
      const lineText = line?.translateToString(true) ?? '';
      if (lineText.startsWith(lastPromptPrefix)) {
        return lineText.slice(lastPromptPrefix.length);
      }
      return lineText;
    }
    return '';
  }
  const handleContextMenu = async (e: MouseEvent) => {
    e.preventDefault();

    const selection = termRef.current?.getSelection()?.trim();

    if (selection) {

      await navigator.clipboard.writeText(selection);
      termRef.current?.clearSelection();
      termRef.current?.input(selection);

    } else {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          termRef.current?.paste(text);

        }
      } catch (err) {


      }
    }
  };


  function getSearchOptions(): ISearchOptions["decorations"] {
    return {
      matchBackground: "#FFA50080",         // semi-transparent orange
      matchBorder: "#FFA500",               // solid orange border
      matchOverviewRuler: "#FFA500",        // ruler stripe
      activeMatchBackground: "#FF8C00",     // darker orange
      activeMatchBorder: "#FFFFFF",         // white border for active
      activeMatchColorOverviewRuler: "#FF8C00",
    }
  }
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
    term.loadAddon(new WebglAddon());
    term.loadAddon(new ImageAddon());
    term.loadAddon(new SerializeAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new CanvasAddon());
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

    if (!sessionHost) {
      term.write("\x1b[32mConnecting...\r\n\x1b[0m");
    }

    term.onData((input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, input);
      if (input === '\r') {
        capturePrompt();
      }
    });

    term.onResize((size) => {
      socket.emit(SocketEventConstants.SSH_EMIT_RESIZE, size);
    });


    const t = logs[sessionId];
    if (t?.length) {
      term.write(t.join(""));
    }
    const handleResize = () => {
      fitAddon.fit();
    };

    socket.on(SocketEventConstants.SSH_EMIT_DATA, (input: string) => {
      term.write(input);
      term.scrollToBottom();
      addLogLine(sessionId, input);
      // Feed output to diagnostics scanner (only if enabled)
      diagFeed(input);
    });

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
        return added ? Array.from(set) : prev;
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
      }
    }).catch(() => {});
    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off(SocketEventConstants.SSH_EMIT_DATA);
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_RESULT);
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
      if (domEvent.ctrlKey && domEvent.key === 'f') {
        domEvent.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }


      if (domEvent.key === 'Escape') {
        searchAddonRef.current?.clearDecorations();
        searchAddonRef.current?.clearActiveDecoration();
        setShowSearch(false);
      }

      if (domEvent.ctrlKey && domEvent.code === "Space") {
        domEvent.preventDefault();
        setIsVisible(true)
      }

      // Ctrl+C / Ctrl+D / Ctrl+Z → interrupt / EOF / suspend → clear buffer
      if (domEvent.ctrlKey && (domEvent.key === 'c' || domEvent.key === 'd' || domEvent.key === 'z')) {
        setCommandBuffer("");
        setIsVisible(false);
        return;
      }

      if (isEnter) {
        const trimmed = commandBuffer.trim();
        if (trimmed.length > 0) {
          setSuggestions(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
          addShellHistoryCommand(shellHistoryHost, trimmed);
        }
        setCommandBuffer("");
        setIsVisible(false);
        return;
      }

      if (isBackspace) {
        const updated = commandBuffer.slice(0, -1);
        setCommandBuffer(updated);
        setIsVisible(
          updated.trim() !== "" &&
          suggestions.some((cmd) => cmd.includes(updated))
        );
        return;
      }

      if (isPrintable) {
        const updated = commandBuffer + key;
        setCommandBuffer(updated);
        setIsVisible(
          updated.trim() !== "" &&
          suggestions.some((cmd) => cmd.includes(updated))
        );
      }
    };

    const disposeOnCursorMove = termRef.current?.onCursorMove(updateSuggestionBox);
    const disposeOnKey = termRef.current?.onKey(handleKey);
    const disposeBell = termRef.current?.onBell(() => play());
    const disposeTitle = termRef.current?.onTitleChange((title) => document.title = `Terminal: ${title}`);
    const el = terminalRef.current!;
    el.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      disposeOnCursorMove?.dispose?.();
      disposeOnKey?.dispose?.();
      disposeBell?.dispose?.();
      disposeTitle?.dispose?.();
      window.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener("contextmenu", handleContextMenu);

    };
  }, [commandBuffer]);

  useEffect(() => {
    const toAppend = getRemainingSuggestion(commandBuffer, command);

    if (clickType === "single") {
      termRef.current?.input(toAppend);
      setIsVisible(false);
      setCommand("", "single");
    } else {
      termRef.current?.input(`${toAppend}\r`);
      setCommand("", "double");
    }
    handleFocus();
  }, [command]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={terminalRef}
        id="terminal"
        style={{ width: "100%", height: "100%" }}

      />
      {showSearch && (
        <div className="absolute top-2 right-2 bg-[#181818] shadow-md border border-gray-700 rounded px-2 py-1 flex items-center gap-2 z-10">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."

            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchNext();
              if (e.key === 'Escape') setShowSearch(false);
            }}
            className="px-2 py-1 border bg-[#181818] text-green-400 border-gray-600 rounded w-48"
          />
          <button
            onClick={handleSearchNext}
            className="text-sm bg-blue-600 text-green-400 px-2 py-1 rounded"
          >
            Find
          </button>
          <button
            onClick={handleSearchPrev}
            className="text-sm bg-blue-600 text-green-400 px-2 py-1 rounded"
          >
            Prev
          </button>
        </div>
      )}

      {/* Suggestion box positioned relative to .xterm-helper-textarea */}

      {/* Ghost text inline autocomplete (grey overlay at cursor) */}
      {autocomplete && (
        <GhostText
          termRef={termRef}
          commandBuffer={commandBuffer}
          suggestions={filteredSuggestions}
          onAccept={handleGhostAccept}
          containerRef={terminalRef}
        />
      )}

      {autocomplete && (
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
      <AIGhostText
        termRef={termRef}
        containerRef={terminalRef}
        sessionId={sessionId}
        onAccept={handleAIGhostAccept}
      />

      {/* Placeholder hint when shell is empty */}
      <TerminalPlaceholder
        termRef={termRef}
        commandBuffer={commandBuffer}
        containerRef={terminalRef}
        hint="💡 Like this project? Press ⭐ on GitHub to support it github.com/Mullayam"
      />

      {/* Info overlay — shown once on connect */}
      {showInfoOverlay && (
        <TerminalInfoOverlay onDismiss={() => setShowInfoOverlay(false)} />
      )}

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
    </div>
  );
});

export default XTerminal;
