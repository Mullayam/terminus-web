import { useEffect, useRef, useState, useCallback } from 'react';
import { initEditorApi } from '@/modules/lsp-editor/editorSetup';
import { openFileInEditor, disposeAll } from '@/modules/lsp-editor/lspManager';

/* ------------------------------------------------------------------ */
/*  Sample files for testing — replace with API/disk data in real use  */
/* ------------------------------------------------------------------ */
const DEMO_FILES = [
  {
    name: 'main.py',
    uri: 'file:///workspace/main.py',
    content: `def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(greet("World"))
`,
  },
  {
    name: 'index.ts',
    uri: 'file:///workspace/index.ts',
    content: `interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): User {
  return { id, name: "Alice", email: "alice@example.com" };
}

const user = getUser(1);
console.log(user.name);
`,
  },
  {
    name: 'app.go',
    uri: 'file:///workspace/app.go',
    content: `package main

import "fmt"

func main() {
\tfmt.Println("Hello from Go!")
}
`,
  },
  {
    name: 'styles.css',
    uri: 'file:///workspace/styles.css',
    content: `:root {
  --primary: #3b82f6;
  --bg: #1e1e2e;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg);
  font-family: system-ui, sans-serif;
  color: #cdd6f4;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
`,
  },
  {
    name: 'config.json',
    uri: 'file:///workspace/config.json',
    content: `{
  "name": "demo-project",
  "version": "1.0.0",
  "settings": {
    "theme": "dark",
    "language": "en",
    "debug": false
  }
}
`,
  },
  {
    name: 'README.md',
    uri: 'file:///workspace/README.md',
    content: `# LSP Editor Demo

This is a demo of the **Monaco Editor** with dynamic LSP support.

## Features

- Dynamic language detection from file extension
- On-demand @codingame extension loading
- WebSocket LSP client with automatic lifecycle management
- Clean teardown when switching files
`,
  },
];

type DemoFile = (typeof DEMO_FILES)[number];

/* ------------------------------------------------------------------ */
/*  Language badge colors                                              */
/* ------------------------------------------------------------------ */
const LANG_COLORS: Record<string, string> = {
  py: '#3572A5',
  ts: '#3178C6',
  go: '#00ADD8',
  css: '#563D7C',
  json: '#E8D44D',
  md: '#519aba',
};

function getLangColor(filename: string): string {
  const ext = filename.split('.').pop() ?? '';
  return LANG_COLORS[ext] ?? '#6e7681';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function LspEditorDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Initialize editor API once on mount ---- */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      try {
        await initEditorApi(containerRef.current);
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('[LspEditorDemo] Failed to initialize editor:', err);
        if (!cancelled) setError('Failed to initialize the editor.');
      }
    }

    init();

    return () => {
      cancelled = true;
      disposeAll();
    };
  }, []);

  /* ---- Open a file ---- */
  const handleOpen = useCallback(
    async (file: DemoFile) => {
      if (!ready || !containerRef.current) return;
      setLoading(true);
      setError(null);
      setActiveFile(file.name);

      try {
        await openFileInEditor(
          containerRef.current,
          file.uri,
          file.name,
          file.content,
        );
      } catch (err) {
        console.error('[LspEditorDemo] Error opening file:', err);
        setError(`Failed to open ${file.name}`);
      } finally {
        setLoading(false);
      }
    },
    [ready],
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#181825' }}>
      {/* ──────── Sidebar ──────── */}
      <aside
        style={{
          width: 220,
          background: '#1e1e2e',
          borderRight: '1px solid #313244',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 0',
          overflow: 'auto',
        }}
      >
        <h2
          style={{
            color: '#cdd6f4',
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0 16px 10px',
            margin: 0,
            borderBottom: '1px solid #313244',
          }}
        >
          Explorer
        </h2>

        <div style={{ flex: 1, padding: '8px 0' }}>
          {DEMO_FILES.map((f) => {
            const isActive = activeFile === f.name;
            return (
              <div
                key={f.name}
                onClick={() => handleOpen(f)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  cursor: 'pointer',
                  color: isActive ? '#cdd6f4' : '#a6adc8',
                  background: isActive ? '#313244' : 'transparent',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  transition: 'background 0.15s',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = '#262637';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: getLangColor(f.name),
                    flexShrink: 0,
                  }}
                />
                {f.name}
              </div>
            );
          })}
        </div>

        {/* Status bar */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #313244',
            fontSize: 11,
            color: '#6c7086',
          }}
        >
          {!ready && 'Initializing…'}
          {ready && !activeFile && 'Select a file'}
          {ready && activeFile && loading && `Loading ${activeFile}…`}
          {ready && activeFile && !loading && `Editing: ${activeFile}`}
        </div>
      </aside>

      {/* ──────── Editor area ──────── */}
      <main style={{ flex: 1, position: 'relative' }}>
        {/* Error banner */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: '8px 16px',
              background: '#f38ba8',
              color: '#1e1e2e',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Placeholder when no file is selected */}
        {!activeFile && ready && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#6c7086',
              fontSize: 15,
              fontFamily: 'system-ui, sans-serif',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 40 }}>📄</span>
            <span>Select a file from the sidebar to start editing</span>
          </div>
        )}

        {/* Monaco editor mount point */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            opacity: activeFile ? 1 : 0,
          }}
        />
      </main>
    </div>
  );
}
