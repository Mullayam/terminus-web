import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiCore } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Save, WrapText, Undo2, Redo2,
    Scissors, Copy, ClipboardPaste, TextSelect,
    Indent, Outdent, RemoveFormatting, Braces,
    RefreshCw, Info, X, Search, Replace, ArrowUp, ArrowDown,
    CaseSensitive, CaseUpper, CaseLower, ArrowUpDown,
    MessageSquareCode, SortAsc, Hash,
} from "lucide-react";
import FileIcon from "@/components/FileIcon";

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

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const findInputRef = useRef<HTMLInputElement>(null);
    const goToLineInputRef = useRef<HTMLInputElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const ctxMenuRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);
    const originalContent = useRef("");
    const undoStack = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const { toast } = useToast();

    const lines = content.split("\n");
    const lineCount = lines.length;
    const lang = detectLang(fileName);

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
        if (textareaRef.current && gutterRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
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
            <div className="flex items-center justify-center h-screen bg-[#282a36]">
                <div className="text-center space-y-3">
                    <p className="text-[#ff5555] text-sm">{error}</p>
                    <p className="text-[#6272a4] text-xs">Check the URL parameters and try again.</p>
                    <button
                        onClick={fetchContent}
                        className="inline-flex items-center gap-1.5 text-xs text-[#bd93f9] hover:text-[#f8f8f2] transition-colors mt-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#282a36]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[#bd93f9]" />
                    <span className="text-sm text-[#f8f8f2]">Loading {fileName}…</span>
                </div>
            </div>
        );
    }

    const gutterWidth = Math.max(String(lineCount).length * 10 + 20, 40);

    return (
        <div className="h-screen w-screen bg-[#282a36] overflow-hidden flex flex-col">
            {/* Toolbar — VS Code title bar style */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#21222c] border-b border-[#44475a]">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center space-x-1">
                        <FileIcon name={fileName} isDirectory={false} className="w-4 h-4"/>
                        <span className="text-[13px] font-medium text-[#f8f8f2] truncate">{fileName}</span>
                    </span>
                    {modified && (
                        <span className="w-2 h-2 rounded-full bg-[#ffb86c] shrink-0" title="Unsaved changes" />
                    )}
                    <span className="text-[11px] text-[#6272a4] font-mono truncate hidden sm:inline">
                        {filePath}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setShowFind(true); setShowReplace(false); }}
                        title="Find (Ctrl+F)"
                        className="p-1.5 rounded-md text-[#6272a4] hover:text-[#f8f8f2] transition-colors"
                    >
                        <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setShowGoToLine(true)}
                        title="Go to Line (Ctrl+G)"
                        className="p-1.5 rounded-md text-[#6272a4] hover:text-[#f8f8f2] transition-colors"
                    >
                        <Hash className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={fetchContent}
                        disabled={loading}
                        title="Reload file from server"
                        className="p-1.5 rounded-md text-[#6272a4] hover:text-[#f8f8f2] transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setWordWrap((w) => !w)}
                        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                        className={`p-1.5 rounded-md transition-colors ${wordWrap ? "bg-[#44475a] text-[#f8f8f2]" : "text-[#6272a4] hover:text-[#f8f8f2]"}`}
                    >
                        <WrapText className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        title="Keyboard Shortcuts & Help"
                        className="p-1.5 rounded-md text-[#6272a4] hover:text-[#f8f8f2] transition-colors"
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !modified}
                        className="inline-flex items-center gap-1.5 bg-[#bd93f9] hover:bg-[#caa9fa] disabled:opacity-40 disabled:cursor-not-allowed text-[#282a36] text-xs font-medium px-3 py-1.5 rounded-md transition-colors ml-1"
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#21222c] border-b border-[#44475a]">
                    <Search className="w-3.5 h-3.5 text-[#6272a4] shrink-0" />
                    <input
                        ref={findInputRef}
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.shiftKey ? doFindPrev() : doFindNext(); }
                            if (e.key === "Escape") { setShowFind(false); setShowReplace(false); setFindText(""); textareaRef.current?.focus(); }
                        }}
                        placeholder="Find…"
                        className="bg-[#282a36] border border-[#44475a] text-[#f8f8f2] text-[12px] font-mono px-2 py-1 rounded-md outline-none focus:border-[#bd93f9] placeholder:text-[#6272a4] w-48"
                    />
                    {findText && (
                        <span className="text-[11px] text-[#6272a4] min-w-[60px]">
                            {findMatchCount > 0 ? `${findMatchIndex + 1} of ${findMatchCount}` : "No results"}
                        </span>
                    )}
                    <button onClick={doFindPrev} disabled={findMatchCount === 0} className="p-1 rounded text-[#6272a4] hover:text-[#f8f8f2] disabled:opacity-30" title="Previous (Shift+Enter)">
                        <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={doFindNext} disabled={findMatchCount === 0} className="p-1 rounded text-[#6272a4] hover:text-[#f8f8f2] disabled:opacity-30" title="Next (Enter)">
                        <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowReplace((r) => !r)} className={`p-1 rounded transition-colors ${showReplace ? "text-[#f8f8f2] bg-[#44475a]" : "text-[#6272a4] hover:text-[#f8f8f2]"}`} title="Toggle Replace (Ctrl+H)">
                        <Replace className="w-3.5 h-3.5" />
                    </button>
                    {showReplace && (
                        <>
                            <input
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Escape") { setShowFind(false); setShowReplace(false); setFindText(""); textareaRef.current?.focus(); } }}
                                placeholder="Replace…"
                                className="bg-[#282a36] border border-[#44475a] text-[#f8f8f2] text-[12px] font-mono px-2 py-1 rounded-md outline-none focus:border-[#bd93f9] placeholder:text-[#6272a4] w-40"
                            />
                            <button onClick={doReplaceOne} disabled={findMatchCount === 0} className="text-[11px] px-2 py-1 rounded-md bg-[#44475a] text-[#f8f8f2] hover:bg-[#6272a4] disabled:opacity-30" title="Replace">
                                Replace
                            </button>
                            <button onClick={doReplaceAll} disabled={findMatchCount === 0} className="text-[11px] px-2 py-1 rounded-md bg-[#44475a] text-[#f8f8f2] hover:bg-[#6272a4] disabled:opacity-30" title="Replace All">
                                All
                            </button>
                        </>
                    )}
                    <button onClick={() => { setShowFind(false); setShowReplace(false); setFindText(""); textareaRef.current?.focus(); }} className="p-1 rounded text-[#6272a4] hover:text-[#f8f8f2] ml-auto" title="Close (Escape)">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Go to Line bar */}
            {showGoToLine && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#21222c] border-b border-[#44475a]">
                    <Hash className="w-3.5 h-3.5 text-[#6272a4] shrink-0" />
                    <span className="text-[12px] text-[#6272a4]">Go to Line:</span>
                    <input
                        ref={goToLineInputRef}
                        value={goToLineValue}
                        onChange={(e) => setGoToLineValue(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") doGoToLine();
                            if (e.key === "Escape") { setShowGoToLine(false); setGoToLineValue(""); textareaRef.current?.focus(); }
                        }}
                        placeholder={`1 – ${lineCount}`}
                        className="bg-[#282a36] border border-[#44475a] text-[#f8f8f2] text-[12px] font-mono px-2 py-1 rounded-md outline-none focus:border-[#bd93f9] placeholder:text-[#6272a4] w-32"
                    />
                    <button onClick={doGoToLine} className="text-[11px] px-2 py-1 rounded-md bg-[#44475a] text-[#f8f8f2] hover:bg-[#6272a4]">Go</button>
                    <button onClick={() => { setShowGoToLine(false); setGoToLineValue(""); textareaRef.current?.focus(); }} className="p-1 rounded text-[#6272a4] hover:text-[#f8f8f2] ml-auto" title="Close (Escape)">
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
                {/* Custom context menu — Dracula style */}
                {ctxMenu && (
                    <div
                        ref={ctxMenuRef}
                        className="absolute z-50 w-56 p-1.5 bg-[#21222c] backdrop-blur-xl border border-[#44475a] rounded-lg shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-100"
                        style={{ left: ctxMenu.x, top: ctxMenu.y }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {ctxItems.map((item, i) => (
                            <div key={i}>
                                <button
                                    disabled={item.disabled}
                                    onClick={() => ctxAction(item.action)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-[#f8f8f2] transition-colors hover:bg-[#44475a] hover:text-[#f8f8f2] disabled:text-[#6272a4] disabled:pointer-events-none"
                                >
                                    <span className="w-4 h-4 flex items-center justify-center text-[#bd93f9]">
                                        {item.icon}
                                    </span>
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.shortcut && (
                                        <span className="text-[11px] text-[#6272a4] ml-auto pl-3 tracking-wide">
                                            {item.shortcut}
                                        </span>
                                    )}
                                </button>
                                {item.separator && <div className="my-1 h-px bg-[#44475a]" />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Line number gutter — Dracula style */}
                <div
                    ref={gutterRef}
                    className="shrink-0 overflow-hidden select-none pointer-events-none bg-[#282a36] border-r border-[#44475a]"
                    style={{ width: gutterWidth }}
                    aria-hidden
                >
                    <div className="py-[10px]">
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div
                                key={i}
                                className={`px-2 text-right font-mono leading-[20px] text-[12px] ${i + 1 === cursorLine ? "text-[#f8f8f2]" : "text-[#6272a4]"}`}
                                style={{ height: 20 }}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Textarea — Dracula foreground */}
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
                    className="flex-1 resize-none bg-[#282a36] text-[#f8f8f2] text-[13px] font-mono p-[10px] outline-none leading-[20px] caret-[#f8f8f2] placeholder:text-[#6272a4] selection:bg-[#44475a]"
                    style={{
                        whiteSpace: wordWrap ? "pre-wrap" : "pre",
                        overflowWrap: wordWrap ? "break-word" : "normal",
                        overflowX: wordWrap ? "hidden" : "auto",
                        tabSize: 2,
                    }}
                    placeholder="File is empty"
                />
            </div>

            {/* Status bar — VS Code style with Dracula blue accent */}
            <div className="flex items-center justify-between px-3 py-1 bg-[#191a21] border-t border-[#44475a] text-[11px] text-[#6272a4] select-none">
                <div className="flex items-center gap-3">
                    <span className="bg-[#bd93f9] text-[#282a36] px-2 py-0.5 rounded-sm font-semibold -ml-3 -my-1">{lang}</span>
                    <span>UTF-8</span>
                    <span>{wordWrap ? "Wrap" : "No Wrap"}</span>
                    {lastSaved && (
                        <span className="text-[#50fa7b]">
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span>Ln {cursorLine}, Col {cursorCol}</span>
                    <span>{lineCount} lines</span>
                    <span>{content.length.toLocaleString()} chars</span>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        className="hidden sm:inline text-[#6272a4] hover:text-[#bd93f9] transition-colors cursor-pointer"
                    >
                        Ctrl+S save · Ctrl+F find · Ctrl+G go to line · ? help
                    </button>
                </div>
            </div>

            {/* Shortcuts / Help Modal */}
            {showShortcuts && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
                    <div
                        className="bg-[#21222c] border border-[#44475a] rounded-xl shadow-2xl shadow-black/50 w-[560px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-[#44475a]">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-[#bd93f9]" />
                                <span className="text-[14px] font-semibold text-[#f8f8f2]">Keyboard Shortcuts & Help</span>
                            </div>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="p-1 rounded-md text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Modal body */}
                        <div className="overflow-y-auto p-5 space-y-5">
                            {shortcutGroups.map((group) => (
                                <div key={group.title}>
                                    <h3 className="text-[12px] font-semibold text-[#bd93f9] uppercase tracking-wider mb-2">{group.title}</h3>
                                    <div className="space-y-1">
                                        {group.items.map((item) => (
                                            <div key={item.keys} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[#282a36] transition-colors">
                                                <span className="text-[13px] text-[#f8f8f2]">{item.desc}</span>
                                                <div className="flex items-center gap-1">
                                                    {item.keys.split("+").map((key, ki) => (
                                                        <span key={ki}>
                                                            <kbd className="px-1.5 py-0.5 rounded bg-[#282a36] border border-[#44475a] text-[11px] font-mono text-[#f8f8f2] shadow-sm">
                                                                {key.trim()}
                                                            </kbd>
                                                            {ki < item.keys.split("+").length - 1 && (
                                                                <span className="text-[#6272a4] text-[10px] mx-0.5">+</span>
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
                            <div className="border-t border-[#44475a] pt-4">
                                <h3 className="text-[12px] font-semibold text-[#50fa7b] uppercase tracking-wider mb-2">Tips</h3>
                                <ul className="space-y-1.5 text-[12px] text-[#f8f8f2]/80">
                                    <li className="flex items-start gap-2"><span className="text-[#bd93f9] mt-0.5">•</span> Right-click anywhere in the editor for the full context menu with all actions</li>
                                    <li className="flex items-start gap-2"><span className="text-[#bd93f9] mt-0.5">•</span> Select text first to enable Cut, Copy, Uppercase, and Lowercase actions</li>
                                    <li className="flex items-start gap-2"><span className="text-[#bd93f9] mt-0.5">•</span> Typing a bracket character while text is selected will wrap the selection</li>
                                    <li className="flex items-start gap-2"><span className="text-[#bd93f9] mt-0.5">•</span> Use the Find bar with Enter/Shift+Enter to navigate between matches</li>
                                    <li className="flex items-start gap-2"><span className="text-[#bd93f9] mt-0.5">•</span> The editor auto-indents on Enter, matching the current line's indentation</li>
                                    <li className="flex items-start gap-2"><span className="text-[#bd93f9] mt-0.5">•</span> Unsaved changes show an orange dot next to the filename</li>
                                </ul>
                            </div>
                        </div>
                        {/* Modal footer */}
                        <div className="px-5 py-2.5 border-t border-[#44475a] flex justify-end">
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="text-[12px] px-4 py-1.5 rounded-md bg-[#bd93f9] text-[#282a36] font-medium hover:bg-[#caa9fa] transition-colors"
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
