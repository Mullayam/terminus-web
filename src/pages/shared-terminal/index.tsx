import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ImageAddon } from '@xterm/addon-image';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { useSockets } from '@/hooks/use-sockets';
import { useParams } from 'react-router-dom';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { sound } from '@/lib/utils';

 const TerminalComponent: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const { sessionid } = useParams<{ sessionid: string }>();
  const [permissions, setPermissions] = useState<{ read: boolean, write: boolean }>({ read: false, write: false });
  const { socket } = useSockets();
  useEffect(() => {
    socket.emit(SocketEventConstants.join_terminal, sessionid);
    if (!terminal.current) {

      terminal.current = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
        fontSize: 14,
        cursorWidth: 1,
        rows: 40,
        cols: 150,
        fontFamily: 'monospace',
        theme: {
          background: '#1a1b26',
          cursor: '#f1fa8c',
        },
      });
      fitAddon.current = new FitAddon();
      terminal.current.loadAddon(fitAddon.current);
      terminal.current.loadAddon(new WebglAddon());
      terminal.current.loadAddon(new ImageAddon());
      terminal.current.loadAddon(new SearchAddon());
      terminal.current.loadAddon(new SerializeAddon());
      terminal.current.loadAddon(new Unicode11Addon());
      terminal.current.loadAddon(new WebLinksAddon());
      if (terminalRef.current) {
        terminal.current.open(terminalRef.current);
        fitAddon.current.fit();
      }  

      socket.on(SocketEventConstants.SSH_EMIT_DATA, (data: string) => {
       
        terminal.current?.write(data);
      });
      socket.on('updatedPermissions', (newPermissions) => {
        setPermissions(newPermissions);
      });
      terminal.current.onData((input) => {
        if (permissions && permissions.write) {
          socket.emit(SocketEventConstants.terminal_input, input);          
        }
      });
    }
  
    socket.on(SocketEventConstants.terminal_output, (data: string) => { 
      terminal.current?.write(data);
    });
    return () => {
      socket.disconnect();
      terminal.current?.dispose();
    };
  }, [sessionid, socket,permissions]);
 
  return <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />;
};

export default TerminalComponent;