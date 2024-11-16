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
const sound = `data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK`
const audio = new Audio(sound)
// https://github.com/xtermjs/xterm.js/blob/master/demo/client.ts
const XTerminal = ({ backgroundColor = '#181818' }: { backgroundColor?: string }) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRendered = useRef(false);
  const { socket } = useSockets();
  const navigate = useNavigate()
  const fitAddon = new FitAddon();
  const { command, clickType } = useCommandStore()
  const { tabs, activeTab } = useStore();
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
      fontSize: 14,
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

    termRef.current.open(terminalRef.current);
    term.onData(async (input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, { sessionId:tabs[activeTab].sessionId, input });
    });
    new LigaturesAddon().activate(term);
    term.onKey(() => {
      audio.play();
    })
    term.onResize((size) => {
      socket.emit(SocketEventConstants.SSH_EMIT_RESIZE, size)
    })

    socket.on(SocketEventConstants.SSH_EMIT_DATA, (data:{ sessionId: string, input: string } ) => {
      // if (tabs[activeTab-1].sessionId === data.sessionId) {
        term.write(data.input);
        term.scrollToBottom();
      // }
    });
  }, [socket, navigate,activeTab]);
  window.addEventListener('resize', () => {
    fitAddon.fit();
  });
  useEffect(() => {
    if (clickType) {
      termRef.current?.input(command)
    }

  }, [clickType])
  return <div ref={terminalRef} id="terminal" style={{ width: '100%', height: '100%' }} />;
};

export default XTerminal;
