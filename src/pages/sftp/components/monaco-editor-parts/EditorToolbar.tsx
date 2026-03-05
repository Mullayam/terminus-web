/**
 * Toolbar (top bar) for the Monaco editor page.
 * Memoized — only re-renders when its specific props change.
 */
import React, { useState, useEffect } from "react";
import { Loader2, Save, WrapText, RefreshCw, Info, Columns2, Sparkles } from "lucide-react";
import FileIcon from "@/components/FileIcon";
import { ThemePicker, type ThemeId } from "./ThemePicker";
import { ChangelogModal } from "./ChangelogModal";

const CHANGELOG_DISMISSED_KEY = "terminus-changelog-dismissed-v2";

interface EditorToolbarProps {
    currentFileName: string;
    currentFilePath: string;
    modified: boolean;
    loading: boolean;
    saving: boolean;
    wordWrap: boolean;
    themeId: ThemeId;
    showThemePicker: boolean;
    canSplit: boolean;
    onReload: () => void;
    onToggleWordWrap: () => void;
    onToggleThemePicker: () => void;
    onThemeSelect: (id: ThemeId) => void;
    onShowShortcuts: () => void;
    onSave: () => void;
    onSplit: () => void;
}

function EditorToolbarInner({
    currentFileName,
    currentFilePath,
    modified,
    loading,
    saving,
    wordWrap,
    themeId,
    showThemePicker,
    canSplit,
    onReload,
    onToggleWordWrap,
    onToggleThemePicker,
    onThemeSelect,
    onShowShortcuts,
    onSave,
    onSplit,
}: EditorToolbarProps) {
    const [showChangelog, setShowChangelog] = useState(false);
    const [badgeDismissed, setBadgeDismissed] = useState(() => {
        try { return localStorage.getItem(CHANGELOG_DISMISSED_KEY) === "1"; }
        catch { return false; }
    });

    useEffect(() => {
        if (badgeDismissed) {
            try { localStorage.setItem(CHANGELOG_DISMISSED_KEY, "1"); }
            catch { /* noop */ }
        }
    }, [badgeDismissed]);

    const handleOpenChangelog = () => {
        setShowChangelog(true);
        setBadgeDismissed(true);
    };

    return (
        <>
        <div
            className="flex items-center justify-between px-3 py-1.5 shrink-0 select-none"
            style={{
                background: "var(--editor-sidebar-bg, #252526)",
                borderBottom: "1px solid var(--editor-border, #3c3c3c)",
                color: "var(--editor-fg, #d4d4d4)",
            }}
        >            {/* Left: file info */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden ">
                <span className="flex items-center space-x-1">
                    <FileIcon name={currentFileName} isDirectory={false} className="w-4 h-4" />
                    <span className="text-[13px] font-medium truncate text-gray-200 select-text">
                        {currentFileName}
                    </span>
                </span>
                {modified && (
                    <span
                        className="w-2 h-2 rounded-full shrink-0 bg-orange-400"
                        title="Unsaved changes"
                    />
                )}
                <span className="text-[11px] font-mono truncate hidden sm:inline text-gray-500 select-text">
                    {currentFilePath}
                </span>
            </div>

            {/* Center: announcement badge */}
            <button
                onClick={handleOpenChangelog}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer shrink-0"
                style={{
                    background: badgeDismissed
                        ? "var(--editor-hover-bg, #2d2d2d)"
                        : "var(--editor-accent, #007acc)",
                    color: badgeDismissed ? "var(--editor-fg, #999)" : "#fff",
                    border: badgeDismissed
                        ? "1px solid var(--editor-border, #3c3c3c)"
                        : "1px solid transparent",
                }}
                title="View changelog"
            >
                <Sparkles className="w-3 h-3" />
                <span>{badgeDismissed ? "Changelog" : "Try new features!"}</span>
                {!badgeDismissed && (
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                    </span>
                )}
            </button>

            {/* Right: actions */}
            <div className="flex items-center gap-1 shrink-0">
                {/* Reload */}
                <button
                    onClick={onReload}
                    disabled={loading}
                    title="Reload file from server"
                    className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>

                {/* Word wrap toggle */}
                <button
                    onClick={onToggleWordWrap}
                    title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                    className="p-1.5 rounded-md transition-colors"
                    style={{
                        background: wordWrap ? "#3c3c3c" : "transparent",
                        color: wordWrap ? "#d4d4d4" : "#808080",
                    }}
                >
                    <WrapText className="w-3.5 h-3.5" />
                </button>

                {/* Theme picker */}
                <ThemePicker
                    themeId={themeId}
                    open={showThemePicker}
                    onToggle={onToggleThemePicker}
                    onSelect={onThemeSelect}
                />

                {/* Shortcuts help */}
                <button
                    onClick={onShowShortcuts}
                    title="Keyboard Shortcuts"
                    className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200"
                >
                    <Info className="w-3.5 h-3.5" />
                </button>

                {/* Save */}
                <button
                    onClick={onSave}
                    disabled={saving || !modified}
                    className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium px-3 py-1.5 rounded-md transition-colors ml-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                    {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Save className="w-3.5 h-3.5" />
                    )}
                    {saving ? "Saving…" : "Save"}
                </button>

                {/* Split editor */}
                {canSplit && (
                    <button
                        onClick={onSplit}
                        title="Split Editor Right"
                        className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200 ml-0.5"
                    >
                        <Columns2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
            {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
        </>
    );
}

export const EditorToolbar = React.memo(EditorToolbarInner);
