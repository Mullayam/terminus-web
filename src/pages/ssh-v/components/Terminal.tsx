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
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [commandBuffer, setCommandBuffer] = useState<string>("");
  const { logs, addLogLine } = useTerminalStore();
  const { allCommands, recentCommands } = useCommandStore();
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { command, clickType, setCommand, addRecentCommand } = useCommandStore();

  const filteredSuggestions = useMemo(() => {

    if (commandBuffer == "") {
      return suggestions
    }
    return suggestions.filter((command) => command.includes(commandBuffer));
  }, [commandBuffer])
  function getSearchOptions(): ISearchOptions {
    return {
      regex: (document.getElementById("regex") as HTMLInputElement).checked,
      wholeWord: (document.getElementById("whole-word") as HTMLInputElement)
        .checked,
      caseSensitive: (
        document.getElementById("case-sensitive") as HTMLInputElement
      ).checked,
      decorations: (
        document.getElementById("highlight-all-matches") as HTMLInputElement
      ).checked
        ? {
          matchBackground: "#232422",
          matchBorder: "#555753",
          matchOverviewRuler: "#555753",
          activeMatchBackground: "#ef2929",
          activeMatchBorder: "#ffffff",
          activeMatchColorOverviewRuler: "#ef2929",
        }
        : undefined,
    };
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

    const searchAddon = new SearchAddon();
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

    new LigaturesAddon().activate(term);

    const session = sessions[sessionId];
    if (!session?.socket) {
      term.write("\x1b[32mConnecting...\r\n\x1b[0m");
    }

    term.onData((input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, input);
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
    const disposeBell = termRef.current?.onBell(() => {
      play();
    });

    const disposeTitle = termRef.current?.onTitleChange((title) => {
      document.title = `Terminal: ${title}`;
    });

    return () => {
      disposeOnCursorMove?.dispose?.();
      disposeOnKey?.dispose?.();
      disposeBell?.dispose?.();
      disposeTitle?.dispose?.();

    };
  }, [commandBuffer]);

  useEffect(() => {
    if (clickType === "single") {
      termRef.current?.input(command);
      setIsVisible(false);
      setCommand("", "single");
    } else {
      termRef.current?.input(`${command}\r`);
      setCommand("", "double");
    }
  }, [command]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={terminalRef}
        id="terminal"
        style={{ width: "100%", height: "100%" }}
      />

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
