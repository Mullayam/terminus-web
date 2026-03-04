import { Badge } from "./ui/badge";
import {
    Terminal,
    FolderOpen,
    Code2,
    Shield,
    Split,
    Sparkles,
    Globe,
    Keyboard,
    Palette,
    Search,
    Puzzle,
    Download,
    Upload,
    FileEdit,
    Eye,
    GitBranch,
    Layers,
    Settings,
    Users,
    HardDrive,
    RefreshCw,
    Timer,
    MonitorSmartphone,
    PanelLeft,
    type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface FeatureItem {
    label: string;
    icon: LucideIcon;
    upcoming?: boolean;
}

interface FeatureGroup {
    category: string;
    icon: LucideIcon;
    color: string;
    items: FeatureItem[];
}

const featureGroups: FeatureGroup[] = [
    {
        category: "SSH Terminal",
        icon: Terminal,
        color: "text-green-400",
        items: [
            { label: "Web-based SSH terminal (XTerm.js)", icon: Terminal },
            { label: "Multi-tab sessions", icon: Layers },
            { label: "Password & private-key auth", icon: Shield },
            { label: "Saved hosts (IndexedDB)", icon: HardDrive },
            { label: "Per-session themes & fonts", icon: Palette },
            { label: "Split terminal (H / V)", icon: Split },
            { label: "Idle auto-reconnect", icon: RefreshCw },
            { label: "Shared terminal sessions", icon: Users, upcoming: true },
            { label: "Per-session diagnostics overlay", icon: Eye },
            { label: "Command palette (PM2, Nginx…)", icon: Keyboard },
            { label: "Auto-hide toolbar", icon: PanelLeft },
        ],
    },
    {
        category: "SFTP File Manager",
        icon: FolderOpen,
        color: "text-blue-400",
        items: [
            { label: "Multi-tab SFTP connections", icon: Layers },
            { label: "Breadcrumb navigation", icon: FolderOpen },
            { label: "Upload & download with progress", icon: Upload },
            { label: "Context menu (13 actions)", icon: Settings },
            { label: "File permission editing (chmod)", icon: Shield },
            { label: "New file / folder creation", icon: FileEdit },
            { label: "Move, copy, rename & delete", icon: FolderOpen },
            { label: "Media file preview", icon: Eye },
            { label: "Persistent sessions & dirs", icon: HardDrive },
            { label: "SFTP auto-reconnect", icon: RefreshCw },
        ],
    },
    {
        category: "Code Editor",
        icon: Code2,
        color: "text-violet-400",
        items: [
            { label: "Monaco Editor + IntelliSense", icon: Code2 },
            { label: "Multi-tab & split editing", icon: Split },
            { label: "200+ themes", icon: Palette },
            { label: "Find & Replace, Go-to-line", icon: Search },
            { label: "Command Palette (Ctrl+Shift+P)", icon: Keyboard },
            { label: "Minimap & bracket colorization", icon: Eye },
            { label: "Auto-close brackets & tags", icon: Code2 },
            { label: "Auto-save with debounce", icon: Timer },
            { label: "Snippets (Go, JS, Python, TS)", icon: FileEdit },
            { label: "Code folding & sticky scroll", icon: Layers },
            { label: "Diff viewer", icon: GitBranch },
            { label: "Embedded terminal panel", icon: Terminal },
        ],
    },
    {
        category: "AI Assistance",
        icon: Sparkles,
        color: "text-amber-400",
        items: [
            { label: "AI ghost-text completions", icon: Sparkles },
            { label: "AI Chat (apply suggestions)", icon: Sparkles },
            { label: "Context-aware code generation", icon: Code2 },
            { label: "Free open-source tier", icon: Globe },
        ],
    },
    {
        category: "Extensions & Plugins",
        icon: Puzzle,
        color: "text-cyan-400",
        items: [
            { label: "Open VSX marketplace", icon: Puzzle },
            { label: "Install from GitHub (VSIX)", icon: Download },
            { label: "Drag & drop .vsix install", icon: Upload },
            { label: "Theme, grammar & snippet packs", icon: Palette },
            { label: "Full plugin lifecycle", icon: Settings },
            { label: "LSP over WebSocket", icon: Globe },
        ],
    },
    {
        category: "Security & Management",
        icon: Shield,
        color: "text-emerald-400",
        items: [
            { label: "Encrypted key vault (IndexedDB)", icon: Shield },
            { label: "Session resilience on disconnect", icon: RefreshCw },
            { label: "Role-based shared permissions", icon: Users },
            { label: "Server status indicator", icon: MonitorSmartphone },
            { label: "Diagnostics & error reporting", icon: Eye },
        ],
    },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Features = () => {
    return (
        <section id="features" className="container py-20 sm:py-28">
            {/* Heading */}
            <div className="text-center space-y-3 mb-10">
                <h2 className="text-3xl lg:text-4xl font-bold">
                    Many{" "}
                    <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                        Great Features
                    </span>
                </h2>
                <p className="text-muted-foreground text-sm md:w-3/4 mx-auto lg:w-2/3">
                    SSH, SFTP, Code Editor, AI, Extensions — all running in your browser.
                </p>
            </div>

            {/* Feature groups */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featureGroups.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                        <div
                            key={group.category}
                            className="rounded-lg border border-border/60 bg-card/50 p-3.5 space-y-2.5 hover:border-primary/40 transition-colors"
                        >
                            {/* Category header */}
                            <div className="flex items-center gap-2">
                                <GroupIcon className={`h-4 w-4 ${group.color} shrink-0`} />
                                <h3 className="font-semibold text-sm">{group.category}</h3>
                            </div>

                            {/* Compact feature chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {group.items.map((item, i) => {
                                    const ItemIcon = item.icon;
                                    return (
                                        <div
                                            key={i}
                                            className="inline-flex items-center gap-1 rounded-md bg-muted/50 border border-border/40 px-2 py-0.5 text-[11px] text-muted-foreground leading-tight hover:bg-muted transition-colors"
                                        >
                                            <ItemIcon className="h-3 w-3 shrink-0 opacity-60" />
                                            <span>{item.label}</span>
                                            {item.upcoming && (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-0.5 text-[9px] py-0 px-1 border-amber-500/40 text-amber-500 leading-none"
                                                >
                                                    soon
                                                </Badge>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
