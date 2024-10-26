/* eslint-disable react-hooks/exhaustive-deps */
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { useSockets } from '@/hooks/use-sockets';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ImageAddon } from '@xterm/addon-image';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SocketEventConstants } from '@/lib/sockets/event-constants';

const XTerminal = ({ backgroundColor = '#181818' }: { backgroundColor?: string }) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRendered = useRef(false);
  const { socket } = useSockets();
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
      cols: 200,
      fontFamily: 'monospace',
      theme: {
        background: backgroundColor,
        cursor: '#f1fa8c',
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
  return <div ref={terminalRef} id="terminal" style={{ position: 'relative' }} className="w-full h-full" />;
};

export default XTerminal;

// import React, { useEffect, useRef, useState } from 'react';
// import { Terminal } from 'xterm';
// import 'xterm/css/xterm.css';

// const TerminalComponent = () => {
//   const terminalRef = useRef(null);
//   const xterm = useRef(null);
//   const [savedData, setSavedData] = useState(localStorage.getItem("terminalData") || "");

//   useEffect(() => {
//     xterm.current = new Terminal();
//     xterm.current.open(terminalRef.current);

//     // Restore saved state
//     if (savedData) {
//       xterm.current.write(savedData);
//     }

//     // Save terminal state when leaving the component
//     return () => {
//       localStorage.setItem("terminalData", xterm.current.buffer.active.translateToString());
//     };
//   }, [savedData]);

//   return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
// };

// export default TerminalComponent;
