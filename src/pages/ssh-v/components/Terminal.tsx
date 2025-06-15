/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import { useEffect, useMemo, useRef, useState } from "react";
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
import AISuggestionBox from "./terminal2/suggestion-box";
import useAudio from "@/hooks/useAudio";
import { get } from "http";

// https://github.com/xtermjs/xterm.js/blob/master/demo/client.ts
const XTerminal = ({
  socket,
  sessionId,
  backgroundColor = "#181818",
}: {
  socket: Socket;
  sessionId: string;
  backgroundColor?: string;
}) => {
  const { play } = useAudio(sound)
  const isRendered = useRef(false);
  const { sessions } = useSSHStore();

  const termRef = useRef<Terminal | null>(null);
  const { logs, addLogLine } = useTerminalStore();
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const { allCommands, recentCommands } = useCommandStore();
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [commandBuffer, setCommandBuffer] = useState<string>("");
  const { command, clickType, setCommand, addRecentCommand } = useCommandStore();

  let lastPromptPrefix = '';

  const filteredSuggestions = useMemo(() => {

    if (commandBuffer == "") {
      return suggestions
    }
    return suggestions.filter((command) => command.includes(commandBuffer));
  }, [commandBuffer])


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
        console.log('Detected prompt:', lastPromptPrefix);
      }
    }

  }
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
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
      rows: 40,
      cols: 150,
      fontFamily: "monospace",
      theme: {
        background: backgroundColor,
        cursor: "#f1fa8c",
      },
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
    searchAddonRef.current = searchAddon;

    new LigaturesAddon().activate(term);

    const session = sessions[sessionId];
    if (!session?.socket) {
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
    });

    window.addEventListener("resize", handleResize);
    // requestAnimationFrame(() => {
    //   if (fitAddonRef.current) {
    //     fitAddonRef.current.fit();
    //   }
    // });

    setSuggestions(
      Array.from(new Set(allCommands
        .map((c) => c.command.toLocaleLowerCase())
        .concat(recentCommands)))
    );
    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off(SocketEventConstants.SSH_EMIT_DATA);
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, socket]);

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
      if (isEnter) {
        const trimmed = commandBuffer.trim();
        if (trimmed.length > 0) {

          setSuggestions(prev => [...prev, trimmed])
          addRecentCommand(trimmed);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      disposeOnCursorMove?.dispose?.();
      disposeOnKey?.dispose?.();
      disposeBell?.dispose?.();
      disposeTitle?.dispose?.();
      window.removeEventListener('keydown', handleKeyDown);

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
        <div className="absolute top-2 right-2 bg-[#181818] shadow-md border border-none rounded px-2 py-1 flex items-center gap-2 z-10">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."

            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchNext();
              if (e.key === 'Escape') setShowSearch(false);
            }}
            className="px-2 py-1 border bg-[#181818] text-green-400 border-gray-300 rounded w-48"
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

      <AISuggestionBox
        suggestionPos={suggestionPos}
        isVisible={isVisible}
        suggestions={filteredSuggestions}
        terminalHeight={terminalRef.current?.offsetHeight || 600}
        terminalWidth={terminalRef.current?.offsetWidth || 800}
        setSuggestions={setSuggestions}
      />
    </div>
  );
};

export default XTerminal;
