import "@xterm/xterm/css/xterm.css";
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
// import { useSockets } from '@/hooks/use-sockets';
// import { SOCKET_TERMINAL_EVENTS } from '@/lib/sockets/socket-constants';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ImageAddon } from '@xterm/addon-image';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { socket } from "@/lib/sockets";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

const XTerminal = () => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRendered = useRef(false); 
  useEffect(() => {
    if (isRendered.current) return;
    if (!terminalRef.current) return;

    isRendered.current = true;
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      fontSize: 14,
      cursorWidth: 1,
      rows: 40,
      cols: 100,
      fontFamily: 'monospace',
      theme: {
        background: "#181818",
        cursor: "#f1fa8c",
      },
    });
    termRef.current = term;
    const fitAddon = new FitAddon();
    term.loadAddon(new WebglAddon());
    term.loadAddon(new ImageAddon());
    term.loadAddon(new SearchAddon());
    term.loadAddon(new SerializeAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(fitAddon);
    fitAddon.fit();
    term.open(terminalRef.current);
    term.write('Hi User, Welcome to the Web Terminal!');


    term.onData(async (input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, input);
    });

    socket.on(SocketEventConstants.SSH_EMIT_DATA, (data: string) => {
      term.write(data);
      term.scrollToBottom();
    });

  }, [socket]);
  return (
    <React.Fragment>      
      <div ref={terminalRef} id="terminal" style={{ position: 'relative' }} className='w-full h-full' />     
    </React.Fragment>
  )
}

export default XTerminal