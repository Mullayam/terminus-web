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
import { Button } from "@/components/ui/button";
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
            url: "https://www.linkedin.com/in/mullayam/",
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
            <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-2xl">
                {/* Header */}
                <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-base font-semibold flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-primary" />
                            {ANNOUNCEMENT.headline}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Terminus Editor — v{APP_VERSION}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
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
                                className="
                                    inline-flex items-center gap-1.5 rounded-md px-3 py-1.5
                                    text-xs font-medium
                                    bg-[hsl(var(--muted)/0.5)] hover:bg-[hsl(var(--muted)/0.8)]
                                    text-[hsl(var(--foreground))] transition-colors
                                "
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-5 py-3 border-t border-[hsl(var(--border))] flex-row items-center justify-between sm:justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                            checked={dontShowAgain}
                            onCheckedChange={(v) => setDontShowAgain(!!v)}
                            className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-muted-foreground">Don't show again</span>
                    </label>
                    <Button size="sm" onClick={handleGotIt} className="text-xs h-7 px-4">
                        Got it!
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
