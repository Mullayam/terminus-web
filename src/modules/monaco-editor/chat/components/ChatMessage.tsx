/**
 * @module monaco-editor/chat/components/ChatMessage
 *
 * Renders a single chat message (user or assistant).
 * Assistant messages support markdown rendering with syntax-highlighted
 * code blocks and "Apply" / "Reject" actions for code suggestions.
 */

import React, { useMemo } from "react";
import {
  User,
  Bot,
  AlertCircle,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import type { ChatMessage as ChatMessageType, CodeBlock } from "../types";

/* ── Props ─────────────────────────────────────────────────── */

export interface ChatMessageProps {
  message: ChatMessageType;
  /** Called when the user clicks "Apply" on a code block */
  onApplyCode?: (code: string, language: string, blockIndex: number) => void;
  /** Called when the user clicks "Reject" on a code block */
  onRejectCode?: (blockIndex: number) => void;
  /** Called when the user copies content */
  onCopy?: (text: string) => void;
}

/* ── Simple markdown-to-JSX renderer ──────────────────────── */

function renderMarkdown(
  content: string,
  codeBlocks: CodeBlock[] | undefined,
  onApplyCode?: (code: string, language: string, blockIndex: number) => void,
  onRejectCode?: (blockIndex: number) => void,
  onCopy?: (text: string) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockIdx = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      const textSegment = content.slice(lastIndex, match.index);
      parts.push(<TextSegment key={`text-${lastIndex}`} text={textSegment} />);
    }

    const language = match[1] || "plaintext";
    const code = match[2].trimEnd();
    const currentBlockIdx = blockIdx;
    const block = codeBlocks?.[currentBlockIdx];

    parts.push(
      <CodeBlockView
        key={`code-${match.index}`}
        language={language}
        code={code}
        accepted={block?.accepted}
        onApply={
          onApplyCode
            ? () => onApplyCode(code, language, currentBlockIdx)
            : undefined
        }
        onReject={
          onRejectCode ? () => onRejectCode(currentBlockIdx) : undefined
        }
        onCopy={onCopy ? () => onCopy(code) : undefined}
      />,
    );

    lastIndex = match.index + match[0].length;
    blockIdx++;
  }

  // Remaining text after last code block
  if (lastIndex < content.length) {
    parts.push(
      <TextSegment key={`text-${lastIndex}`} text={content.slice(lastIndex)} />,
    );
  }

  return parts;
}

/* ── Text segment (inline markdown) ───────────────────────── */

const TextSegment: React.FC<{ text: string }> = ({ text }) => {
  // Handle inline code, bold, italic, links
  const rendered = useMemo(() => {
    const segments: React.ReactNode[] = [];
    const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = inlineRegex.exec(text)) !== null) {
      if (m.index > last) {
        segments.push(text.slice(last, m.index));
      }

      if (m[1]) {
        // Inline code
        segments.push(
          <code
            key={m.index}
            className="px-1 py-0.5 rounded bg-[#1e1e1e] text-[#ce9178] text-[12px] font-mono"
          >
            {m[1].slice(1, -1)}
          </code>,
        );
      } else if (m[2]) {
        // Bold
        segments.push(
          <strong key={m.index} className="font-semibold text-gray-200">
            {m[2].slice(2, -2)}
          </strong>,
        );
      } else if (m[3]) {
        // Italic
        segments.push(
          <em key={m.index} className="italic text-gray-300">
            {m[3].slice(1, -1)}
          </em>,
        );
      } else if (m[4]) {
        // Link
        const linkMatch = m[4].match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          segments.push(
            <a
              key={m.index}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4fc1ff] hover:underline"
            >
              {linkMatch[1]}
            </a>,
          );
        }
      }

      last = m.index + m[0].length;
    }

    if (last < text.length) {
      segments.push(text.slice(last));
    }

    return segments;
  }, [text]);

  return (
    <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-gray-300" style={{ overflowWrap: "anywhere" }}>
      {rendered}
    </div>
  );
};

/* ── Code block view ──────────────────────────────────────── */

const CodeBlockView: React.FC<{
  language: string;
  code: string;
  accepted?: boolean;
  onApply?: () => void;
  onReject?: () => void;
  onCopy?: () => void;
}> = ({ language, code, accepted, onApply, onReject, onCopy }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    });
  };

  return (
    <div className="my-2 rounded-md border border-[#3c3c3c] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-[#3c3c3c]">
        <span className="text-[11px] text-gray-500 font-mono uppercase">
          {language}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#404040] text-gray-500 hover:text-gray-300 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className="p-3 bg-[#1e1e1e] overflow-x-auto text-[12px] font-mono leading-relaxed text-gray-300">
        <code>{code}</code>
      </pre>

      {/* Apply / Reject actions */}
      {(onApply || onReject) && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] border-t border-[#3c3c3c]">
          {accepted === true && (
            <span className="text-[11px] text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Applied
            </span>
          )}
          {accepted === false && (
            <span className="text-[11px] text-gray-500">Rejected</span>
          )}
          {accepted === undefined && (
            <>
              {onApply && (
                <button
                  onClick={onApply}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[#007acc] text-white hover:bg-[#0098ff] transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Apply
                </button>
              )}
              {onReject && (
                <button
                  onClick={onReject}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-transparent text-gray-500 hover:text-gray-300 hover:bg-[#404040] transition-colors border border-[#3c3c3c]"
                >
                  Reject
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main Component ────────────────────────────────────────── */

export const ChatMessageView: React.FC<ChatMessageProps> = ({
  message,
  onApplyCode,
  onRejectCode,
  onCopy,
}) => {
  const isUser = message.role === "user";
  const isStreaming = message.streaming;

  return (
    <div
      className={`flex gap-3 px-4 py-3 overflow-hidden ${
        isUser ? "bg-transparent" : "bg-[#1e1e1e]/50"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
          isUser ? "bg-[#007acc]" : "bg-[#6a4c93]"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Role label */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isUser ? "You" : "Assistant"}
          </span>
          {message.model && (
            <span className="text-[10px] text-gray-600">{message.model}</span>
          )}
          {isStreaming && (
            <Loader2 className="w-3 h-3 text-[#007acc] animate-spin" />
          )}
        </div>

        {/* Error state */}
        {message.error && (
          <div className="flex items-start gap-2 px-3 py-2 mb-2 rounded bg-red-500/10 border border-red-500/30 overflow-hidden">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="text-[12px] text-red-300 break-all overflow-hidden">{message.error}</span>
          </div>
        )}

        {/* Message content */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-gray-200" style={{ overflowWrap: "anywhere" }}>
            {message.content}
          </div>
        ) : (
          <div>
            {renderMarkdown(
              message.content,
              message.codeBlocks,
              onApplyCode,
              onRejectCode,
              onCopy,
            )}
            {isStreaming && message.content.length === 0 && !message.error && (
              <div className="flex items-center gap-2 text-gray-500 text-[12px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-1 text-[10px] text-gray-600">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

ChatMessageView.displayName = "ChatMessageView";
