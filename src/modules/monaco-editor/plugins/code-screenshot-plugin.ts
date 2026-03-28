/**
 * @module monaco-editor/plugins/code-screenshot-plugin
 *
 * Generate a styled code image (PNG) of the selected code for sharing.
 * Uses an off-screen canvas to render syntax-highlighted code with
 * a VS Code-style window chrome.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const PADDING = 32;
const TITLE_BAR_HEIGHT = 36;
const LINE_HEIGHT = 22;
const FONT_SIZE = 14;
const FONT_FAMILY = "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace";
const BG_COLOR = "#1e1e1e";
const TITLE_BAR_COLOR = "#323233";
const DOT_COLORS = ["#ff5f57", "#febc2e", "#28c840"];
const TEXT_COLOR = "#d4d4d4";
const LINE_NUM_COLOR = "#858585";
const BORDER_RADIUS = 12;
const SHADOW_BLUR = 40;
const OUTER_PADDING = 48;

interface TokenColor {
  match: RegExp;
  color: string;
}

// Basic syntax coloring rules (covers most languages visually)
const TOKEN_RULES: TokenColor[] = [
  // Strings (double, single, template)
  { match: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, color: "#ce9178" },
  // Comments (// and /* */)
  { match: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, color: "#6a9955" },
  // Numbers
  { match: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[0-9a-f]+|0b[01]+|0o[0-7]+)\b/gi, color: "#b5cea8" },
  // Keywords
  {
    match: /\b(import|export|from|default|const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|typeof|instanceof|in|of|class|extends|implements|interface|type|enum|async|await|yield|static|public|private|protected|abstract|readonly|override|declare|module|namespace|require|void|null|undefined|true|false|this|super|as|is|keyof|infer)\b/g,
    color: "#569cd6",
  },
  // Built-in types & common globals
  {
    match: /\b(string|number|boolean|object|any|never|unknown|symbol|bigint|Array|Map|Set|Promise|console|document|window|Math|JSON|Date|Error|RegExp|Object|Function|Symbol|Buffer|process)\b/g,
    color: "#4ec9b0",
  },
  // Decorators / annotations
  { match: /(@\w+)/g, color: "#dcdcaa" },
  // Function calls
  { match: /\b(\w+)(?=\s*\()/g, color: "#dcdcaa" },
];

interface ColorSpan {
  start: number;
  end: number;
  color: string;
}

function tokenizeLine(line: string): ColorSpan[] {
  const spans: ColorSpan[] = [];

  for (const rule of TOKEN_RULES) {
    rule.match.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.match.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      spans.push({ start, end, color: rule.color });
    }
  }

  // Sort by start, longer spans first for same start
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping spans (first wins)
  const resolved: ColorSpan[] = [];
  let last = 0;
  for (const s of spans) {
    if (s.start >= last) {
      resolved.push(s);
      last = s.end;
    }
  }
  return resolved;
}

function drawColoredText(
  canvasCtx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
) {
  const spans = tokenizeLine(line);
  let cursor = 0;

  for (const span of spans) {
    // Draw plain text before this span
    if (span.start > cursor) {
      canvasCtx.fillStyle = TEXT_COLOR;
      canvasCtx.fillText(line.slice(cursor, span.start), x, y);
      x += canvasCtx.measureText(line.slice(cursor, span.start)).width;
    }

    // Draw colored span
    canvasCtx.fillStyle = span.color;
    const text = line.slice(span.start, span.end);
    canvasCtx.fillText(text, x, y);
    x += canvasCtx.measureText(text).width;
    cursor = span.end;
  }

  // Remaining text
  if (cursor < line.length) {
    canvasCtx.fillStyle = TEXT_COLOR;
    canvasCtx.fillText(line.slice(cursor), x, y);
  }
}

export const codeScreenshotPlugin: MonacoPlugin = {
  id: "builtin-code-screenshot",
  name: "Code Screenshot",
  version: "1.0.0",
  description: "Generate a styled code image (PNG) of selected code for sharing",

  onMount(ctx: PluginContext) {
    ctx.addAction({
      id: "codeScreenshot.capture",
      label: "Code Screenshot: Capture Selection",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.KeyE,
      ],
      run(editor) {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!model) return;

        let text: string;
        let startLine: number;

        if (selection && !selection.isEmpty()) {
          text = model.getValueInRange(selection);
          startLine = selection.startLineNumber;
        } else {
          text = model.getValue();
          startLine = 1;
        }

        const lines = text.split("\n");
        if (lines.length === 0) return;

        // Determine dimensions
        const canvas = document.createElement("canvas");
        const c = canvas.getContext("2d");
        if (!c) return;

        // Use device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        c.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

        const lineNumWidth = c.measureText(String(startLine + lines.length)).width + 24;
        const maxLineWidth = Math.max(
          ...lines.map((l) => c.measureText(l).width),
          200,
        );

        const contentWidth = lineNumWidth + maxLineWidth + PADDING * 2;
        const contentHeight = TITLE_BAR_HEIGHT + lines.length * LINE_HEIGHT + PADDING;

        const totalWidth = contentWidth + OUTER_PADDING * 2;
        const totalHeight = contentHeight + OUTER_PADDING * 2;

        canvas.width = totalWidth * dpr;
        canvas.height = totalHeight * dpr;
        canvas.style.width = `${totalWidth}px`;
        canvas.style.height = `${totalHeight}px`;
        c.scale(dpr, dpr);

        // Background (transparent + gradient)
        const gradient = c.createLinearGradient(0, 0, totalWidth, totalHeight);
        gradient.addColorStop(0, "#2c2c54");
        gradient.addColorStop(1, "#1a1a2e");
        c.fillStyle = gradient;
        c.fillRect(0, 0, totalWidth, totalHeight);

        // Drop shadow
        c.shadowColor = "rgba(0, 0, 0, 0.5)";
        c.shadowBlur = SHADOW_BLUR;
        c.shadowOffsetX = 0;
        c.shadowOffsetY = 8;

        // Window frame
        const wx = OUTER_PADDING;
        const wy = OUTER_PADDING;

        c.beginPath();
        c.roundRect(wx, wy, contentWidth, contentHeight, BORDER_RADIUS);
        c.fillStyle = BG_COLOR;
        c.fill();

        // Reset shadow
        c.shadowColor = "transparent";
        c.shadowBlur = 0;
        c.shadowOffsetY = 0;

        // Title bar
        c.fillStyle = TITLE_BAR_COLOR;
        c.beginPath();
        c.roundRect(wx, wy, contentWidth, TITLE_BAR_HEIGHT, [BORDER_RADIUS, BORDER_RADIUS, 0, 0]);
        c.fill();

        // Traffic light dots
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.arc(wx + 20 + i * 20, wy + TITLE_BAR_HEIGHT / 2, 6, 0, Math.PI * 2);
          c.fillStyle = DOT_COLORS[i];
          c.fill();
        }

        // Title text
        const filePath = ctx.getFilePath();
        if (filePath) {
          const fileName = filePath.split(/[/\\]/).pop() || "";
          c.font = `12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
          c.fillStyle = "#999";
          c.textAlign = "center";
          c.fillText(fileName, wx + contentWidth / 2, wy + TITLE_BAR_HEIGHT / 2 + 4);
          c.textAlign = "left";
        }

        // Code area
        c.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
        const codeX = wx + PADDING;
        const codeY = wy + TITLE_BAR_HEIGHT + PADDING / 2;

        for (let i = 0; i < lines.length; i++) {
          const y = codeY + i * LINE_HEIGHT + FONT_SIZE;

          // Line number
          c.fillStyle = LINE_NUM_COLOR;
          const lineNum = String(startLine + i);
          const numWidth = c.measureText(lineNum).width;
          c.fillText(lineNum, codeX + lineNumWidth - numWidth - 12, y);

          // Code with syntax highlighting
          drawColoredText(c, lines[i], codeX + lineNumWidth, y);
        }

        // Convert to blob and copy/download
        canvas.toBlob((blob) => {
          if (!blob) {
            ctx.notify("Failed to generate image", "error");
            return;
          }

          // Try copying to clipboard first
          if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
            navigator.clipboard
              .write([new ClipboardItem({ "image/png": blob })])
              .then(() => {
                ctx.notify("Screenshot copied to clipboard!", "success");
              })
              .catch(() => {
                downloadBlob(blob);
              });
          } else {
            downloadBlob(blob);
          }
        }, "image/png");

        function downloadBlob(blob: Blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `code-screenshot-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          ctx.notify("Screenshot downloaded!", "success");
        }
      },
    });
  },
};
