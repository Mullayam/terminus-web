/**
 * Toolbar (top bar) for the Monaco editor page.
 * Memoized — only re-renders when its specific props change.
 */
import React, { useState, useEffect } from "react";
import { Loader2, Save, WrapText, RefreshCw, Info, Columns2, Sparkles, Bug } from "lucide-react";
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
    const [showIssueForm, setShowIssueForm] = useState(false);
    const [issueTitle, setIssueTitle] = useState("");
    const [issueBody, setIssueBody] = useState("");
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

    const handleSubmitIssue = () => {
        const params = new URLSearchParams();
        if (issueTitle.trim()) params.set("title", issueTitle.trim());
        if (issueBody.trim()) params.set("body", issueBody.trim());
        window.open(
            `https://github.com/Mullayam/terminus-web/issues/new?${params.toString()}`,
            "_blank",
            "noopener,noreferrer",
        );
        setShowIssueForm(false);
        setIssueTitle("");
        setIssueBody("");
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

            {/* Report Issue */}
            <button
                onClick={() => setShowIssueForm(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer shrink-0"
                style={{
                    background: "var(--editor-hover-bg, #2d2d2d)",
                    color: "var(--editor-fg, #999)",
                    border: "1px solid var(--editor-border, #3c3c3c)",
                }}
                title="Report an issue"
            >
                <Bug className="w-3 h-3" />
                <span>Report Issue</span>
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

            {/* Report Issue modal */}
            {showIssueForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="w-full max-w-md rounded-lg p-5 shadow-xl"
                        style={{
                            background: "var(--editor-sidebar-bg, #252526)",
                            border: "1px solid var(--editor-border, #3c3c3c)",
                            color: "var(--editor-fg, #d4d4d4)",
                        }}
                    >
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Bug className="w-4 h-4" /> Report an Issue
                        </h3>
                        <input
                            type="text"
                            placeholder="Issue title"
                            value={issueTitle}
                            onChange={(e) => setIssueTitle(e.target.value)}
                            className="w-full mb-2 px-3 py-1.5 rounded text-[12px] outline-none"
                            style={{
                                background: "var(--editor-input-bg, #3c3c3c)",
                                border: "1px solid var(--editor-border, #555)",
                                color: "var(--editor-fg, #d4d4d4)",
                            }}
                            autoFocus
                        />
                        <textarea
                            placeholder="Describe your concern…"
                            value={issueBody}
                            onChange={(e) => setIssueBody(e.target.value)}
                            rows={5}
                            className="w-full mb-3 px-3 py-1.5 rounded text-[12px] outline-none resize-none"
                            style={{
                                background: "var(--editor-input-bg, #3c3c3c)",
                                border: "1px solid var(--editor-border, #555)",
                                color: "var(--editor-fg, #d4d4d4)",
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setShowIssueForm(false); setIssueTitle(""); setIssueBody(""); }}
                                className="px-3 py-1.5 rounded text-[11px] font-medium transition-colors"
                                style={{
                                    background: "var(--editor-hover-bg, #2d2d2d)",
                                    color: "var(--editor-fg, #999)",
                                    border: "1px solid var(--editor-border, #3c3c3c)",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitIssue}
                                disabled={!issueTitle.trim()}
                                className="px-3 py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Submit on GitHub
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export const EditorToolbar = React.memo(EditorToolbarInner);
