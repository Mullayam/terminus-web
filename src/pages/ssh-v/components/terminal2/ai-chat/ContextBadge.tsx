import { X } from 'lucide-react';

/** Shows what will be sent along with the next message: selection wins over the full screen. */
export function ContextBadge({
  selection,
  screenContent,
  colors,
  onClearSelection,
}: {
  selection: string;
  screenContent: string;
  colors: Record<string, string>;
  onClearSelection: () => void;
}) {
  if (selection) {
    return (
      <div
        className="mx-4 mb-1 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px]"
        style={{
          backgroundColor: `${colors.yellow}12`,
          color: colors.yellow,
          border: `1px solid ${colors.yellow}25`,
        }}
      >
        <span className="flex-1 truncate">📎 Selection attached ({selection.length} chars)</span>
        <button onClick={onClearSelection} className="p-0.5 rounded hover:bg-white/10">
          <X size={10} />
        </button>
      </div>
    );
  }

  if (!screenContent) return null;

  return (
    <div
      className="mx-4 mb-1 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px]"
      style={{
        backgroundColor: `${colors.cyan}12`,
        color: colors.cyan,
        border: `1px solid ${colors.cyan}25`,
      }}
    >
      <span className="flex-1 truncate">🖥 Full screen context ({screenContent.length} chars)</span>
    </div>
  );
}

export default ContextBadge;
