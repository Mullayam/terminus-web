/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
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
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useNavigate } from "react-router-dom";
import { useCommandStore, useStore } from "@/store";
import { sound } from "@/lib/utils";
import { io, Socket } from "socket.io-client";
import { useTerminalStore } from '@/store/terminalStore';
import { useSSHStore } from '../../../store/sshStore';

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
  const { logs, addLogLine } = useTerminalStore()
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRendered = useRef(false);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { sessions } = useSSHStore()

  const { command, clickType, setCommand } = useCommandStore();
  const defaultBellSound = new Audio(sound);

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

  useEffect(() => {
    if (isRendered.current) return;
    if (!terminalRef.current) return;

    isRendered.current = true;
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


    const searchAddon = new SearchAddon();
    term.loadAddon(new WebglAddon());
    term.loadAddon(new ImageAddon());
    term.loadAddon(new SerializeAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new CanvasAddon());
    term.loadAddon(new ClipboardAddon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.open(terminalRef.current);

    fitAddonRef.current = fitAddon;
    fitAddon.fit();

    new LigaturesAddon().activate(term);
    const session = sessions[sessionId]
    if (!session?.socket) {
      term.write("\x1b[32mConnecting...\r\n\x1b[0m");
    }

    term.onData(async (input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, input);
    });
    term.onKey(() => {
      defaultBellSound.play();
    });
    term.onResize((size) => {
      socket.emit(SocketEventConstants.SSH_EMIT_RESIZE, size);
    });
    socket.on(SocketEventConstants.SSH_EMIT_DATA, (input: string) => {
      term.write(input);
      addLogLine(sessionId, input);

      term.scrollToBottom();
    });
    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener("resize", handleResize);
    const originalWrite = term.write.bind(term);


    if (session) {
      const t = logs[sessionId]
      t && t.length && term.write(t.join(""));

    }
    return () => {
      socket.off(SocketEventConstants.SSH_EMIT_DATA);
      window.removeEventListener("resize", handleResize);
      termRef.current?.dispose();
    };

  }, [socket, sessionId]);

  useEffect(() => {
    if (clickType) {
      termRef.current?.input(command);
      setCommand("", "single");
    }
  }, [clickType]);

  return (
    <div
      ref={terminalRef}
      id="terminal"
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default XTerminal;
