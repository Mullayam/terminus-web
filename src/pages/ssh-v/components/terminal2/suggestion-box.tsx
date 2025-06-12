
import type React from "react"
import { useCommandStore } from "@/store";

interface SuggestionBoxProps {
  suggestionPos: { top: number; left: number }
  suggestions: string[]
  isVisible?: boolean
  terminalHeight: number;
  terminalWidth: number;
  setSuggestions: React.Dispatch<React.SetStateAction<string[]>>
}

const AISuggestionBox: React.FC<SuggestionBoxProps> = ({ terminalHeight,setSuggestions, terminalWidth, suggestionPos, suggestions, isVisible = true }) => {
  const { setCommand } = useCommandStore();
  const BOX_HEIGHT = 160;
  const BOX_WIDTH = 280;
  const OUTER_PADDING = 16; // p-2 = 0.5rem = 8px per side, total 16px
  const GAP = 30


  const handleCommandClick = (command: string) => {
    setCommand(command, "single");
  };

  if (!isVisible) return null;

  // Horizontal position
  const fitsRight = suggestionPos.left + BOX_WIDTH < terminalWidth;
  const adjustedLeft = fitsRight
    ? suggestionPos.left
    : Math.max(0, terminalWidth - BOX_WIDTH - 10); // 10px padding

  // Vertical position
  const fitsBelow = suggestionPos.top + BOX_HEIGHT + GAP < terminalHeight;
  const adjustedTop = fitsBelow
    ? suggestionPos.top + 8
    : suggestionPos.top - BOX_HEIGHT - GAP;
  return (
    <div
      className="absolute bg-[#1a1b26] border border-[#2c2d3c] rounded-lg text-green-400 z-50 p-2"
      style={{
        top: adjustedTop,
        left: suggestionPos.left,
        width: BOX_WIDTH,
        height: BOX_HEIGHT,
        overflow: "hidden", // Prevent scroll area from overflowing
      }}
    >
      <div
        className="overflow-y-auto scrollbar-thin  scrollbar-green"
        style={{ height: BOX_HEIGHT-OUTER_PADDING }}
      >
        {suggestions.map((command, index) => (
          <div
            key={index}
            className="group flex justify-between items-center font-mono whitespace-nowrap overflow-hidden hover:bg-[#2a2b36] px-2 py-1 rounded text-xs transition-colors duration-150 border-b border-[#2a2b36] last:border-b-0 text-green-400 hover:text-green-300 cursor-pointer"
            onClick={() => handleCommandClick(command)}
          >
            <span className="truncate">{command}</span>

            {/* Cross button - visible only on hover */}
            <button
              className="ml-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setSuggestions((prevSuggestions) =>
                  prevSuggestions.filter((suggestion) => suggestion !== command)
                );
              }}
            >
              ×
            </button>
          </div>

        ))}
      </div>
    </div>

  )
}


export default AISuggestionBox
