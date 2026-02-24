/**
 * @module editor/core/text-ops
 * Pure text-manipulation functions used by the editor.
 * All functions are stateless – they receive the current content and selection
 * state, and return the new content plus cursor position.
 */

export interface TextSelection {
    start: number;
    end: number;
}

export interface TextOpResult {
    content: string;
    /** New cursor / selection start */
    selStart: number;
    /** New cursor / selection end */
    selEnd: number;
}

// ── Indentation ──────────────────────────────────────────────

/** Indent selected lines by `spaces` characters */
export function indentSelection(
    content: string,
    sel: TextSelection,
    spaces = 2,
): TextOpResult {
    const before = content.substring(0, sel.start);
    const after = content.substring(sel.end);
    const lineStart = before.lastIndexOf("\n") + 1;
    const block = content.substring(lineStart, sel.end);
    const pad = " ".repeat(spaces);
    const indented = block.split("\n").map((l) => pad + l).join("\n");
    return {
        content: content.substring(0, lineStart) + indented + after,
        selStart: sel.start + spaces,
        selEnd: sel.end + indented.length - block.length,
    };
}

/** Remove up to `spaces` leading spaces from selected lines */
export function outdentSelection(
    content: string,
    sel: TextSelection,
    spaces = 2,
): TextOpResult {
    const before = content.substring(0, sel.start);
    const after = content.substring(sel.end);
    const lineStart = before.lastIndexOf("\n") + 1;
    const block = content.substring(lineStart, sel.end);
    const outdented = block
        .split("\n")
        .map((l) => {
            let removed = 0;
            while (removed < spaces && l[removed] === " ") removed++;
            return l.slice(removed);
        })
        .join("\n");
    const removed = block.length - outdented.length;
    return {
        content: content.substring(0, lineStart) + outdented + after,
        selStart: Math.max(lineStart, sel.start - spaces),
        selEnd: sel.end - removed,
    };
}

// ── Line operations ──────────────────────────────────────────

/** Delete the line at cursor position */
export function deleteLine(content: string, cursorPos: number): TextOpResult {
    const before = content.substring(0, cursorPos);
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineEnd = content.indexOf("\n", cursorPos);
    const newContent =
        content.substring(0, lineStart) +
        (lineEnd >= 0 ? content.substring(lineEnd + 1) : "");
    return { content: newContent, selStart: lineStart, selEnd: lineStart };
}

/** Duplicate the line at cursor position */
export function duplicateLine(content: string, cursorPos: number): TextOpResult {
    const before = content.substring(0, cursorPos);
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineEnd = content.indexOf("\n", cursorPos);
    const line = content.substring(lineStart, lineEnd >= 0 ? lineEnd : content.length);
    const newContent =
        content.substring(0, lineEnd >= 0 ? lineEnd : content.length) +
        "\n" +
        line +
        (lineEnd >= 0 ? content.substring(lineEnd) : "");
    const newPos = cursorPos + line.length + 1;
    return { content: newContent, selStart: newPos, selEnd: newPos };
}

/** Move line up */
export function moveLineUp(content: string, cursorPos: number): TextOpResult {
    const allLines = content.split("\n");
    const textBefore = content.substring(0, cursorPos);
    const lineIdx = textBefore.split("\n").length - 1;
    if (lineIdx <= 0) return { content, selStart: cursorPos, selEnd: cursorPos };
    const tmp = allLines[lineIdx];
    allLines[lineIdx] = allLines[lineIdx - 1];
    allLines[lineIdx - 1] = tmp;
    const nc = allLines.join("\n");
    const newPos = Math.max(0, cursorPos - allLines[lineIdx].length - 1);
    return { content: nc, selStart: newPos, selEnd: newPos };
}

/** Move line down */
export function moveLineDown(content: string, cursorPos: number): TextOpResult {
    const allLines = content.split("\n");
    const textBefore = content.substring(0, cursorPos);
    const lineIdx = textBefore.split("\n").length - 1;
    if (lineIdx >= allLines.length - 1) return { content, selStart: cursorPos, selEnd: cursorPos };
    const tmp = allLines[lineIdx];
    allLines[lineIdx] = allLines[lineIdx + 1];
    allLines[lineIdx + 1] = tmp;
    const nc = allLines.join("\n");
    const newPos = cursorPos + allLines[lineIdx].length + 1;
    return { content: nc, selStart: newPos, selEnd: newPos };
}

// ── Toggle comment ───────────────────────────────────────────

/** Toggle // line comment on selected lines */
export function toggleLineComment(content: string, sel: TextSelection): TextOpResult {
    const before = content.substring(0, sel.start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineEnd = content.indexOf("\n", sel.end);
    const block = content.substring(lineStart, lineEnd >= 0 ? lineEnd : content.length);
    const blockLines = block.split("\n");
    const allCommented = blockLines.every((l) => l.trimStart().startsWith("//"));

    const toggled = blockLines
        .map((l) => {
            if (allCommented) {
                const idx = l.indexOf("//");
                return l.substring(0, idx) + l.substring(idx + 2 + (l[idx + 2] === " " ? 1 : 0));
            }
            const match = l.match(/^(\s*)/);
            const indent = match ? match[1] : "";
            return indent + "// " + l.substring(indent.length);
        })
        .join("\n");

    const nc =
        content.substring(0, lineStart) +
        toggled +
        (lineEnd >= 0 ? content.substring(lineEnd) : "");
    return { content: nc, selStart: lineStart, selEnd: lineStart + toggled.length };
}

// ── Sort lines ───────────────────────────────────────────────

/** Sort the selected (or current) lines alphabetically */
export function sortLines(content: string, sel: TextSelection): TextOpResult {
    const before = content.substring(0, sel.start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineEnd = content.indexOf("\n", sel.end);
    const block = content.substring(lineStart, lineEnd >= 0 ? lineEnd : content.length);
    const sorted = block.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
    const nc =
        content.substring(0, lineStart) +
        sorted +
        (lineEnd >= 0 ? content.substring(lineEnd) : "");
    return { content: nc, selStart: lineStart, selEnd: lineStart + sorted.length };
}

// ── Case transforms ──────────────────────────────────────────

export function toUpperCase(content: string, sel: TextSelection): TextOpResult {
    const selected = content.substring(sel.start, sel.end).toUpperCase();
    return {
        content: content.substring(0, sel.start) + selected + content.substring(sel.end),
        selStart: sel.start,
        selEnd: sel.start + selected.length,
    };
}

export function toLowerCase(content: string, sel: TextSelection): TextOpResult {
    const selected = content.substring(sel.start, sel.end).toLowerCase();
    return {
        content: content.substring(0, sel.start) + selected + content.substring(sel.end),
        selStart: sel.start,
        selEnd: sel.start + selected.length,
    };
}

// ── Trim whitespace ──────────────────────────────────────────

export function trimTrailingWhitespace(content: string): string {
    return content.split("\n").map((l) => l.trimEnd()).join("\n");
}

// ── Auto-indent on Enter ─────────────────────────────────────

/** Produce the insertion string for Enter (with matching indentation) */
export function autoIndentNewline(content: string, cursorPos: number): TextOpResult {
    const before = content.substring(0, cursorPos);
    const currentLine = before.substring(before.lastIndexOf("\n") + 1);
    const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";
    const insert = "\n" + indent;
    return {
        content: content.substring(0, cursorPos) + insert + content.substring(cursorPos),
        selStart: cursorPos + insert.length,
        selEnd: cursorPos + insert.length,
    };
}

// ── Tab handling ─────────────────────────────────────────────

/** Insert spaces at cursor or outdent if shift */
export function handleTab(
    content: string,
    sel: TextSelection,
    shift: boolean,
    spaces = 2,
): TextOpResult {
    if (shift) {
        return outdentSelection(content, sel, spaces);
    }
    const pad = " ".repeat(spaces);
    const nc = content.substring(0, sel.start) + pad + content.substring(sel.end);
    return { content: nc, selStart: sel.start + spaces, selEnd: sel.start + spaces };
}

// ── Bracket auto-close ──────────────────────────────────────

const BRACKET_PAIRS: Record<string, string> = {
    "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`",
};

/**
 * If the pressed key is an opener and text is selected, wrap selection.
 * Returns null if no wrapping is applicable.
 */
export function wrapWithBrackets(
    content: string,
    sel: TextSelection,
    key: string,
): TextOpResult | null {
    const closing = BRACKET_PAIRS[key];
    if (!closing || sel.start === sel.end) return null;
    const selected = content.substring(sel.start, sel.end);
    const nc = content.substring(0, sel.start) + key + selected + closing + content.substring(sel.end);
    return { content: nc, selStart: sel.start + 1, selEnd: sel.end + 1 };
}

// ── Cursor position helpers ─────────────────────────────────

/** Compute line and column from a flat cursor position */
export function cursorToLineCol(content: string, pos: number): { line: number; col: number } {
    const before = content.substring(0, pos);
    const line = before.split("\n").length;
    const col = pos - before.lastIndexOf("\n");
    return { line, col };
}

/** Compute flat cursor position from line number (1-based) */
export function lineToPosition(content: string, lineNum: number): number {
    const lines = content.split("\n");
    const target = Math.min(Math.max(1, lineNum), lines.length);
    let pos = 0;
    for (let i = 0; i < target - 1; i++) pos += lines[i].length + 1;
    return pos;
}

// ── Cut / Copy / Paste helpers ──────────────────────────────

export function cutSelection(
    content: string,
    sel: TextSelection,
): { result: TextOpResult; cutText: string } {
    const cutText = content.substring(sel.start, sel.end);
    const nc = content.substring(0, sel.start) + content.substring(sel.end);
    return {
        result: { content: nc, selStart: sel.start, selEnd: sel.start },
        cutText,
    };
}

export function pasteAtSelection(
    content: string,
    sel: TextSelection,
    text: string,
): TextOpResult {
    const nc = content.substring(0, sel.start) + text + content.substring(sel.end);
    const pos = sel.start + text.length;
    return { content: nc, selStart: pos, selEnd: pos };
}
