import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiCore } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Save, WrapText, Undo2, Redo2,
    Scissors, Copy, ClipboardPaste, TextSelect,
    Indent, Outdent, RemoveFormatting, Braces,
    RefreshCw, Info, X, Search, Replace, ArrowUp, ArrowDown,
    CaseSensitive, CaseUpper, CaseLower, ArrowUpDown,
    MessageSquareCode, SortAsc, Hash, Palette, Check,
} from "lucide-react";
import { editorThemes, getEditorTheme, getThemeKeys, DEFAULT_THEME_KEY, type EditorTheme } from "./editor-themes";
import FileIcon from "@/components/FileIcon";
import Prism from "prismjs";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-graphql";

import './prism-vscode-dark.css'

/** Detect language from file extension for the status bar */
function detectLang(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        js: "JavaScript", jsx: "JavaScript (JSX)", ts: "TypeScript", tsx: "TypeScript (TSX)",
        py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
        c: "C", cpp: "C++", h: "C Header", cs: "C#", swift: "Swift",
        html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", less: "LESS",
        json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML",
        md: "Markdown", sh: "Shell", bash: "Bash", zsh: "Zsh",
        sql: "SQL", graphql: "GraphQL", dockerfile: "Dockerfile",
        env: "Environment", conf: "Config", ini: "INI", cfg: "Config",
        txt: "Plain Text", log: "Log",
    };
    if (name.toLowerCase() === "dockerfile") return "Dockerfile";
    return map[ext] ?? "Plain Text";
}

/** Map file extension to Prism.js language identifier */
function detectPrismLang(name: string): string | null {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
        py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin",
        c: "c", cpp: "cpp", h: "c", cs: "csharp", swift: "swift",
        html: "markup", htm: "markup", css: "css", scss: "scss", less: "css",
        json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "markup",
        md: "markdown", sh: "bash", bash: "bash", zsh: "bash",
        sql: "sql", graphql: "graphql", dockerfile: "docker",
        ini: "ini", conf: "ini", cfg: "ini",
    };
    if (name.toLowerCase() === "dockerfile") return "docker";
    return map[ext] ?? null;
}

/** Escape HTML for safe dangerouslySetInnerHTML fallback */
function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const HIGHLIGHT_SIZE_LIMIT = 100_000; // Skip highlighting for files > 100KB

export default function FileEditorApiPage() {
    const [params] = useSearchParams();
    const filePath = params.get("path") ?? "";
    const sessionId = params.get("sessionId") ?? params.get("tabId") ?? "";
    const fileName = filePath.split("/").pop() ?? "untitled";

    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wordWrap, setWordWrap] = useState(true);
    const [cursorLine, setCursorLine] = useState(1);
    const [cursorCol, setCursorCol] = useState(1);
    const [modified, setModified] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showFind, setShowFind] = useState(false);
    const [showReplace, setShowReplace] = useState(false);
    const [findText, setFindText] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [findMatchCount, setFindMatchCount] = useState(0);
    const [findMatchIndex, setFindMatchIndex] = useState(-1);
    const [showGoToLine, setShowGoToLine] = useState(false);
    const [goToLineValue, setGoToLineValue] = useState("");
    const [themeKey, setThemeKey] = useState(() => localStorage.getItem("editor-theme") ?? DEFAULT_THEME_KEY);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const theme = getEditorTheme(themeKey);
    const c = theme.colors;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const findInputRef = useRef<HTMLInputElement>(null);
    const goToLineInputRef = useRef<HTMLInputElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const ctxMenuRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);
    const highlightRef = useRef<HTMLPreElement>(null);
    const originalContent = useRef("");
    const undoStack = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const { toast } = useToast();

    // ── Theme switcher ───────────────────────────────────────
    const handleThemeChange = (key: string) => {
        setThemeKey(key);
        localStorage.setItem("editor-theme", key);
        setShowThemePicker(false);
    };

    // ── Inject dynamic scrollbar CSS matching theme ──────────
    useEffect(() => {
        const id = "editor-theme-scrollbar";
        let style = document.getElementById(id) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement("style");
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = `
            .ctx-menu-scroll::-webkit-scrollbar { width: 6px; }
            .ctx-menu-scroll::-webkit-scrollbar-track { background: ${c.scrollTrack}; border-radius: 3px; }
            .ctx-menu-scroll::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 3px; }
            .ctx-menu-scroll::-webkit-scrollbar-thumb:hover { background: ${c.scrollThumbHover}; }
            .editor-modal-scroll::-webkit-scrollbar { width: 6px; }
            .editor-modal-scroll::-webkit-scrollbar-track { background: ${c.scrollTrack}; border-radius: 3px; }
            .editor-modal-scroll::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 3px; }
            .editor-modal-scroll::-webkit-scrollbar-thumb:hover { background: ${c.scrollThumbHover}; }
            .theme-picker-scroll::-webkit-scrollbar { width: 5px; }
            .theme-picker-scroll::-webkit-scrollbar-track { background: ${c.scrollTrack}; border-radius: 3px; }
            .theme-picker-scroll::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 3px; }
            .theme-picker-scroll::-webkit-scrollbar-thumb:hover { background: ${c.scrollThumbHover}; }
        `;
        return () => { style?.remove(); };
    }, [c.scrollTrack, c.scrollThumb, c.scrollThumbHover]);

    const lines = content.split("\n");
    const lineCount = lines.length;
    const lang = detectLang(fileName);

    // ── Syntax highlighting with Prism.js ────────────────────
    const highlightedHtml = useMemo(() => {
        if (content.length > HIGHLIGHT_SIZE_LIMIT) return escapeHtml(content);
        const prismLang = detectPrismLang(fileName);
        const grammar = prismLang ? Prism.languages[prismLang] : null;
        if (!grammar) return escapeHtml(content);
        try {
            return Prism.highlight(content, grammar, prismLang!);
        } catch {
            return escapeHtml(content);
        }
    }, [content, fileName]);

    // ── Fetch file content via API ────────────────────────────
    const fetchContent = useCallback(async () => {
        if (!sessionId || !filePath) {
            setError(!sessionId ? "Missing sessionId in URL" : "Missing file path in URL");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await ApiCore.fetchFileContent(sessionId, filePath);

            if (!data.status) {
                throw new Error(data.message || "Failed to load file content");
            }

            setContent(data.result);
            originalContent.current = data.result;
            setModified(false);
            undoStack.current = [];
            redoStack.current = [];
            setTimeout(() => textareaRef.current?.focus(), 100);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load file");
        } finally {
            setLoading(false);
        }
    }, [sessionId, filePath]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    // ── Update document title ────────────────────────────────
    useEffect(() => {
        document.title = `${fileName} — Terminus Editor`;
        return () => { document.title = "Terminus"; };
    }, [fileName]);

    // ── Save file via API ────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!sessionId || saving) return;
        setSaving(true);

        try {
            await ApiCore.saveFileContent(sessionId, filePath, content);
            setModified(false);
            originalContent.current = content;
            setLastSaved(new Date());
            toast({ title: "Saved", description: `${fileName} saved successfully`, duration: 2000 });
        } catch (e: any) {
            toast({
                title: "Save failed",
                description: e?.message ?? "Could not save the file",
                variant: "destructive",
                duration: 3000,
            });
        } finally {
            setSaving(false);
        }
    }, [sessionId, filePath, content, saving, fileName, toast]);

    // ── Editor helpers ───────────────────────────────────────
    const handleScroll = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
        if (highlightRef.current) {
            highlightRef.current.scrollTop = ta.scrollTop;
            highlightRef.current.scrollLeft = ta.scrollLeft;
        }
    };

    const updateCursor = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const textBefore = ta.value.substring(0, pos);
        const line = textBefore.split("\n").length;
        const col = pos - textBefore.lastIndexOf("\n");
        setCursorLine(line);
        setCursorCol(col);
    };

    const handleContentChange = (value: string) => {
        undoStack.current.push(content);
        if (undoStack.current.length > 200) undoStack.current.shift();
        redoStack.current = [];
        setContent(value);
        setModified(value !== originalContent.current);
    };

    const doUndo = () => {
        if (undoStack.current.length === 0) return;
        const prev = undoStack.current.pop()!;
        redoStack.current.push(content);
        setContent(prev);
        setModified(prev !== originalContent.current);
    };

    const doRedo = () => {
        if (redoStack.current.length === 0) return;
        const next = redoStack.current.pop()!;
        undoStack.current.push(content);
        setContent(next);
        setModified(next !== originalContent.current);
    };

    // ── Context menu ─────────────────────────────────────────
    const hasSelection = () => {
        const ta = textareaRef.current;
        return ta ? ta.selectionStart !== ta.selectionEnd : false;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const wrapper = editorWrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    // Reposition context menu if it overflows viewport edges
    useLayoutEffect(() => {
        if (!ctxMenu || !ctxMenuRef.current || !editorWrapperRef.current) return;
        const menuEl = ctxMenuRef.current;
        const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
        const menuRect = menuEl.getBoundingClientRect();
        let newX = ctxMenu.x;
        let newY = ctxMenu.y;
        if (newY + menuRect.height > wrapperRect.height) {
            newY = Math.max(4, wrapperRect.height - menuRect.height - 4);
        }
        if (newX + menuRect.width > wrapperRect.width) {
            newX = Math.max(4, wrapperRect.width - menuRect.width - 4);
        }
        menuEl.style.left = `${newX}px`;
        menuEl.style.top = `${newY}px`;
    }, [ctxMenu]);

    useEffect(() => {
        if (!ctxMenu) return;
        const close = () => setCtxMenu(null);
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        window.addEventListener("pointerdown", close);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("pointerdown", close);
            window.removeEventListener("keydown", onKey);
        };
    }, [ctxMenu]);

    const ctxAction = (fn: () => void) => {
        fn();
        setCtxMenu(null);
        textareaRef.current?.focus();
    };

    // ── Clipboard / editing actions ──────────────────────────
    const doCut = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const sel = content.substring(ta.selectionStart, ta.selectionEnd);
        navigator.clipboard.writeText(sel);
        const newContent = content.substring(0, ta.selectionStart) + content.substring(ta.selectionEnd);
        const pos = ta.selectionStart;
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos; });
    };

    const doCopy = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        navigator.clipboard.writeText(content.substring(ta.selectionStart, ta.selectionEnd));
    };

    const doPaste = async () => {
        const ta = textareaRef.current;
        if (!ta) return;
        try {
            const text = await navigator.clipboard.readText();
            const start = ta.selectionStart;
            const newContent = content.substring(0, start) + text + content.substring(ta.selectionEnd);
            handleContentChange(newContent);
            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + text.length; });
        } catch { /* clipboard permission denied */ }
    };

    const doSelectAll = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.selectionStart = 0;
        ta.selectionEnd = content.length;
    };

    const doIndentSelection = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = content.substring(0, start);
        const after = content.substring(end);
        const lineStart = before.lastIndexOf("\n") + 1;
        const block = content.substring(lineStart, end);
        const indented = block.split("\n").map((l) => "  " + l).join("\n");
        const newContent = content.substring(0, lineStart) + indented + after;
        handleContentChange(newContent);
        const addedChars = indented.length - block.length;
        requestAnimationFrame(() => { ta.selectionStart = start + 2; ta.selectionEnd = end + addedChars; });
    };

    const doOutdentSelection = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = content.substring(0, start);
        const after = content.substring(end);
        const lineStart = before.lastIndexOf("\n") + 1;
        const block = content.substring(lineStart, end);
        const outdented = block.split("\n").map((l) => l.startsWith("  ") ? l.slice(2) : l.startsWith(" ") ? l.slice(1) : l).join("\n");
        const removedChars = block.length - outdented.length;
        const newContent = content.substring(0, lineStart) + outdented + after;
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = Math.max(lineStart, start - 2); ta.selectionEnd = end - removedChars; });
    };

    const doTrimWhitespace = () => {
        const trimmed = content.split("\n").map((l) => l.trimEnd()).join("\n");
        handleContentChange(trimmed);
    };

    const doFormatJSON = () => {
        try {
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            handleContentChange(formatted);
            toast({ title: "Formatted", description: "JSON formatted successfully", duration: 1500 });
        } catch {
            toast({ title: "Format Error", description: "Content is not valid JSON", variant: "destructive", duration: 2000 });
        }
    };

    const doDeleteLine = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const before = content.substring(0, pos);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEnd = content.indexOf("\n", pos);
        const newContent = content.substring(0, lineStart) + (lineEnd >= 0 ? content.substring(lineEnd + 1) : "");
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = lineStart; });
    };

    const doDuplicateLine = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const before = content.substring(0, pos);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEnd = content.indexOf("\n", pos);
        const line = content.substring(lineStart, lineEnd >= 0 ? lineEnd : content.length);
        const newContent =
            content.substring(0, lineEnd >= 0 ? lineEnd : content.length) +
            "\n" + line +
            (lineEnd >= 0 ? content.substring(lineEnd) : "");
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + line.length + 1; });
    };

    // ── Move line up/down ─────────────────────────────────────
    const doMoveLineUp = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const allLines = content.split("\n");
        const textBefore = content.substring(0, pos);
        const lineIdx = textBefore.split("\n").length - 1;
        if (lineIdx <= 0) return;
        const tmp = allLines[lineIdx];
        allLines[lineIdx] = allLines[lineIdx - 1];
        allLines[lineIdx - 1] = tmp;
        const newContent = allLines.join("\n");
        const newPos = pos - allLines[lineIdx].length - 1;
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = Math.max(0, newPos); });
    };

    const doMoveLineDown = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const allLines = content.split("\n");
        const textBefore = content.substring(0, pos);
        const lineIdx = textBefore.split("\n").length - 1;
        if (lineIdx >= allLines.length - 1) return;
        const tmp = allLines[lineIdx];
        allLines[lineIdx] = allLines[lineIdx + 1];
        allLines[lineIdx + 1] = tmp;
        const newContent = allLines.join("\n");
        const newPos = pos + allLines[lineIdx].length + 1;
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = newPos; });
    };

    // ── Toggle line comment ───────────────────────────────────
    const doToggleComment = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = content.substring(0, start);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEndIdx = content.indexOf("\n", end);
        const block = content.substring(lineStart, lineEndIdx >= 0 ? lineEndIdx : content.length);
        const blockLines = block.split("\n");
        const allCommented = blockLines.every((l) => l.trimStart().startsWith("//"));
        const toggled = blockLines.map((l) => {
            if (allCommented) {
                const idx = l.indexOf("//");
                return l.substring(0, idx) + l.substring(idx + 2 + (l[idx + 2] === " " ? 1 : 0));
            }
            const match = l.match(/^(\s*)/);
            const indent = match ? match[1] : "";
            return indent + "// " + l.substring(indent.length);
        }).join("\n");
        const newContent = content.substring(0, lineStart) + toggled + (lineEndIdx >= 0 ? content.substring(lineEndIdx) : "");
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = lineStart; ta.selectionEnd = lineStart + toggled.length; });
    };

    // ── Sort selected lines ───────────────────────────────────
    const doSortLines = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = content.substring(0, start);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEndIdx = content.indexOf("\n", end);
        const block = content.substring(lineStart, lineEndIdx >= 0 ? lineEndIdx : content.length);
        const sorted = block.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
        const newContent = content.substring(0, lineStart) + sorted + (lineEndIdx >= 0 ? content.substring(lineEndIdx) : "");
        handleContentChange(newContent);
        toast({ title: "Sorted", description: "Lines sorted alphabetically", duration: 1500 });
    };

    // ── Transform case ────────────────────────────────────────
    const doUpperCase = () => {
        const ta = textareaRef.current;
        if (!ta || ta.selectionStart === ta.selectionEnd) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = content.substring(start, end).toUpperCase();
        const newContent = content.substring(0, start) + sel + content.substring(end);
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = start; ta.selectionEnd = start + sel.length; });
    };

    const doLowerCase = () => {
        const ta = textareaRef.current;
        if (!ta || ta.selectionStart === ta.selectionEnd) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = content.substring(start, end).toLowerCase();
        const newContent = content.substring(0, start) + sel + content.substring(end);
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = start; ta.selectionEnd = start + sel.length; });
    };

    // ── Find helpers ──────────────────────────────────────────
    const updateFindMatches = useCallback((searchText: string) => {
        if (!searchText) { setFindMatchCount(0); setFindMatchIndex(-1); return; }
        try {
            const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            const matches = [...content.matchAll(regex)];
            setFindMatchCount(matches.length);
            if (matches.length > 0) {
                const ta = textareaRef.current;
                const cursorPos = ta ? ta.selectionStart : 0;
                const idx = matches.findIndex((m) => (m.index ?? 0) >= cursorPos);
                setFindMatchIndex(idx >= 0 ? idx : 0);
            } else {
                setFindMatchIndex(-1);
            }
        } catch { setFindMatchCount(0); setFindMatchIndex(-1); }
    }, [content]);

    useEffect(() => { updateFindMatches(findText); }, [findText, content, updateFindMatches]);

    const doFindNext = useCallback(() => {
        if (!findText || findMatchCount === 0) return;
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = [...content.matchAll(regex)];
        const nextIdx = (findMatchIndex + 1) % matches.length;
        setFindMatchIndex(nextIdx);
        const match = matches[nextIdx];
        const ta = textareaRef.current;
        if (ta && match) {
            ta.focus();
            ta.selectionStart = match.index ?? 0;
            ta.selectionEnd = (match.index ?? 0) + match[0].length;
        }
    }, [findText, findMatchCount, findMatchIndex, content]);

    const doFindPrev = useCallback(() => {
        if (!findText || findMatchCount === 0) return;
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = [...content.matchAll(regex)];
        const prevIdx = (findMatchIndex - 1 + matches.length) % matches.length;
        setFindMatchIndex(prevIdx);
        const match = matches[prevIdx];
        const ta = textareaRef.current;
        if (ta && match) {
            ta.focus();
            ta.selectionStart = match.index ?? 0;
            ta.selectionEnd = (match.index ?? 0) + match[0].length;
        }
    }, [findText, findMatchCount, findMatchIndex, content]);

    const doReplaceOne = () => {
        if (!findText || findMatchCount === 0) return;
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = [...content.matchAll(regex)];
        const idx = Math.max(0, findMatchIndex);
        const match = matches[idx];
        if (!match) return;
        const pos = match.index ?? 0;
        const newContent = content.substring(0, pos) + replaceText + content.substring(pos + match[0].length);
        handleContentChange(newContent);
    };

    const doReplaceAll = () => {
        if (!findText) return;
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const newContent = content.replace(regex, replaceText);
        handleContentChange(newContent);
        toast({ title: "Replaced", description: `All occurrences replaced`, duration: 1500 });
    };

    // ── Go to line ────────────────────────────────────────────
    const doGoToLine = () => {
        const lineNum = parseInt(goToLineValue);
        if (isNaN(lineNum) || lineNum < 1) return;
        const ta = textareaRef.current;
        if (!ta) return;
        const allLines = content.split("\n");
        const targetLine = Math.min(lineNum, allLines.length);
        let pos = 0;
        for (let i = 0; i < targetLine - 1; i++) {
            pos += allLines[i].length + 1;
        }
        ta.focus();
        ta.selectionStart = ta.selectionEnd = pos;
        setCursorLine(targetLine);
        setCursorCol(1);
        setShowGoToLine(false);
        setGoToLineValue("");
    };

    // ── Focus find input when opened ──────────────────────────
    useEffect(() => {
        if (showFind) setTimeout(() => findInputRef.current?.focus(), 50);
    }, [showFind]);

    useEffect(() => {
        if (showGoToLine) setTimeout(() => goToLineInputRef.current?.focus(), 50);
    }, [showGoToLine]);

    // ── Shortcuts data for help modal ─────────────────────────
    const shortcutGroups = [
        {
            title: "File",
            items: [
                { keys: "Ctrl+S", desc: "Save file" },
                { keys: "Ctrl+F", desc: "Find in file" },
                { keys: "Ctrl+H", desc: "Find & Replace" },
                { keys: "Ctrl+G", desc: "Go to line" },
            ],
        },
        {
            title: "Editing",
            items: [
                { keys: "Ctrl+Z", desc: "Undo" },
                { keys: "Ctrl+Shift+Z", desc: "Redo" },
                { keys: "Ctrl+X", desc: "Cut selection" },
                { keys: "Ctrl+C", desc: "Copy selection" },
                { keys: "Ctrl+V", desc: "Paste" },
                { keys: "Ctrl+A", desc: "Select all" },
                { keys: "Ctrl+D", desc: "Duplicate line" },
                { keys: "Ctrl+Shift+K", desc: "Delete line" },
                { keys: "Ctrl+/", desc: "Toggle line comment" },
            ],
        },
        {
            title: "Navigation",
            items: [
                { keys: "Alt+Up", desc: "Move line up" },
                { keys: "Alt+Down", desc: "Move line down" },
                { keys: "Tab", desc: "Indent" },
                { keys: "Shift+Tab", desc: "Outdent" },
                { keys: "Enter", desc: "New line with auto-indent" },
            ],
        },
        {
            title: "Transform",
            items: [
                { keys: "Ctrl+Shift+U", desc: "Uppercase selection" },
                { keys: "Ctrl+Shift+L", desc: "Lowercase selection" },
                { keys: "Context Menu", desc: "Sort lines, Trim whitespace, Format JSON" },
            ],
        },
        {
            title: "Brackets",
            items: [
                { keys: "( [ { \" ' \`", desc: "Auto-close brackets & quotes" },
                { keys: "Select + bracket", desc: "Wrap selection in brackets" },
            ],
        },
    ];

    // Context menu items
    const ctxItems: { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean; shortcut?: string; separator?: boolean }[] = [
        { label: "Undo", icon: <Undo2 className="w-3.5 h-3.5" />, action: doUndo, disabled: undoStack.current.length === 0, shortcut: "Ctrl+Z" },
        { label: "Redo", icon: <Redo2 className="w-3.5 h-3.5" />, action: doRedo, disabled: redoStack.current.length === 0, shortcut: "Ctrl+Shift+Z", separator: true },
        { label: "Cut", icon: <Scissors className="w-3.5 h-3.5" />, action: doCut, disabled: !hasSelection(), shortcut: "Ctrl+X" },
        { label: "Copy", icon: <Copy className="w-3.5 h-3.5" />, action: doCopy, disabled: !hasSelection(), shortcut: "Ctrl+C" },
        { label: "Paste", icon: <ClipboardPaste className="w-3.5 h-3.5" />, action: doPaste, shortcut: "Ctrl+V" },
        { label: "Select All", icon: <TextSelect className="w-3.5 h-3.5" />, action: doSelectAll, shortcut: "Ctrl+A", separator: true },
        { label: "Indent", icon: <Indent className="w-3.5 h-3.5" />, action: doIndentSelection, shortcut: "Tab" },
        { label: "Outdent", icon: <Outdent className="w-3.5 h-3.5" />, action: doOutdentSelection, shortcut: "Shift+Tab", separator: true },
        { label: "Delete Line", icon: <RemoveFormatting className="w-3.5 h-3.5" />, action: doDeleteLine, shortcut: "Ctrl+Shift+K" },
        { label: "Duplicate Line", icon: <Copy className="w-3.5 h-3.5" />, action: doDuplicateLine },
        { label: "Move Line Up", icon: <ArrowUp className="w-3.5 h-3.5" />, action: doMoveLineUp, shortcut: "Alt+Up" },
        { label: "Move Line Down", icon: <ArrowDown className="w-3.5 h-3.5" />, action: doMoveLineDown, shortcut: "Alt+Down", separator: true },
        { label: "Toggle Comment", icon: <MessageSquareCode className="w-3.5 h-3.5" />, action: doToggleComment, shortcut: "Ctrl+/" },
        { label: "Sort Lines", icon: <SortAsc className="w-3.5 h-3.5" />, action: doSortLines },
        { label: "Uppercase", icon: <CaseUpper className="w-3.5 h-3.5" />, action: doUpperCase, disabled: !hasSelection() },
        { label: "Lowercase", icon: <CaseLower className="w-3.5 h-3.5" />, action: doLowerCase, disabled: !hasSelection(), separator: true },
        { label: "Trim Whitespace", icon: <RemoveFormatting className="w-3.5 h-3.5" />, action: doTrimWhitespace },
        { label: "Format JSON", icon: <Braces className="w-3.5 h-3.5" />, action: doFormatJSON, disabled: lang !== "JSON" },
        { label: "Find", icon: <Search className="w-3.5 h-3.5" />, action: () => { setShowFind(true); setShowReplace(false); }, shortcut: "Ctrl+F" },
        { label: "Find & Replace", icon: <Replace className="w-3.5 h-3.5" />, action: () => { setShowFind(true); setShowReplace(true); }, shortcut: "Ctrl+H" },
        { label: "Go to Line", icon: <Hash className="w-3.5 h-3.5" />, action: () => setShowGoToLine(true), shortcut: "Ctrl+G", separator: true },
        { label: "Save", icon: <Save className="w-3.5 h-3.5" />, action: handleSave, disabled: !modified, shortcut: "Ctrl+S" },
    ];

    // ── Keyboard shortcuts ───────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            handleSave();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
            e.preventDefault();
            doUndo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "Z" || e.key === "y")) {
            e.preventDefault();
            doRedo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
            e.preventDefault();
            doDeleteLine();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "d") {
            e.preventDefault();
            doDuplicateLine();
            return;
        }
        // Ctrl+F → Find
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "f") {
            e.preventDefault();
            setShowFind(true);
            setShowReplace(false);
            return;
        }
        // Ctrl+H → Find & Replace
        if ((e.ctrlKey || e.metaKey) && e.key === "h") {
            e.preventDefault();
            setShowFind(true);
            setShowReplace(true);
            return;
        }
        // Ctrl+G → Go to Line
        if ((e.ctrlKey || e.metaKey) && e.key === "g") {
            e.preventDefault();
            setShowGoToLine(true);
            return;
        }
        // Ctrl+/ → Toggle comment
        if ((e.ctrlKey || e.metaKey) && e.key === "/") {
            e.preventDefault();
            doToggleComment();
            return;
        }
        // Alt+Up → Move line up
        if (e.altKey && e.key === "ArrowUp") {
            e.preventDefault();
            doMoveLineUp();
            return;
        }
        // Alt+Down → Move line down
        if (e.altKey && e.key === "ArrowDown") {
            e.preventDefault();
            doMoveLineDown();
            return;
        }
        // Ctrl+Shift+U → Uppercase
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "U") {
            e.preventDefault();
            doUpperCase();
            return;
        }
        // Ctrl+Shift+L → Lowercase
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
            e.preventDefault();
            doLowerCase();
            return;
        }

        // Tab → insert / remove spaces
        if (e.key === "Tab") {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;

            if (e.shiftKey) {
                const before = content.substring(0, start);
                const lineStart = before.lastIndexOf("\n") + 1;
                const linePrefix = content.substring(lineStart, start);
                const spacesToRemove = linePrefix.startsWith("  ") ? 2 : linePrefix.startsWith(" ") ? 1 : 0;
                if (spacesToRemove > 0) {
                    const newContent = content.substring(0, lineStart) + content.substring(lineStart + spacesToRemove);
                    handleContentChange(newContent);
                    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start - spacesToRemove; });
                }
            } else {
                const newContent = content.substring(0, start) + "  " + content.substring(end);
                handleContentChange(newContent);
                requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
            }
            return;
        }

        // Enter → auto-indent
        if (e.key === "Enter") {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const before = content.substring(0, start);
            const currentLine = before.substring(before.lastIndexOf("\n") + 1);
            const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";
            const insert = "\n" + indent;
            const newContent = content.substring(0, start) + insert + content.substring(ta.selectionEnd);
            handleContentChange(newContent);
            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + insert.length; });
            return;
        }

        // Auto-close brackets
        const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
        if (pairs[e.key]) {
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            if (start !== end) {
                e.preventDefault();
                const selected = content.substring(start, end);
                const newContent = content.substring(0, start) + e.key + selected + pairs[e.key] + content.substring(end);
                handleContentChange(newContent);
                requestAnimationFrame(() => { ta.selectionStart = start + 1; ta.selectionEnd = end + 1; });
            }
        }
    };

    // ── Render states ────────────────────────────────────────
    if (error && !content) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: c.bg }}>
                <div className="text-center space-y-3">
                    <p className="text-sm" style={{ color: c.error }}>{error}</p>
                    <p className="text-xs" style={{ color: c.textMuted }}>Check the URL parameters and try again.</p>
                    <button
                        onClick={fetchContent}
                        className="inline-flex items-center gap-1.5 text-xs transition-colors mt-2"
                        style={{ color: c.accent }}
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: c.bg }}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: c.accent }} />
                    <span className="text-sm" style={{ color: c.text }}>Loading {fileName}…</span>
                </div>
            </div>
        );
    }

    const gutterWidth = Math.max(String(lineCount).length * 10 + 20, 40);

    return (
        <div className="h-screen w-full overflow-hidden flex flex-col" style={{ background: c.bg }}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 shrink-0 select-none overflow-hidden" style={{ background: c.bgSurface, borderBottom: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span className="flex items-center space-x-1">
                        <FileIcon name={fileName} isDirectory={false} className="w-4 h-4" />
                        <span className="text-[13px] font-medium truncate" style={{ color: c.text }}>{fileName}</span>
                    </span>
                    {modified && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.warning }} title="Unsaved changes" />
                    )}
                    <span className="text-[11px] font-mono truncate hidden sm:inline" style={{ color: c.textMuted }}>
                        {filePath}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => { setShowFind(true); setShowReplace(false); }}
                        title="Find (Ctrl+F)"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: c.textMuted }}
                        onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                        onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
                    >
                        <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setShowGoToLine(true)}
                        title="Go to Line (Ctrl+G)"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: c.textMuted }}
                        onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                        onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
                    >
                        <Hash className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={fetchContent}
                        disabled={loading}
                        title="Reload file from server"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: c.textMuted }}
                        onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                        onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setWordWrap((w) => !w)}
                        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ background: wordWrap ? c.hover : "transparent", color: wordWrap ? c.text : c.textMuted }}
                        onMouseEnter={e => { if (!wordWrap) e.currentTarget.style.color = c.text; }}
                        onMouseLeave={e => { if (!wordWrap) e.currentTarget.style.color = c.textMuted; }}
                    >
                        <WrapText className="w-3.5 h-3.5" />
                    </button>
                    {/* Theme picker button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowThemePicker((v) => !v)}
                            title="Change theme"
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: showThemePicker ? c.text : c.textMuted, background: showThemePicker ? c.hover : "transparent" }}
                            onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                            onMouseLeave={e => { if (!showThemePicker) e.currentTarget.style.color = c.textMuted; }}
                        >
                            <Palette className="w-3.5 h-3.5" />
                        </button>
                        {showThemePicker && (
                            <div
                                className="theme-picker-scroll absolute right-0 top-full mt-1 z-50 w-52 p-1.5 rounded-lg shadow-2xl shadow-black/50 max-h-64 overflow-y-auto"
                                style={{ background: c.bgSurface, border: `1px solid ${c.border}` }}
                            >
                                {getThemeKeys().map((key) => {
                                    const t = editorThemes[key];
                                    const isActive = key === themeKey;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleThemeChange(key)}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors"
                                            style={{ color: isActive ? c.text : c.textMuted, background: isActive ? c.hover : "transparent" }}
                                            onMouseEnter={e => { e.currentTarget.style.background = c.hover; e.currentTarget.style.color = c.text; }}
                                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = c.textMuted; } }}
                                        >
                                            {/* Color preview dots */}
                                            <span className="flex gap-0.5 shrink-0">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.colors.accent }} />
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.colors.bg }} />
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.colors.text }} />
                                            </span>
                                            <span className="flex-1 text-left">{t.name}</span>
                                            {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: c.accent }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        title="Keyboard Shortcuts & Help"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: c.textMuted }}
                        onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                        onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !modified}
                        className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium px-3 py-1.5 rounded-md transition-colors ml-1"
                        style={{ background: c.accent, color: c.accentText }}
                        onMouseEnter={e => (e.currentTarget.style.background = c.accentHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = c.accent)}
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>

            {/* Find / Replace bar */}
            {showFind && (
                <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: c.bgSurface, borderBottom: `1px solid ${c.border}` }}>
                    <Search className="w-3.5 h-3.5 shrink-0" style={{ color: c.textMuted }} />
                    <input
                        ref={findInputRef}
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.shiftKey ? doFindPrev() : doFindNext(); }
                            if (e.key === "Escape") { setShowFind(false); setShowReplace(false); setFindText(""); textareaRef.current?.focus(); }
                        }}
                        placeholder="Find…"
                        className="text-[12px] font-mono px-2 py-1 rounded-md outline-none w-48"
                        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                    />
                    {findText && (
                        <span className="text-[11px] min-w-[60px]" style={{ color: c.textMuted }}>
                            {findMatchCount > 0 ? `${findMatchIndex + 1} of ${findMatchCount}` : "No results"}
                        </span>
                    )}
                    <button onClick={doFindPrev} disabled={findMatchCount === 0} className="p-1 rounded disabled:opacity-30" style={{ color: c.textMuted }} title="Previous (Shift+Enter)">
                        <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={doFindNext} disabled={findMatchCount === 0} className="p-1 rounded disabled:opacity-30" style={{ color: c.textMuted }} title="Next (Enter)">
                        <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowReplace((r) => !r)} className="p-1 rounded transition-colors" style={{ color: showReplace ? c.text : c.textMuted, background: showReplace ? c.hover : "transparent" }} title="Toggle Replace (Ctrl+H)">
                        <Replace className="w-3.5 h-3.5" />
                    </button>
                    {showReplace && (
                        <>
                            <input
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Escape") { setShowFind(false); setShowReplace(false); setFindText(""); textareaRef.current?.focus(); } }}
                                placeholder="Replace…"
                                className="text-[12px] font-mono px-2 py-1 rounded-md outline-none w-40"
                                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                            />
                            <button onClick={doReplaceOne} disabled={findMatchCount === 0} className="text-[11px] px-2 py-1 rounded-md disabled:opacity-30" style={{ background: c.hover, color: c.text }} title="Replace">
                                Replace
                            </button>
                            <button onClick={doReplaceAll} disabled={findMatchCount === 0} className="text-[11px] px-2 py-1 rounded-md disabled:opacity-30" style={{ background: c.hover, color: c.text }} title="Replace All">
                                All
                            </button>
                        </>
                    )}
                    <button onClick={() => { setShowFind(false); setShowReplace(false); setFindText(""); textareaRef.current?.focus(); }} className="p-1 rounded ml-auto" style={{ color: c.textMuted }} title="Close (Escape)">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Go to Line bar */}
            {showGoToLine && (
                <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: c.bgSurface, borderBottom: `1px solid ${c.border}` }}>
                    <Hash className="w-3.5 h-3.5 shrink-0" style={{ color: c.textMuted }} />
                    <span className="text-[12px]" style={{ color: c.textMuted }}>Go to Line:</span>
                    <input
                        ref={goToLineInputRef}
                        value={goToLineValue}
                        onChange={(e) => setGoToLineValue(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") doGoToLine();
                            if (e.key === "Escape") { setShowGoToLine(false); setGoToLineValue(""); textareaRef.current?.focus(); }
                        }}
                        placeholder={`1 – ${lineCount}`}
                        className="text-[12px] font-mono px-2 py-1 rounded-md outline-none w-32"
                        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                    />
                    <button onClick={doGoToLine} className="text-[11px] px-2 py-1 rounded-md" style={{ background: c.hover, color: c.text }}>Go</button>
                    <button onClick={() => { setShowGoToLine(false); setGoToLineValue(""); textareaRef.current?.focus(); }} className="p-1 rounded ml-auto" style={{ color: c.textMuted }} title="Close (Escape)">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Editor body */}
            <div
                ref={editorWrapperRef}
                className="relative flex flex-1 overflow-hidden"
                onContextMenu={handleContextMenu}
            >
                {/* Custom context menu */}
                {ctxMenu && (
                    <div
                        ref={ctxMenuRef}
                        className="ctx-menu-scroll absolute z-50 w-[250px] p-1.5 backdrop-blur-xl rounded-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-100 max-h-[min(70vh,500px)] overflow-y-auto"
                        style={{ left: ctxMenu.x, top: ctxMenu.y, background: c.bgSurface, border: `1px solid ${c.border}` }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {ctxItems.map((item, i) => (
                            <div key={i}>
                                <button
                                    disabled={item.disabled}
                                    onClick={() => ctxAction(item.action)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors disabled:pointer-events-none"
                                    style={{ color: item.disabled ? c.textMuted : c.text }}
                                    onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = c.hover; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                >
                                    <span className="w-4 h-4 flex items-center justify-center" style={{ color: c.accent }}>
                                        {item.icon}
                                    </span>
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.shortcut && (
                                        <span className="text-[11px] ml-auto pl-3 tracking-wide" style={{ color: c.textMuted }}>
                                            {item.shortcut}
                                        </span>
                                    )}
                                </button>
                                {item.separator && <div className="my-1 h-px" style={{ background: c.border }} />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Line number gutter */}
                <div
                    ref={gutterRef}
                    className="shrink-0 overflow-hidden select-none pointer-events-none"
                    style={{ width: gutterWidth, background: c.bg, borderRight: `1px solid ${c.border}` }}
                    aria-hidden
                >
                    <div className="py-[10px]">
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div
                                key={i}
                                className="px-2 text-right font-mono leading-[20px] text-[12px]"
                                style={{ height: 20, color: i + 1 === cursorLine ? c.text : c.textMuted }}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor area with syntax highlighting overlay */}
                <div className="relative flex-1 overflow-hidden">
                    {/* Syntax highlight layer (behind textarea) */}
                    <pre
                        ref={highlightRef}
                        className="prism-dracula absolute inset-0 m-0 p-[10px] overflow-hidden text-[13px] font-mono leading-[20px] select-none"
                        style={{
                            whiteSpace: wordWrap ? "pre-wrap" : "pre",
                            overflowWrap: wordWrap ? "break-word" : "normal",
                            tabSize: 2,
                            background: c.bg,
                        }}
                        aria-hidden
                    >
                        <code
                            dangerouslySetInnerHTML={{ __html: highlightedHtml + "\n" }}
                            style={{ fontFamily: "inherit" }}
                        />
                    </pre>
                    {/* Textarea — transparent text, visible caret */}
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        onScroll={handleScroll}
                        onKeyDown={handleKeyDown}
                        onKeyUp={updateCursor}
                        onClick={updateCursor}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        className="relative z-10 w-full h-full resize-none bg-transparent text-transparent text-[13px] font-mono p-[10px] outline-none leading-[20px]"
                        style={{
                            whiteSpace: wordWrap ? "pre-wrap" : "pre",
                            overflowWrap: wordWrap ? "break-word" : "normal",
                            overflowX: wordWrap ? "hidden" : "auto",
                            tabSize: 2,
                            caretColor: c.text,
                            // @ts-ignore -- vendor prefixed selection handled via global style
                        }}
                        placeholder="File is empty"
                    />
                </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-3 py-1 text-[11px] select-none overflow-hidden" style={{ background: c.bgStatusBar, borderTop: `1px solid ${c.border}`, color: c.textMuted }}>
                <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 rounded-sm font-semibold -ml-3 -my-1" style={{ background: c.accent, color: c.accentText }}>{lang}</span>
                    <span>UTF-8</span>
                    <span>{wordWrap ? "Wrap" : "No Wrap"}</span>
                    {lastSaved && (
                        <span style={{ color: c.success }}>
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span>Ln {cursorLine}, Col {cursorCol}</span>
                    <span>{lineCount} lines</span>
                    <span>{content.length.toLocaleString()} chars</span>
                    <span className="hidden sm:inline" style={{ color: c.textMuted }}>{theme.name}</span>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        className="hidden sm:inline transition-colors cursor-pointer"
                        style={{ color: c.textMuted }}
                        onMouseEnter={e => (e.currentTarget.style.color = c.accent)}
                        onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
                    >
                        Ctrl+S save · Ctrl+F find · ? help
                    </button>
                </div>
            </div>

            {/* Theme picker backdrop (close on click outside) */}
            {showThemePicker && (
                <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
            )}

            {/* Shortcuts / Help Modal */}
            {showShortcuts && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
                    <div
                        className="rounded-xl shadow-2xl shadow-black/50 w-[560px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col"
                        style={{ background: c.bgSurface, border: `1px solid ${c.border}` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4" style={{ color: c.accent }} />
                                <span className="text-[14px] font-semibold" style={{ color: c.text }}>Keyboard Shortcuts & Help</span>
                            </div>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="p-1 rounded-md transition-colors"
                                style={{ color: c.textMuted }}
                                onMouseEnter={e => { e.currentTarget.style.color = c.text; e.currentTarget.style.background = c.hover; }}
                                onMouseLeave={e => { e.currentTarget.style.color = c.textMuted; e.currentTarget.style.background = "transparent"; }}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Modal body */}
                        <div className="editor-modal-scroll overflow-y-auto p-5 space-y-5">
                            {shortcutGroups.map((group) => (
                                <div key={group.title}>
                                    <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: c.accent }}>{group.title}</h3>
                                    <div className="space-y-1">
                                        {group.items.map((item) => (
                                            <div
                                                key={item.keys}
                                                className="flex items-center justify-between py-1.5 px-2 rounded-md transition-colors"
                                                onMouseEnter={e => (e.currentTarget.style.background = c.bg)}
                                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                            >
                                                <span className="text-[13px]" style={{ color: c.text }}>{item.desc}</span>
                                                <div className="flex items-center gap-1">
                                                    {item.keys.split("+").map((key, ki) => (
                                                        <span key={ki}>
                                                            <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                                                                {key.trim()}
                                                            </kbd>
                                                            {ki < item.keys.split("+").length - 1 && (
                                                                <span className="text-[10px] mx-0.5" style={{ color: c.textMuted }}>+</span>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {/* Tips section */}
                            <div className="pt-4" style={{ borderTop: `1px solid ${c.border}` }}>
                                <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: c.success }}>Tips</h3>
                                <ul className="space-y-1.5 text-[12px]" style={{ color: `${c.text}cc` }}>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> Right-click anywhere in the editor for the full context menu with all actions</li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> Select text first to enable Cut, Copy, Uppercase, and Lowercase actions</li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> Typing a bracket character while text is selected will wrap the selection</li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> Use the Find bar with Enter/Shift+Enter to navigate between matches</li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> The editor auto-indents on Enter, matching the current line's indentation</li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> Unsaved changes show an orange dot next to the filename</li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5" style={{ color: c.accent }}>•</span> Click the <Palette className="w-3 h-3 inline" /> palette icon in the toolbar to switch themes</li>
                                </ul>
                            </div>
                        </div>
                        {/* Modal footer */}
                        <div className="px-5 py-2.5 flex justify-end" style={{ borderTop: `1px solid ${c.border}` }}>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="text-[12px] px-4 py-1.5 rounded-md font-medium transition-colors"
                                style={{ background: c.accent, color: c.accentText }}
                                onMouseEnter={e => (e.currentTarget.style.background = c.accentHover)}
                                onMouseLeave={e => (e.currentTarget.style.background = c.accent)}
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
