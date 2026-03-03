/**
 * @module components/HoverProviderPanel
 *
 * Dedicated sidebar panel for managing custom hover providers.
 * Users can add hover entries per language by pasting/editing
 * a JSON object mapping words to Markdown hover content.
 */
import React, { useState, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  Copy,
  Download,
} from "lucide-react";
import type { CustomHoverEntry } from "../lib/hoverProvider";
import { parseHovers, getGoHoverDemoJson } from "../lib/hoverProvider";

/* ── Props ─────────────────────────────────────────────────── */

export interface HoverProviderPanelProps {
  entries: CustomHoverEntry[];
  onChange: (entries: CustomHoverEntry[]) => void;
}

/* ── Common Languages ──────────────────────────────────────── */

const LANGUAGES = [
  "go", "python", "javascript", "typescript", "rust", "java",
  "csharp", "cpp", "ruby", "php", "html", "css", "json",
  "yaml", "markdown", "shellscript", "sql", "dart", "kotlin", "swift",
];

/* ── Component ─────────────────────────────────────────────── */

export const HoverProviderPanel: React.FC<HoverProviderPanelProps> = ({
  entries,
  onChange,
}) => {
  const [newLanguage, setNewLanguage] = useState("go");
  const [newJson, setNewJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editJson, setEditJson] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  /* Validate JSON on input change */
  const validateJson = useCallback((json: string): string | null => {
    if (!json.trim()) return null;
    const parsed = parseHovers(json);
    if (!parsed) return "Invalid JSON. Expected: { \"word\": \"markdown content\", ... }";
    return null;
  }, []);

  const totalWords = useMemo(() => {
    let count = 0;
    for (const entry of entries) {
      const parsed = parseHovers(entry.hoversJson);
      if (parsed) count += Object.keys(parsed).length;
    }
    return count;
  }, [entries]);

  /* ── Add new entry ── */
  const addEntry = useCallback(() => {
    const json = newJson.trim();
    if (!json) return;
    const err = validateJson(json);
    if (err) { setJsonError(err); return; }

    // Check for duplicate language
    const existing = entries.findIndex((e) => e.languageId === newLanguage);
    if (existing >= 0) {
      // Merge: combine objects
      const oldParsed = parseHovers(entries[existing].hoversJson) ?? {};
      const newParsed = parseHovers(json) ?? {};
      const merged = { ...oldParsed, ...newParsed };
      const updated = [...entries];
      updated[existing] = { ...updated[existing], hoversJson: JSON.stringify(merged, null, 2) };
      onChange(updated);
    } else {
      // Prettify the stored JSON
      const parsed = parseHovers(json)!;
      onChange([...entries, { languageId: newLanguage, hoversJson: JSON.stringify(parsed, null, 2) }]);
    }
    setNewJson("");
    setJsonError(null);
  }, [newJson, newLanguage, entries, onChange, validateJson]);

  /* ── Remove entry ── */
  const removeEntry = useCallback((index: number) => {
    onChange(entries.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  }, [entries, onChange, expandedIndex]);

  /* ── Toggle expand/collapse for inline editing ── */
  const toggleExpand = useCallback((index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
      setEditJson(entries[index].hoversJson);
      setEditError(null);
    }
  }, [expandedIndex, entries]);

  /* ── Save inline edit ── */
  const saveEdit = useCallback((index: number) => {
    const err = validateJson(editJson);
    if (err) { setEditError(err); return; }
    const parsed = parseHovers(editJson)!;
    const updated = [...entries];
    updated[index] = { ...updated[index], hoversJson: JSON.stringify(parsed, null, 2) };
    onChange(updated);
    setEditError(null);
  }, [editJson, entries, onChange, validateJson]);

  /* ── Copy JSON to clipboard ── */
  const copyJson = useCallback((index: number) => {
    navigator.clipboard.writeText(entries[index].hoversJson).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  }, [entries]);

  /* ── Load Go demo ── */
  const loadGoDemo = useCallback(() => {
    setNewLanguage("go");
    setNewJson(getGoHoverDemoJson());
    setJsonError(null);
  }, []);

  return (
    <div className="py-2 px-3 hover-provider-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          Hover Providers
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3c3c3c] text-gray-400 border border-[#555] tabular-nums font-mono">
          {entries.length} lang{entries.length !== 1 ? "s" : ""} · {totalWords} word{totalWords !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Existing entries */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {entries.map((entry, i) => {
            const parsed = parseHovers(entry.hoversJson);
            const wordCount = parsed ? Object.keys(parsed).length : 0;
            const isExpanded = expandedIndex === i;
            const isValid = parsed !== null;

            return (
              <div key={i} className="rounded bg-[#2a2d2e] overflow-hidden">
                {/* Row header */}
                <div className="flex items-center gap-1.5 px-1.5 py-1.5 group">
                  <button
                    onClick={() => toggleExpand(i)}
                    className="text-gray-500 hover:text-gray-300 shrink-0"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3" />
                      : <ChevronRight className="w-3 h-3" />
                    }
                  </button>
                  <FileText className="w-3 h-3 text-gray-500 shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[11px] text-gray-200 font-medium">
                      {entry.languageId}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {isValid ? `${wordCount} hover${wordCount !== 1 ? "s" : ""}` : "⚠ invalid JSON"}
                    </span>
                  </div>
                  <button
                    onClick={() => copyJson(i)}
                    className="text-gray-600 hover:text-gray-300 transition-colors shrink-0"
                    title="Copy JSON"
                  >
                    {copiedIndex === i
                      ? <Check className="w-3 h-3 text-green-400" />
                      : <Copy className="w-3 h-3" />
                    }
                  </button>
                  <button
                    onClick={() => removeEntry(i)}
                    className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Expanded inline editor */}
                {isExpanded && (
                  <div className="px-2 pb-2 flex flex-col gap-1.5">
                    {/* Preview: list of words */}
                    {parsed && (
                      <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
                        {Object.keys(parsed).map((word) => (
                          <span
                            key={word}
                            className="text-[9px] px-1 py-px rounded bg-[#007acc22] text-[#007acc] border border-[#007acc44]"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={editJson}
                      onChange={(e) => {
                        setEditJson(e.target.value);
                        setEditError(null);
                      }}
                      rows={8}
                      spellCheck={false}
                      className="bg-[#1e1e1e] text-[10px] text-gray-300 px-2 py-1.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors w-full font-mono resize-y"
                    />
                    {editError && (
                      <div className="flex items-center gap-1 text-[9px] text-red-400">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {editError}
                      </div>
                    )}
                    <button
                      onClick={() => saveEdit(i)}
                      className="flex items-center justify-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-[#007acc] text-white hover:bg-[#006bb3] transition-colors w-full"
                    >
                      <Check className="w-3 h-3" />
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new entry */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
          Add Hover Data
        </div>
        <div className="flex flex-col gap-1.5 px-1">
          {/* Language selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-gray-500 shrink-0">Language</label>
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="appearance-none bg-[#3c3c3c] text-[10px] text-gray-300 pl-1.5 pr-4 py-0.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors cursor-pointer flex-1"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* JSON textarea */}
          <textarea
            value={newJson}
            onChange={(e) => {
              setNewJson(e.target.value);
              setJsonError(null);
            }}
            rows={6}
            spellCheck={false}
            placeholder={`{\n  "fmt": "**package fmt**\\nFormatted I/O.",\n  "Println": "**fmt.Println**\\nPrints to stdout."\n}`}
            className="bg-[#3c3c3c] text-[10px] text-gray-300 px-2 py-1.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors w-full font-mono resize-y"
          />

          {/* Error */}
          {jsonError && (
            <div className="flex items-center gap-1 text-[9px] text-red-400">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {jsonError}
            </div>
          )}

          {/* Buttons row */}
          <div className="flex gap-1.5">
            <button
              onClick={addEntry}
              disabled={!newJson.trim()}
              className="flex items-center justify-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-[#007acc] text-white hover:bg-[#006bb3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
            <button
              onClick={loadGoDemo}
              className="flex items-center justify-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-[#3c3c3c] text-gray-300 hover:bg-[#4a4a4a] border border-[#555] transition-colors"
              title="Load Go demo hover data"
            >
              <Download className="w-3 h-3" />
              Go Demo
            </button>
          </div>
        </div>
      </div>

      {/* Help text when empty */}
      {entries.length === 0 && (
        <div className="px-2 py-3 text-center">
          <FileText className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-[11px] text-gray-500 mb-2">No custom hover providers</p>
          <div className="text-[10px] text-gray-600 text-left space-y-1">
            <p>Add hover documentation for any language.</p>
            <p className="text-gray-700">
              Provide a JSON object mapping <strong>words</strong> to <strong>Markdown</strong> content:
            </p>
            <pre className="text-[9px] bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 overflow-x-auto">
{`{
  "fmt": "**package fmt**\\n...",
  "Println": "**fmt.Println**\\n..."
}`}
            </pre>
            <p className="text-gray-700">
              Click <strong>Go Demo</strong> above to load a full example.
            </p>
          </div>
        </div>
      )}

      {/* Scrollbar styling */}
      <style>{`
        .hover-provider-panel::-webkit-scrollbar { width: 5px; }
        .hover-provider-panel::-webkit-scrollbar-track { background: transparent; }
        .hover-provider-panel::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .hover-provider-panel::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

HoverProviderPanel.displayName = "HoverProviderPanel";
