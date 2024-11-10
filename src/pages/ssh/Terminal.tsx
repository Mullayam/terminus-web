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
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { useNavigate } from 'react-router-dom';
const sound = `data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
    `
const audio = new Audio(sound)
const XTerminal = ({ backgroundColor = '#181818' }: { backgroundColor?: string }) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const isRendered = useRef(false);
  const { socket } = useSockets();
  const navigate = useNavigate()
  const fitAddon = new FitAddon();

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
      cols: 80,
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
    term.loadAddon(searchAddon);
    term.loadAddon(new SerializeAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new CanvasAddon());
    term.loadAddon(new ClipboardAddon());

    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(fitAddon);
    fitAddon.fit();
    term.open(terminalRef.current);
    termRef.current.open(terminalRef.current);
    term.onData(async (input) => {
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, input);
    });
    new LigaturesAddon().activate(term);
    term.onKey(() => {
      audio.play();
    })
    socket.on(SocketEventConstants.SSH_EMIT_DATA, (data: string) => {
      term.write(data);
      localStorage.setItem("terminalData", data);
      term.scrollToBottom();
    });


  }, [socket, navigate]);
  window.addEventListener('resize', () => {




  });



  return <div ref={terminalRef} id="terminal" style={{ position: 'relative' }} className='w-full h-full' />;
};

export default XTerminal;
