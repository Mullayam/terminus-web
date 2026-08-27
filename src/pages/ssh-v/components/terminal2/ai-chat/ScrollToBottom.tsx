import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function ScrollToBottom({
  scrollRef,
  colors,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  colors: Record<string, string>;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShow(distanceFromBottom > 100);
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, [scrollRef]);

  if (!show) return null;

  return (
    <button
      onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
      className="absolute bottom-24 right-4 p-1.5 rounded-full shadow-lg transition-all hover:scale-110"
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.foreground}20`,
        color: `${colors.foreground}60`,
      }}
    >
      <ChevronDown size={14} />
    </button>
  );
}

export default ScrollToBottom;
