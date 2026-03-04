/**
 * @module EditorWelcomeDialog
 *
 * A VS Code-style "first-time" welcome dialog shown once when the user
 * opens the editor for the first time. Persists dismissal in localStorage.
 */
import React, { useEffect, useState } from "react";
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
import {
    Info,
    Puzzle,
    Sparkles,
    Settings,
    PanelLeft,
    AlertTriangle,
    ChevronRight,
} from "lucide-react";

const STORAGE_KEY = "terminus-editor-welcome-dismissed";

interface WelcomeTip {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const tips: WelcomeTip[] = [
    {
        icon: <Info className="h-4 w-4 shrink-0 text-blue-400" />,
        title: "Not a full VS Code",
        description:
            "This is a lightweight web-based editor. Use the built-in Extension & Plugin system to enable language-specific features similar to VS Code.",
    },
    {
        icon: <Puzzle className="h-4 w-4 shrink-0 text-violet-400" />,
        title: "Extensions & Plugins",
        description:
            "You can manually install extensions and plugins for any language from the Extensions panel in the right sidebar, or drag & drop a .vsix file.",
    },
    {
        icon: <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />,
        title: "AI Assistance (Free Tier)",
        description:
            "AI completions are available at 10 requests/min using an open-source free tier. AI can make mistakes — always review suggestions before accepting.",
    },
    {
        icon: <Settings className="h-4 w-4 shrink-0 text-emerald-400" />,
        title: "Check Settings",
        description:
            "Visit Settings to toggle features, change themes, fonts, auto-save, diagnostics, and more. Most options are accessible from the status bar too.",
    },
    {
        icon: <PanelLeft className="h-4 w-4 shrink-0 text-cyan-400" />,
        title: "Explore Sidebars",
        description:
            "The left sidebar has a file tree. The right sidebar contains Outline, Problems, Info, and the Extensions panel — explore them to discover all editor capabilities.",
    },
    {
        icon: <AlertTriangle className="h-4 w-4 shrink-0 text-orange-400" />,
        title: "AI Disclaimer",
        description:
            "We do not recommend blindly following AI suggestions. The AI is a free open-source tier and may produce incorrect results. Always verify generated code.",
    },
];

export function EditorWelcomeDialog() {
    const [open, setOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
            // Small delay so the editor has time to render first
            const timer = setTimeout(() => setOpen(true), 600);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        if (dontShowAgain) {
            localStorage.setItem(STORAGE_KEY, "true");
        }
        setOpen(false);
    };

    const handleGetStarted = () => {
        localStorage.setItem(STORAGE_KEY, "true");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) handleDismiss(); else setOpen(true); }}>
            <DialogContent
                className="
                    sm:max-w-[520px] p-0 gap-0 overflow-hidden
                    border-[hsl(var(--border))]
                    bg-[hsl(var(--background))]
                    text-[hsl(var(--foreground))]
                    shadow-2xl
                "
            >
                {/* ── Header ── */}
                <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-base font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Welcome to Terminus Editor
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            A few things to get you started
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* ── Body ── */}
                <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {tips.map((tip, i) => (
                        <div
                            key={i}
                            className="
                                group flex items-start gap-3 rounded-md p-2.5
                                bg-[hsl(var(--muted)/0.4)]
                                hover:bg-[hsl(var(--muted)/0.7)]
                                transition-colors
                            "
                        >
                            <div className="mt-0.5">{tip.icon}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{tip.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    {tip.description}
                                </p>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
                        </div>
                    ))}
                </div>

                {/* ── Footer ── */}
                <DialogFooter className="px-5 py-3 border-t border-[hsl(var(--border))] flex-row items-center justify-between sm:justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                            checked={dontShowAgain}
                            onCheckedChange={(v) => setDontShowAgain(!!v)}
                            className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-muted-foreground">Don't show again</span>
                    </label>
                    <Button size="sm" onClick={handleGetStarted} className="text-xs h-7 px-4">
                        Got it, let's go!
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
