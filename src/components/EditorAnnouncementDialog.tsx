/**
 * @module EditorAnnouncementDialog
 *
 * Version-gated "What's New" announcement dialog shown once per version
 * when the Monaco editor page mounts.  Stores the last-seen version in
 * localStorage so users are not nagged on every reload.
 */
import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Github, Linkedin, Megaphone } from "lucide-react";

/* ── Version & copy (update each release) ──────────────────── */

const APP_VERSION = "1.0.0";

const ANNOUNCEMENT = {
    headline: `What's New in v${APP_VERSION}`,
    body: `Terminus Editor now ships with a full VS Code-style extension host, 
global dialog & notification system, SFTP file-tree with drag-and-drop, 
AI-assisted completions, inline commands, split editors, theme marketplace, 
and a context-engine for smarter code intelligence. 
Extensions can be installed from Open VSX or by dropping a .vsix file.`,
    links: [
        {
            label: "GitHub",
            url: "https://github.com/Mullayam/terminus-web",
            icon: Github,
        },
        {
            label: "LinkedIn",
            url: "https://www.linkedin.com/in/mullayam06/",
            icon: Linkedin,
        },
        {
            label: "Changelog",
            url: "https://github.com/Mullayam/terminus-web/releases",
            icon: ExternalLink,
        },
    ],
};

/* ── Persistence ───────────────────────────────────────────── */

const STORAGE_KEY = "terminus-editor-announcement-version";

function hasSeenVersion(): boolean {
    return localStorage.getItem(STORAGE_KEY) === APP_VERSION;
}

function markSeen(): void {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
}

/* ── Component ─────────────────────────────────────────────── */

export function EditorAnnouncementDialog() {
    const [open, setOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (hasSeenVersion()) return;
        const timer = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        if (dontShowAgain) markSeen();
        setOpen(false);
    };

    const handleGotIt = () => {
        markSeen();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent
                className="sm:max-w-[480px] p-0 gap-0 overflow-hidden shadow-2xl"
                style={{
                    background: "var(--editor-bg, #1e1e1e)",
                    color: "var(--editor-fg, #cccccc)",
                    border: "1px solid var(--editor-border, #3c3c3c)",
                }}
            >
                {/* Header */}
                <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--editor-fg, #cccccc)" }}>
                            <Megaphone className="h-4 w-4" style={{ color: "var(--editor-accent, #007acc)" }} />
                            {ANNOUNCEMENT.headline}
                        </DialogTitle>
                        <DialogDescription className="text-xs" style={{ color: "var(--editor-fg, #808080)", opacity: 0.7 }}>
                            Terminus Editor — v{APP_VERSION}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    <p className="text-sm leading-relaxed" style={{ color: "var(--editor-fg, #cccccc)", opacity: 0.85 }}>
                        {ANNOUNCEMENT.body}
                    </p>

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                        {ANNOUNCEMENT.links.map(({ label, url, icon: Icon }) => (
                            <a
                                key={label}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{
                                    background: "var(--editor-hover-bg, #37373d)",
                                    color: "var(--editor-fg, #cccccc)",
                                    border: "1px solid var(--editor-border, #3c3c3c)",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--editor-accent, #007acc)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--editor-border, #3c3c3c)"; }}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-5 py-3 flex-row items-center justify-between sm:justify-between" style={{ borderTop: "1px solid var(--editor-border, #3c3c3c)" }}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                            checked={dontShowAgain}
                            onCheckedChange={(v) => setDontShowAgain(!!v)}
                            className="h-3.5 w-3.5"
                        />
                        <span className="text-xs" style={{ color: "var(--editor-fg, #808080)", opacity: 0.7 }}>Don't show again</span>
                    </label>
                    <button
                        onClick={handleGotIt}
                        className="text-xs font-medium h-7 px-4 rounded transition-colors"
                        style={{ background: "var(--editor-accent, #007acc)", color: "#fff" }}
                    >
                        Got it!
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
