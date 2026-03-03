/**
 * @module components/AICompletionsPanel
 *
 * Dedicated sidebar panel for AI completion settings.
 * Allows users to select an AI provider, set the endpoint URL,
 * and view the current state of AI completions.
 */
import React from "react";
import {
  Sparkles,
  Ghost,
  BrainCircuit,
  RefreshCw,
} from "lucide-react";
import type { EditorSettings, AICompletionProvider } from "./EditorSettingsPanel";

/* ── Props ─────────────────────────────────────────────────── */

export interface AICompletionsPanelProps {
  settings: EditorSettings;
  onChange: (settings: EditorSettings) => void;
  /** Number of currently cached completion items */
  cachedCount?: number;
  /** Called when user clicks the manual fetch button */
  onFetchNow?: () => void;
}

/* ── Component ─────────────────────────────────────────────── */

export const AICompletionsPanel: React.FC<AICompletionsPanelProps> = ({
  settings,
  onChange,
  cachedCount = 0,
  onFetchNow,
}) => {
  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const provider = settings.aiCompletionProvider;

  return (
    <div className="py-2 px-3 ai-completions-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          AI Completions
        </span>
        {provider !== "none" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#007acc22] text-[#007acc] border border-[#007acc44]">
            Active
          </span>
        )}
      </div>

      {/* Provider selector */}
      <div className="mb-4">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
          Provider
        </div>
        <AIProviderSelector
          value={provider}
          onChange={(v) => update("aiCompletionProvider", v)}
        />
      </div>

      {/* Endpoint URL — Ghost Text */}
      {provider === "ghost-text" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Endpoint
          </div>
          <div className="flex flex-col gap-1 py-1 px-1">
            <input
              type="text"
              value={settings.ghostTextEndpoint}
              placeholder="http://localhost:7145"
              onChange={(e) => update("ghostTextEndpoint", e.target.value)}
              className="bg-[#3c3c3c] text-[11px] text-gray-300 px-2 py-1.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors w-full"
            />
            <p className="text-[9px] text-gray-600 mt-0.5">
              Base URL — SSE stream at <code className="text-[9px] bg-[#3c3c3c] px-0.5 rounded">{"{url}/api/stream"}</code>
            </p>
          </div>
        </div>
      )}

      {/* Ghost Text — Required Request / Response Format */}
      {provider === "ghost-text" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Required Formats
          </div>
          <div className="px-1 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <p className="text-[9px] text-gray-500 px-2 mb-1">
              <strong className="text-gray-400">POST</strong> <code className="text-[9px] bg-[#3c3c3c] px-0.5 rounded">{"{endpoint}/api/stream"}</code>
            </p>
            <p className="text-[9px] text-gray-500 px-2 mb-1.5">Request body:</p>
            <pre className="text-[9px] text-gray-300 px-2 py-1.5 bg-[#1a1a1a] rounded mx-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
{`{
  "filename": "app.ts",
  "language": "typescript",
  "textBeforeCursor": "function ",
  "textAfterCursor": "\\n}",
  "cursorPosition": {
    "lineNumber": 1,
    "column": 10
  }
}`}
            </pre>
            <p className="text-[9px] text-gray-500 px-2 mt-2 mb-1.5">Response — SSE stream:</p>
            <pre className="text-[9px] text-gray-300 px-2 py-1.5 bg-[#1a1a1a] rounded mx-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
{`data: {"choices":[{"delta":{"content":"hello"}}]}

data: {"choices":[{"delta":{"content":"World"}}]}

data: [DONE]`}
            </pre>
            <div className="text-[9px] text-gray-600 px-2 mt-2 space-y-0.5">
              <p>Supports OpenAI-style SSE (<code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">choices[0].delta.content</code>), or plain <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">data: token</code> lines.</p>
              <p>Also accepts <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">{`{ content }` }</code>, <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">{`{ text }`}</code>, or <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">{`{ token }`}</code> JSON shapes.</p>
            </div>
          </div>
        </div>
      )}

      {/* Endpoint URL — Copilot */}
      {provider === "copilot" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Endpoint
          </div>
          <div className="flex flex-col gap-1 py-1 px-1">
            <input
              type="text"
              value={settings.copilotEndpoint}
              placeholder="/api/complete"
              onChange={(e) => update("copilotEndpoint", e.target.value)}
              className="bg-[#3c3c3c] text-[11px] text-gray-300 px-2 py-1.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors w-full"
            />
            <p className="text-[9px] text-gray-600 mt-0.5">
              POST endpoint for monacopilot completions (default: <code className="text-[9px] bg-[#3c3c3c] px-0.5 rounded">/api/complete</code>)
            </p>
          </div>
        </div>
      )}

      {/* Copilot — Required Response Format */}
      {provider === "copilot" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Required Response Format
          </div>
          <div className="px-1 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <p className="text-[9px] text-gray-500 px-2 mb-1.5">
              Your endpoint receives a POST with <code className="text-[9px] bg-[#3c3c3c] px-0.5 rounded">completionMetadata</code> from monacopilot and must return:
            </p>
            <pre className="text-[9px] text-gray-300 px-2 py-1.5 bg-[#1a1a1a] rounded mx-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
{`{
  "completion": "function hello() {\\n  return 'world';\\n}",
  "error": null
}`}
            </pre>
            <div className="text-[9px] text-gray-600 px-2 mt-2 space-y-0.5">
              <p><strong className="text-gray-500">completion</strong> <span className="text-gray-700">(required)</span> — the inline code to suggest, or <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">null</code> for no suggestion</p>
              <p><strong className="text-gray-500">error</strong> <span className="text-gray-700">(optional)</span> — error message string if the request failed</p>
            </div>
            <p className="text-[9px] text-gray-600 px-2 mt-2">
              The request body contains <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">completionMetadata</code> with <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">language</code>, <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">filename</code>, <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">technologies</code>, cursor context, and surrounding code. See the <strong>monacopilot</strong> docs for full schema.
            </p>
          </div>
        </div>
      )}

      {/* Endpoint URL — AI Completions */}
      {provider === "ai-completions" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Endpoint
          </div>
          <div className="flex flex-col gap-1 py-1 px-1">
            <input
              type="text"
              value={settings.aiCompletionsEndpoint}
              placeholder="https://api.example.com/completions"
              onChange={(e) => update("aiCompletionsEndpoint", e.target.value)}
              className="bg-[#3c3c3c] text-[11px] text-gray-300 px-2 py-1.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors w-full"
            />
            <p className="text-[9px] text-gray-600 mt-0.5">
              POST endpoint returning <code className="text-[9px] bg-[#3c3c3c] px-0.5 rounded">{"{ items: [...] }"}</code>
            </p>
          </div>
        </div>
      )}

      {/* BYOB Response Format — only when "ai-completions" provider is selected */}
      {provider === "ai-completions" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Required Response Format
          </div>
          <div className="px-1 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c]">
            <p className="text-[9px] text-gray-500 px-2 mb-1.5">
              Your endpoint must return JSON in this exact shape:
            </p>
            <pre className="text-[9px] text-gray-300 px-2 py-1.5 bg-[#1a1a1a] rounded mx-1 overflow-x-auto font-mono leading-relaxed whitespace-pre">
{`{
  "items": [
    {
      "label": "myFunction",
      "kind": 1,
      "detail": "Description shown inline",
      "documentation": "Full docs (markdown ok)",
      "insertText": "myFunction($1)",
      "sortText": "0"
    }
  ]
}`}
            </pre>
            <div className="text-[9px] text-gray-600 px-2 mt-2 space-y-0.5">
              <p><strong className="text-gray-500">label</strong> <span className="text-gray-700">(required)</span> — completion display text</p>
              <p><strong className="text-gray-500">kind</strong> <span className="text-gray-700">(optional)</span> — Monaco CompletionItemKind number (1=Method, 3=Function, 5=Field, 6=Variable, 9=Module, 14=Keyword, 15=Snippet)</p>
              <p><strong className="text-gray-500">detail</strong> <span className="text-gray-700">(optional)</span> — short description</p>
              <p><strong className="text-gray-500">documentation</strong> <span className="text-gray-700">(optional)</span> — detailed docs</p>
              <p><strong className="text-gray-500">insertText</strong> <span className="text-gray-700">(optional)</span> — text to insert (supports <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">$1</code> tab stops). Defaults to <code className="text-[8px] bg-[#3c3c3c] px-0.5 rounded">label</code>.</p>
              <p><strong className="text-gray-500">sortText</strong> <span className="text-gray-700">(optional)</span> — controls sort order</p>
            </div>
          </div>
        </div>
      )}

      {/* Status card */}
      {provider !== "none" && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
            Status
          </div>
          <div className="px-1 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c] flex flex-col gap-2">
            {/* Cached count */}
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] text-gray-400">Cached items</span>
              <span className="text-[11px] text-gray-200 font-mono tabular-nums">
                {cachedCount}
              </span>
            </div>
            {/* Manual fetch button */}
            {provider === "ai-completions" && settings.aiCompletionsEndpoint && (
              <button
                onClick={onFetchNow}
                className="flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded bg-[#007acc] text-white hover:bg-[#006bb3] transition-colors mx-1"
              >
                <RefreshCw className="w-3 h-3" />
                Fetch from Server
              </button>
            )}
            <p className="text-[9px] text-gray-600 px-2">
              Completions are fetched once when a file opens (if cache is empty).
              Use <kbd className="text-[8px] bg-[#3c3c3c] px-1 py-px rounded border border-[#555]">Ctrl+Alt+A</kbd> or right-click → Fetch Snippets to refresh.
            </p>
          </div>
        </div>
      )}

      {/* Info when disabled */}
      {provider === "none" && (
        <div className="px-2 py-3 text-center">
          <Sparkles className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-[11px] text-gray-500 mb-1">AI completions are disabled</p>
          <p className="text-[10px] text-gray-600">
            Select a provider above to enable AI-powered code suggestions.
          </p>
        </div>
      )}

      {/* Scrollbar styling */}
      <style>{`
        .ai-completions-panel::-webkit-scrollbar { width: 5px; }
        .ai-completions-panel::-webkit-scrollbar-track { background: transparent; }
        .ai-completions-panel::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .ai-completions-panel::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

AICompletionsPanel.displayName = "AICompletionsPanel";

/* ── AI Provider Selector ──────────────────────────────────── */

function AIProviderSelector({
  value,
  onChange,
}: {
  value: AICompletionProvider;
  onChange: (value: AICompletionProvider) => void;
}) {
  const providers: { id: AICompletionProvider; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: "none",
      label: "Off",
      desc: "No AI completions",
      icon: <span className="w-4 h-4 rounded-full border border-[#555] inline-block" />,
    },
    {
      id: "ghost-text",
      label: "Ghost Text",
      desc: "SSE streaming inline suggestions",
      icon: <Ghost className="w-4 h-4" />,
    },
    {
      id: "copilot",
      label: "Copilot",
      desc: "Monacopilot AI completions",
      icon: <BrainCircuit className="w-4 h-4" />,
    },
    {
      id: "ai-completions",
      label: "AI Completions",
      desc: "Dynamic endpoint AI suggestions",
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex flex-col gap-1 py-0.5">
      {providers.map((p) => {
        const isActive = value === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors w-full"
            style={{
              background: isActive ? "#007acc22" : "transparent",
              border: isActive ? "1px solid #007acc" : "1px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "#2a2d2e";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{ borderColor: isActive ? "#007acc" : "#555" }}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#007acc]" />}
            </span>
            <span className={isActive ? "text-[#007acc]" : "text-gray-500"}>
              {p.icon}
            </span>
            <div className="flex flex-col min-w-0">
              <span className={`text-[12px] font-medium ${isActive ? "text-gray-200" : "text-gray-400"}`}>
                {p.label}
              </span>
              <span className="text-[10px] text-gray-600 truncate">{p.desc}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
