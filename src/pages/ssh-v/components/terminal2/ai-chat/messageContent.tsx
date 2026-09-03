import { ClipboardPaste, Copy, Play } from 'lucide-react';
import { renderMarkdownBlock } from './markdown';

const AGENT_TOKENS = /\[TASK_COMPLETE\]|\[TASK_BLOCKED\]|\[USER_INPUT_NEEDED\]|\[STILL_TO_DO\]/g;

/** Control tokens are protocol, not prose — never show them to the user. */
export function cleanAgentTokens(text: string): string {
  return text.replace(AGENT_TOKENS, '').trim();
}

/** Render message text, turning fenced blocks into runnable command cards. */
export function renderContent(
  text: string,
  colors: Record<string, string>,
  onExecute: (cmd: string) => void,
  onPaste: (cmd: string) => void,
) {
  if (!text) return null;
  text = cleanAgentTokens(text);
  if (!text) return null;
  // Also split on an unterminated trailing fence so a code block that is still
  // streaming (opening ``` without its closing ``` yet) isn't shown as raw text.
  const parts = text.split(/(```[\s\S]*?```|```[\s\S]*$)/g);

  return parts.map((part, i) => {
    // Match a closed fence, or (while streaming) an unterminated open fence.
    const codeMatch =
      part.match(/^```(?:\w*)\n?([\s\S]*?)```$/) ??
      part.match(/^```(?:\w*)\n?([\s\S]*)$/);
    if (codeMatch) {
      const code = codeMatch[1].trim();
      return (
        <div
          key={i}
          className="my-2 rounded-md overflow-hidden border"
          style={{ borderColor: `${colors.foreground}15` }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[10px]"
            style={{ backgroundColor: `${colors.foreground}08`, color: `${colors.foreground}60` }}
          >
            <span>command</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Copy"
              >
                <Copy size={11} />
              </button>
              <button
                onClick={() => onPaste(code)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Paste in terminal"
              >
                <ClipboardPaste size={11} />
              </button>
              <button
                onClick={() => onExecute(code)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Execute in terminal"
              >
                <Play size={11} />
              </button>
            </div>
          </div>
          <pre
            className="px-3 py-2 text-xs font-mono overflow-x-auto"
            style={{ backgroundColor: `${colors.foreground}05`, color: colors.green }}
          >
            {code}
          </pre>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 border-t"
            style={{ borderColor: `${colors.foreground}10`, backgroundColor: `${colors.foreground}05` }}
          >
            <button
              onClick={() => onExecute(code)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
              style={{ backgroundColor: `${colors.green}18`, color: colors.green }}
              title="Execute in terminal"
            >
              <Play size={10} />
              Run
            </button>
            <button
              onClick={() => onPaste(code)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
              style={{ backgroundColor: `${colors.yellow}18`, color: colors.yellow }}
              title="Paste in terminal"
            >
              <ClipboardPaste size={10} />
              Paste
            </button>
          </div>
        </div>
      );
    }
    // Markdown text between code blocks
    return <span key={i}>{renderMarkdownBlock(part, colors, `md-${i}`)}</span>;
  });
}
