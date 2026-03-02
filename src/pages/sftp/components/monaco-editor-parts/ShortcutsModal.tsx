/**
 * Keyboard shortcuts modal for the Monaco editor page.
 * Pure presentational — no side-effects, safe to React.memo.
 */
import React from "react";
import { Info, X } from "lucide-react";

const SHORTCUT_GROUPS = [
    {
        title: "File",
        items: [
            { keys: "Ctrl+S", desc: "Save file" },
            { keys: "Ctrl+F", desc: "Find" },
            { keys: "Ctrl+H", desc: "Find & Replace" },
            { keys: "Ctrl+G", desc: "Go to Line" },
            { keys: "Ctrl+P", desc: "Quick Open (Command Palette)" },
        ],
    },
    {
        title: "Editing",
        items: [
            { keys: "Ctrl+Z", desc: "Undo" },
            { keys: "Ctrl+Shift+Z", desc: "Redo" },
            { keys: "Ctrl+X", desc: "Cut line / selection" },
            { keys: "Ctrl+C", desc: "Copy line / selection" },
            { keys: "Ctrl+Shift+K", desc: "Delete line" },
            { keys: "Ctrl+D", desc: "Select next occurrence" },
            { keys: "Ctrl+/", desc: "Toggle line comment" },
            { keys: "Ctrl+Shift+A", desc: "Toggle block comment" },
        ],
    },
    {
        title: "Navigation",
        items: [
            { keys: "Alt+Up", desc: "Move line up" },
            { keys: "Alt+Down", desc: "Move line down" },
            { keys: "Alt+Shift+Up", desc: "Copy line up" },
            { keys: "Alt+Shift+Down", desc: "Copy line down" },
            { keys: "Ctrl+Shift+\\", desc: "Jump to bracket" },
        ],
    },
    {
        title: "Multi-cursor",
        items: [
            { keys: "Alt+Click", desc: "Add cursor" },
            { keys: "Ctrl+Alt+Up", desc: "Add cursor above" },
            { keys: "Ctrl+Alt+Down", desc: "Add cursor below" },
            { keys: "Ctrl+Shift+L", desc: "Select all occurrences" },
        ],
    },
] as const;

interface ShortcutsModalProps {
    onClose: () => void;
}

function ShortcutsModalInner({ onClose }: ShortcutsModalProps) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="rounded-xl shadow-2xl shadow-black/50 w-[560px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col bg-[#252526] border border-[#3c3c3c]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#3c3c3c]">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-[14px] font-semibold text-gray-200">
                            Keyboard Shortcuts
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#3c3c3c] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-5 space-y-5">
                    {SHORTCUT_GROUPS.map((group) => (
                        <div key={group.title}>
                            <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2 text-blue-400">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <div
                                        key={item.keys}
                                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[#1e1e1e] transition-colors"
                                    >
                                        <span className="text-[13px] text-gray-200">
                                            {item.desc}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {item.keys.split("+").map((key, ki) => (
                                                <span key={ki}>
                                                    <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm bg-[#1e1e1e] border border-[#3c3c3c] text-gray-200">
                                                        {key.trim()}
                                                    </kbd>
                                                    {ki < item.keys.split("+").length - 1 && (
                                                        <span className="text-[10px] mx-0.5 text-gray-500">
                                                            +
                                                        </span>
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
                    <div className="pt-4 border-t border-[#3c3c3c]">
                        <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2 text-green-400">
                            Tips
                        </h3>
                        <ul className="space-y-1.5 text-[12px] text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                Ctrl+F opens Monaco's built-in find with regex, case-sensitive, and
                                whole word options
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                Ctrl+Shift+P opens the Command Palette for all available actions
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                Use Alt+Click to place multiple cursors for simultaneous editing
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                Ctrl+C/X with no selection copies/cuts the entire current line
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                The minimap on the right gives a bird's-eye view of the full file
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-0.5 text-blue-400">•</span>
                                Unsaved changes show an orange dot next to the filename
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-2.5 flex justify-end border-t border-[#3c3c3c]">
                    <button
                        onClick={onClose}
                        className="text-[12px] px-4 py-1.5 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}

export const ShortcutsModal = React.memo(ShortcutsModalInner);
