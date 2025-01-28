/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { useSockets } from '@/hooks/use-sockets';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ImageAddon } from '@xterm/addon-image';
import { CanvasAddon } from '@xterm/addon-canvas';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { LigaturesAddon } from '@xterm/addon-ligatures';
import { ISearchOptions, SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { useNavigate } from 'react-router-dom';
import { useCommandStore, useStore } from '@/store';
import { sound } from '@/lib/utils';

// https://github.com/xtermjs/xterm.js/blob/master/demo/client.ts
const XTerminal = ({ backgroundColor = '#181818' }: { backgroundColor?: string }) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRendered = useRef(false);
  const { socket } = useSockets();
  const navigate = useNavigate()
  const fitAddon = new FitAddon();
  const { command, clickType,setCommand } = useCommandStore()
  const { tabs, activeTab } = useStore();
  const defaultBellSound = new Audio(sound);
  function getSearchOptions(): ISearchOptions {
    return {
      regex: (document.getElementById('regex') as HTMLInputElement).checked,
      wholeWord: (document.getElementById('whole-word') as HTMLInputElement).checked,
      caseSensitive: (document.getElementById('case-sensitive') as HTMLInputElement).checked,
      decorations: (document.getElementById('highlight-all-matches') as HTMLInputElement).checked ? {
        matchBackground: '#232422',
        matchBorder: '#555753',
        matchOverviewRuler: '#555753',
        activeMatchBackground: '#ef2929',
        activeMatchBorder: '#ffffff',
        activeMatchColorOverviewRuler: '#ef2929'
      } : undefined
    };
  }
  useEffect(() => {
    if (isRendered.current) return;
    if (!terminalRef.current) return;

    isRendered.current = true;
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      cursorWidth: 1,
      rows: 40,
      cols: 150,
      fontFamily: 'monospace',
      theme: {
        background: backgroundColor,
        cursor: '#f1fa8c',
      },
    });
    termRef.current = term;
    const searchAddon = new SearchAddon()
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
    fitAddon.fit();
    
    const savedBuffer = localStorage.getItem(activeTab.toString());
    if (savedBuffer) {
      // term.input(savedBuffer);
    }

    term.onData(async (input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, {
        uid: tabs[activeTab].uid,
        input
      });
    });
    new LigaturesAddon().activate(term);
    term.onKey(() => {
      defaultBellSound.play();
    })
    term.onResize((size) => {
      socket.emit(SocketEventConstants.SSH_EMIT_RESIZE, {
        uid: tabs[activeTab].uid,
        size
      })
    })

    socket.on(SocketEventConstants.SSH_EMIT_DATA, ({ uid, input }) => {
      if (uid === tabs[activeTab].uid) {
        term.write(input);
        term.scrollToBottom();
        const currentBuffer = localStorage.getItem(activeTab.toString()) || "";
        localStorage.setItem(activeTab.toString(), currentBuffer + input);
      }
    });


  }, [socket, navigate, activeTab]);

  window.addEventListener('resize', () => {
    fitAddon.fit();
  });

  useEffect(() => {
    if (clickType) {
      termRef.current?.input(command)
      setCommand('', 'single')
    }

  }, [clickType])
  return <div ref={terminalRef} id="terminal" style={{ width: '100%', height: '100%' }} />;
};

export default XTerminal;
