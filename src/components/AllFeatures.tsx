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
import { Badge } from "./ui/badge";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface FeatureGroup {
    category: string;
    icon: LucideIcon;
    color: string;
    items: { label: string; upcoming?: boolean }[];
}

const featureGroups: FeatureGroup[] = [
    {
        category: "SSH Terminal",
        icon: Terminal,
        color: "text-green-400",
        items: [
            { label: "Web-based SSH terminal (XTerm.js)" },
            { label: "Multi-tab sessions" },
            { label: "Password & private-key authentication" },
            { label: "Saved hosts (IndexedDB)" },
            { label: "Per-session themes & fonts" },
            { label: "Split terminal (H / V)" },
            { label: "Idle auto-reconnect" },
            { label: "Shared terminal sessions", upcoming: true },
            { label: "Per-session diagnostics overlay" },
            { label: "Command palette (PM2, Nginx, systemctl)" },
            { label: "Auto-hide toolbar" },
        ],
    },
    {
        category: "SFTP File Manager",
        icon: FolderOpen,
        color: "text-blue-400",
        items: [
            { label: "Multi-tab SFTP connections" },
            { label: "File browser with breadcrumb navigation" },
            { label: "Upload & download with progress tracking" },
            { label: "Right-click context menu (13 actions)" },
            { label: "File permission editing (chmod)" },
            { label: "New file / folder creation" },
            { label: "Move, copy, rename & delete" },
            { label: "Media file preview (images, video)" },
            { label: "Persistent sessions & directories" },
            { label: "SFTP auto-reconnect" },
        ],
    },
    {
        category: "Code Editor",
        icon: Code2,
        color: "text-violet-400",
        items: [
            { label: "Monaco Editor with IntelliSense" },
            { label: "Multi-tab & split-group editing" },
            { label: "25+ themes (One Dark, Dracula, …)" },
            { label: "Find & Replace, Go-to-line" },
            { label: "Command Palette (Ctrl+Shift+P)" },
            { label: "Minimap & bracket colorization" },
            { label: "Auto-close brackets & tags" },
            { label: "Auto-save with debounce" },
            { label: "Snippet support (Go, JS, Python, TS)" },
            { label: "Code folding & sticky scroll" },
            { label: "Diff viewer" },
            { label: "Embedded terminal panel" },
        ],
    },
    {
        category: "AI Assistance",
        icon: Sparkles,
        color: "text-amber-400",
        items: [
            { label: "AI ghost-text completions (Monacopilot)" },
            { label: "AI Chat (apply code suggestions)" },
            { label: "Context-aware code generation" },
            { label: "Free open-source tier (10 req/min)" },
        ],
    },
    {
        category: "Extensions & Plugins",
        icon: Puzzle,
        color: "text-cyan-400",
        items: [
            { label: "Open VSX extension marketplace" },
            { label: "Install from GitHub (VSIX)" },
            { label: "Drag & drop .vsix install" },
            { label: "Extension themes, grammars & snippets" },
            { label: "Full plugin lifecycle system" },
        ],
    },
    {
        category: "Security & Management",
        icon: Shield,
        color: "text-emerald-400",
        items: [
            { label: "Encrypted key vault (browser IndexedDB)" },
            { label: "Session resilience on disconnect" },
            { label: "Role-based shared session permissions" },
            { label: "Server status indicator" },
            { label: "Diagnostics & error reporting" },
        ],
    },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AllFeatures() {
    return (
        <section id="all-features" className="container py-24 sm:py-32">
            <div className="text-center space-y-4 mb-14">
                <h2 className="text-3xl lg:text-4xl font-bold">
                    Everything{" "}
                    <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                        Built In
                    </span>
                </h2>
                <p className="text-muted-foreground md:w-3/4 mx-auto lg:w-2/3 text-base">
                    SSH, SFTP, Code Editor, AI, Extensions — all running in your browser.
                    Here's the complete list of features available today.
                </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featureGroups.map((group) => {
                    const Icon = group.icon;
                    return (
                        <div
                            key={group.category}
                            className="
                                rounded-xl border border-border/60 bg-card
                                p-5 space-y-4 hover:border-primary/40
                                transition-colors
                            "
                        >
                            {/* Category header */}
                            <div className="flex items-center gap-2.5">
                                <Icon className={`h-5 w-5 ${group.color}`} />
                                <h3 className="font-semibold text-base">{group.category}</h3>
                            </div>

                            {/* Feature list */}
                            <ul className="space-y-1.5">
                                {group.items.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                                        <span>
                                            {item.label}
                                            {item.upcoming && (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-1.5 text-[10px] py-0 px-1.5 align-middle border-amber-500/40 text-amber-500"
                                                >
                                                    soon
                                                </Badge>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
