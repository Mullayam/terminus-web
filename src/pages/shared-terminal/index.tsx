/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import React, { useEffect, useRef } from "react";
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

import { useCommandStore, } from "@/store";
import { sound } from "@/lib/utils";

import { useSockets } from '../../hooks/use-sockets';
import { useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { AlertCircleIcon, RefreshCcw } from "lucide-react";
import InfoBadge from "../ssh-v/components/InfoBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


// https://github.com/xtermjs/xterm.js/blob/master/demo/client.ts
const XTerminal = () => {

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);

  const fitAddonRef = useRef<FitAddon | null>(null);
  const { socket } = useSockets()
  const { sessionid } = useParams();

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

    if (!terminalRef.current || !sessionid) return;
    socket.emit(SocketEventConstants.CreateTerminal, sessionid)
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      cursorWidth: 1,
      rows: 40,
      cols: 150,
      fontFamily: "monospace",
      theme: {
        background: "#181818",
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



    term.onData((input) => {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to run this command",
        variant: "destructive",

      })
      // socket.emit(SocketEventConstants.terminal_input, input);
    });

    // term.onKey(() => {
    //   // defaultBellSound.play();
    // });



    const handleResize = () => {
      fitAddon.fit();
    };

    socket.on(SocketEventConstants.terminal_output, (input: string) => {

      term.write(input);
      term.scrollToBottom();
    });

    window.addEventListener("resize", handleResize);
    requestAnimationFrame(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });

    socket.on(SocketEventConstants.session_not_found, (input: string) => {
      term.write(`\x1b[31m${input}\r\n\x1b[0m`);
      toast({
        title: "Session Not Found",
        description: "The session you are looking for is not found",
        variant: "destructive",
      })

    })


    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off(SocketEventConstants.terminal_output);
      socket.off(SocketEventConstants.session_not_found);
      term.dispose();
      termRef.current = null;
    };
  }, [sessionid]);


  return (
    <React.Fragment>
      <div
        ref={terminalRef}
        id="terminal"
        style={{ width: "100%", height: "100%", border: "1px solid #333" }}
      />
      <div className="flex justify-between items-start flex-wrap px-4 py-1 border-t text-xs bg-[#1a1b26]">
        <div className="flex flex-row  gap-4">
          <span
            onClick={() => socket.disconnect()}
            className="text-gray-200 cursor-pointer bg-red-600  px-2 rounded"

          >Terminate Session</span>
        </div>
        <div className="flex flex-row gap-4">
          <div>

          </div>
          <div>
            Active Session: {sessionid}
          </div>
        </div>
        <div className=" text-gray-200 text-xs text-right flex flex-row gap-4">
          {!socket?.connected && <RefreshCcw className='w-4 h-4 animate-spin' />}
          <InfoBadge status={socket.connected ? "connected" : 'disconnected'} />
        </div>
      </div>

    </React.Fragment>

  );
};

export default XTerminal;
