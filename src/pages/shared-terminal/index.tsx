/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import "@xterm/xterm/css/xterm.css";
import React, { useEffect, useRef, useState } from "react";
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


import { useSockets } from '@/hooks/use-sockets';
import { useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { RefreshCcw } from "lucide-react";
import InfoBadge from "../ssh-v/components/InfoBadge";
import { useTerminalStore } from "@/store/terminalStore";



// https://github.com/xtermjs/xterm.js/blob/master/demo/client.ts
const XTerminal = () => {

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const [permissions, setPermissions] = useState("400");
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { socket } = useSockets()
  const { sessionid } = useParams();
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const { addLogLine, logs } = useTerminalStore()
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
  function getSearchOptions(): ISearchOptions['decorations'] {
    return {
      matchBackground: "#FFA50080",         // semi-transparent orange
      matchBorder: "#FFA500",               // solid orange border
      matchOverviewRuler: "#FFA500",        // ruler stripe
      activeMatchBackground: "#FF8C00",     // darker orange
      activeMatchBorder: "#FFFFFF",         // white border for active
      activeMatchColorOverviewRuler: "#FF8C00",
    }
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

    const t = logs[sessionid];
    if (t?.length) {
      term.write(t.join(""));
    }

    term.onData((input) => {
      if (permissions === "400") {
        return toast({
          title: "Permission Denied",
          description: "You don't have permission to run this command",
          variant: "destructive",
        })
      }

      socket.emit(SocketEventConstants.terminal_input, input);
    });




    const handleResize = () => {
      fitAddon.fit();
    };

    socket.on(SocketEventConstants.terminal_output, (input: string) => {
      term.write(input);
      term.scrollToBottom();
      addLogLine(sessionid, input);
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
    socket.on(SocketEventConstants.session_info, (input: string) => {
      term.write(`\x1b[31m${input}\r\n\x1b[0m`);
      toast({
        title: "Session Info",
        description: input,
        variant: "destructive",
      })
    })
    socket.on(SocketEventConstants.SSH_DISCONNECTED, (input: string) => {
      term.write(`\x1b[31m${input}\r\n\x1b[0m`);
      toast({
        title: "Session Disconnected",
        description: input,
        variant: "destructive",
      })
    })
    socket.on(SocketEventConstants.SESSIONN_END, (input: string) => {
      term.write(`\x1b[31m${input}\r\n\x1b[0m`);
      toast({
        title: "Session Terminated",
        description: input,
        variant: "destructive",
      })
    })
    socket?.on(SocketEventConstants.SSH_PERMISSIONS, (input: string) => {
      const data = JSON.parse(input) as {
        socketId: string,
        permissions: string,
        sessionId: string
      };
      setPermissions(data.permissions)
      if (data.permissions === "777") {

        return toast({ title: "Permissions updated successfully", description: "You have full access to the terminal" })
      }
      toast({ title: "Permissions updated successfully", description: "You  can't write to the terminal" })
    })
    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off(SocketEventConstants.terminal_output);
      socket.off(SocketEventConstants.session_not_found);
      socket.off(SocketEventConstants.session_info);
      socket.off(SocketEventConstants.SESSIONN_END);
      socket.off(SocketEventConstants.SSH_DISCONNECTED);
      socket.off(SocketEventConstants.SSH_PERMISSIONS);
      term.dispose();
      termRef.current = null;
    };
  }, [sessionid]);
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

    };


    const disposeOnKey = termRef.current?.onKey(handleKey);

    return () => {
      disposeOnKey?.dispose();
    };

  }, [])

  return (
    <React.Fragment>
      <div
        ref={terminalRef}
        id="terminal"
        style={{ width: "100%", height: "100%", border: "1px solid #333" }}
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
