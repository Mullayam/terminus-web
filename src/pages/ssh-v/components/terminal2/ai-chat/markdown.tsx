/**
 * Lightweight inline markdown renderer shared by the AI chat panel and the
 * agent run panel (no external dependencies).
 * Handles: **bold**, *italic*, `code`, [links](url), headers (##),
 *          bullet/numbered lists, --- and ``` fenced blocks.
 */

type Colors = Record<string, string>;

export function renderMarkdownLine(line: string, colors: Colors, keyBase: string) {
  const tokens: React.ReactNode[] = [];
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    if (match[2]) {
      tokens.push(
        <strong key={`${keyBase}-b-${match.index}`} style={{ color: colors.foreground, fontWeight: 600 }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      tokens.push(
        <em key={`${keyBase}-i-${match.index}`} style={{ opacity: 0.9 }}>
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      tokens.push(
        <code
          key={`${keyBase}-c-${match.index}`}
          className="px-1 py-0.5 rounded text-[10px] font-mono"
          style={{ backgroundColor: `${colors.foreground}12`, color: colors.cyan }}
        >
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      tokens.push(
        <a
          key={`${keyBase}-a-${match.index}`}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:brightness-125"
          style={{ color: colors.blue }}
        >
          {match[5]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens.length > 0 ? tokens : [line];
}

export function renderMarkdownBlock(text: string, colors: Colors, keyPrefix: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type === 'ol' ? 'ol' : 'ul';
    elements.push(
      <Tag
        key={`${keyPrefix}-list-${elements.length}`}
        className={`text-[11px] leading-relaxed pl-4 my-1 ${listBuffer.type === 'ol' ? 'list-decimal' : 'list-disc'}`}
        style={{ color: `${colors.foreground}cc` }}
      >
        {listBuffer.items.map((item, li) => (
          <li key={li} className="py-0.5">{item}</li>
        ))}
      </Tag>,
    );
    listBuffer = null;
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr key={`${keyPrefix}-hr-${li}`} className="my-2 border-t" style={{ borderColor: `${colors.foreground}15` }} />,
      );
      continue;
    }

    // Headers (h1–h4)
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const sizes = ['text-sm font-bold', 'text-xs font-bold', 'text-xs font-semibold', 'text-[11px] font-semibold'];
      elements.push(
        <div
          key={`${keyPrefix}-h-${li}`}
          className={`${sizes[level - 1] ?? sizes[3]} mt-2 mb-1`}
          style={{ color: colors.foreground }}
        >
          {renderMarkdownLine(headerMatch[2], colors, `${keyPrefix}-h-${li}`)}
        </div>,
      );
      continue;
    }

    // Unordered list item (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(renderMarkdownLine(ulMatch[1], colors, `${keyPrefix}-ul-${li}`));
      continue;
    }

    // Ordered list item (1. 2. etc)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(renderMarkdownLine(olMatch[1], colors, `${keyPrefix}-ol-${li}`));
      continue;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`${keyPrefix}-br-${li}`} className="h-1.5" />);
      continue;
    }

    // Regular paragraph line
    flushList();
    elements.push(
      <span key={`${keyPrefix}-p-${li}`} className="block text-[11px] leading-relaxed">
        {renderMarkdownLine(trimmed, colors, `${keyPrefix}-p-${li}`)}
      </span>,
    );
  }
  flushList();
  return elements;
}

/** Renders markdown text including ``` fenced code blocks. */
export function MarkdownText({
  text,
  colors,
  keyPrefix = 'md',
}: {
  text: string;
  colors: Colors;
  keyPrefix?: string;
}) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        const codeMatch = part.match(/^```(?:\w*)\n?([\s\S]*?)```$/);
        if (codeMatch) {
          return (
            <pre
              key={`${keyPrefix}-code-${i}`}
              className="my-1.5 px-2 py-1.5 rounded text-[10px] font-mono overflow-x-auto"
              style={{
                backgroundColor: `${colors.foreground}08`,
                color: colors.green,
                border: `1px solid ${colors.foreground}12`,
              }}
            >
              {codeMatch[1].trim()}
            </pre>
          );
        }
        return <div key={`${keyPrefix}-t-${i}`}>{renderMarkdownBlock(part, colors, `${keyPrefix}-${i}`)}</div>;
      })}
    </>
  );
}
