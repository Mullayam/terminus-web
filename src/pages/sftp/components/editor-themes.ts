/**
 * Editor Theme System
 *
 * Each theme is a JSON object with color tokens as key-value pairs.
 * To add a custom theme, create a new entry in `editorThemes` with a unique key.
 *
 * Color tokens:
 * - bg:               Main editor background
 * - bgSurface:        Toolbar, panels, modals background
 * - bgStatusBar:      Status bar background
 * - border:           Borders between sections
 * - text:             Primary text color
 * - textMuted:        Secondary / dimmed text
 * - textPlaceholder:  Input placeholders, gutter numbers
 * - accent:           Primary accent (buttons, badges, icons)
 * - accentHover:      Accent hover state
 * - accentText:       Text on accent-colored backgrounds
 * - selection:        Selection highlight in editor
 * - hover:            Hover background on list items, menus
 * - error:            Error text
 * - success:          Success text
 * - warning:          Warning indicator (e.g. unsaved dot)
 * - scrollTrack:      Scrollbar track color
 * - scrollThumb:      Scrollbar thumb color
 * - scrollThumbHover: Scrollbar thumb hover color
 */

export interface EditorTheme {
    /** Display name shown in UI */
    name: string;
    /** PrismJS CSS file name (without path) to load for syntax highlighting */
    prismCss?: string;
    colors: {
        bg: string;
        bgSurface: string;
        bgStatusBar: string;
        border: string;
        text: string;
        textMuted: string;
        textPlaceholder: string;
        accent: string;
        accentHover: string;
        accentText: string;
        selection: string;
        hover: string;
        error: string;
        success: string;
        warning: string;
        scrollTrack: string;
        scrollThumb: string;
        scrollThumbHover: string;
    };
}

export const editorThemes: Record<string, EditorTheme> = {
    dracula: {
        name: "Dracula",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#282a36",
            bgSurface: "#21222c",
            bgStatusBar: "#191a21",
            border: "#44475a",
            text: "#f8f8f2",
            textMuted: "#6272a4",
            textPlaceholder: "#6272a4",
            accent: "#bd93f9",
            accentHover: "#caa9fa",
            accentText: "#282a36",
            selection: "#44475a",
            hover: "#44475a",
            error: "#ff5555",
            success: "#50fa7b",
            warning: "#ffb86c",
            scrollTrack: "#21222c",
            scrollThumb: "#44475a",
            scrollThumbHover: "#6272a4",
        },
    },
    "github-dark": {
        name: "GitHub Dark",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#0d1117",
            bgSurface: "#161b22",
            bgStatusBar: "#010409",
            border: "#30363d",
            text: "#e6edf3",
            textMuted: "#8b949e",
            textPlaceholder: "#484f58",
            accent: "#58a6ff",
            accentHover: "#79c0ff",
            accentText: "#0d1117",
            selection: "#264f78",
            hover: "#30363d",
            error: "#f85149",
            success: "#3fb950",
            warning: "#d29922",
            scrollTrack: "#161b22",
            scrollThumb: "#30363d",
            scrollThumbHover: "#484f58",
        },
    },
    "monokai-pro": {
        name: "Monokai Pro",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#2d2a2e",
            bgSurface: "#221f22",
            bgStatusBar: "#19171a",
            border: "#403e41",
            text: "#fcfcfa",
            textMuted: "#727072",
            textPlaceholder: "#5b595c",
            accent: "#ffd866",
            accentHover: "#ffe499",
            accentText: "#2d2a2e",
            selection: "#403e41",
            hover: "#403e41",
            error: "#ff6188",
            success: "#a9dc76",
            warning: "#fc9867",
            scrollTrack: "#221f22",
            scrollThumb: "#403e41",
            scrollThumbHover: "#727072",
        },
    },
    "one-dark": {
        name: "One Dark",
        prismCss: "prism-atom-dark.css",
        colors: {
            bg: "#282c34",
            bgSurface: "#21252b",
            bgStatusBar: "#1e2127",
            border: "#3e4452",
            text: "#abb2bf",
            textMuted: "#5c6370",
            textPlaceholder: "#4b5263",
            accent: "#61afef",
            accentHover: "#82c4f8",
            accentText: "#282c34",
            selection: "#3e4452",
            hover: "#3e4452",
            error: "#e06c75",
            success: "#98c379",
            warning: "#e5c07b",
            scrollTrack: "#21252b",
            scrollThumb: "#3e4452",
            scrollThumbHover: "#5c6370",
        },
    },
    "solarized-dark": {
        name: "Solarized Dark",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#002b36",
            bgSurface: "#073642",
            bgStatusBar: "#001e27",
            border: "#586e75",
            text: "#93a1a1",
            textMuted: "#657b83",
            textPlaceholder: "#586e75",
            accent: "#268bd2",
            accentHover: "#2aa0f5",
            accentText: "#fdf6e3",
            selection: "#073642",
            hover: "#073642",
            error: "#dc322f",
            success: "#859900",
            warning: "#b58900",
            scrollTrack: "#073642",
            scrollThumb: "#586e75",
            scrollThumbHover: "#657b83",
        },
    },
    "nord": {
        name: "Nord",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#2e3440",
            bgSurface: "#3b4252",
            bgStatusBar: "#272c36",
            border: "#4c566a",
            text: "#eceff4",
            textMuted: "#81a1c1",
            textPlaceholder: "#4c566a",
            accent: "#88c0d0",
            accentHover: "#8fbcbb",
            accentText: "#2e3440",
            selection: "#434c5e",
            hover: "#434c5e",
            error: "#bf616a",
            success: "#a3be8c",
            warning: "#ebcb8b",
            scrollTrack: "#3b4252",
            scrollThumb: "#4c566a",
            scrollThumbHover: "#81a1c1",
        },
    },
    "tokyo-night": {
        name: "Tokyo Night",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#1a1b26",
            bgSurface: "#16161e",
            bgStatusBar: "#101014",
            border: "#3b4261",
            text: "#c0caf5",
            textMuted: "#565f89",
            textPlaceholder: "#414868",
            accent: "#7aa2f7",
            accentHover: "#89b4fa",
            accentText: "#1a1b26",
            selection: "#283457",
            hover: "#292e42",
            error: "#f7768e",
            success: "#9ece6a",
            warning: "#e0af68",
            scrollTrack: "#16161e",
            scrollThumb: "#3b4261",
            scrollThumbHover: "#565f89",
        },
    },
    "catppuccin-mocha": {
        name: "Catppuccin Mocha",
        prismCss: "prism-vscode-dark.css",
        colors: {
            bg: "#1e1e2e",
            bgSurface: "#181825",
            bgStatusBar: "#11111b",
            border: "#45475a",
            text: "#cdd6f4",
            textMuted: "#6c7086",
            textPlaceholder: "#585b70",
            accent: "#cba6f7",
            accentHover: "#d4bfff",
            accentText: "#1e1e2e",
            selection: "#45475a",
            hover: "#313244",
            error: "#f38ba8",
            success: "#a6e3a1",
            warning: "#f9e2af",
            scrollTrack: "#181825",
            scrollThumb: "#45475a",
            scrollThumbHover: "#6c7086",
        },
    },
    "synthwave-84": {
        name: "Synthwave '84",
        prismCss: "prism-synthwave84.css",
        colors: {
            bg: "#2a2139",
            bgSurface: "#241b2f",
            bgStatusBar: "#1a1525",
            border: "#495495",
            text: "#f92aad",
            textMuted: "#8e8e8e",
            textPlaceholder: "#6a5f7a",
            accent: "#f92aad",
            accentHover: "#ff6ac1",
            accentText: "#2a2139",
            selection: "#463465",
            hover: "#34294f",
            error: "#e2777a",
            success: "#72f1b8",
            warning: "#f87c32",
            scrollTrack: "#241b2f",
            scrollThumb: "#495495",
            scrollThumbHover: "#6a5f7a",
        },
    },
    "material-dark": {
        name: "Material Dark",
        prismCss: "prism-material-dark.css",
        colors: {
            bg: "#2f2f2f",
            bgSurface: "#262626",
            bgStatusBar: "#1a1a1a",
            border: "#424242",
            text: "#eee",
            textMuted: "#757575",
            textPlaceholder: "#616161",
            accent: "#89ddff",
            accentHover: "#a5e8ff",
            accentText: "#2f2f2f",
            selection: "#363636",
            hover: "#3a3a3a",
            error: "#ff6666",
            success: "#a5e844",
            warning: "#ffcb6b",
            scrollTrack: "#262626",
            scrollThumb: "#424242",
            scrollThumbHover: "#616161",
        },
    },
    "hopscotch": {
        name: "Hopscotch",
        prismCss: "prism-hopscotch.css",
        colors: {
            bg: "#322931",
            bgSurface: "#2b2230",
            bgStatusBar: "#221b27",
            border: "#5b4a5e",
            text: "#b9b5b8",
            textMuted: "#797379",
            textPlaceholder: "#5b4a5e",
            accent: "#1290bf",
            accentHover: "#14a8db",
            accentText: "#ffffff",
            selection: "#45384b",
            hover: "#3d3244",
            error: "#dd464c",
            success: "#8fc13e",
            warning: "#fd8b19",
            scrollTrack: "#2b2230",
            scrollThumb: "#5b4a5e",
            scrollThumbHover: "#797379",
        },
    },
    "atom-dark": {
        name: "Atom Dark",
        prismCss: "prism-atom-dark.css",
        colors: {
            bg: "#1d1f21",
            bgSurface: "#181a1c",
            bgStatusBar: "#111314",
            border: "#383a3e",
            text: "#c5c8c6",
            textMuted: "#7C7C7C",
            textPlaceholder: "#5a5a5a",
            accent: "#96CBFE",
            accentHover: "#b0daff",
            accentText: "#1d1f21",
            selection: "#373b41",
            hover: "#2c2e30",
            error: "#f92672",
            success: "#A8FF60",
            warning: "#fd971f",
            scrollTrack: "#181a1c",
            scrollThumb: "#383a3e",
            scrollThumbHover: "#7C7C7C",
        },
    },
    "vsc-dark-plus": {
        name: "VS Code Dark+",
        prismCss: "prism-vsc-dark-plus.css",
        colors: {
            bg: "#1e1e1e",
            bgSurface: "#181818",
            bgStatusBar: "#007acc",
            border: "#3c3c3c",
            text: "#d4d4d4",
            textMuted: "#808080",
            textPlaceholder: "#5a5a5a",
            accent: "#569cd6",
            accentHover: "#6cb6ff",
            accentText: "#ffffff",
            selection: "#264F78",
            hover: "#2a2d2e",
            error: "#f44747",
            success: "#6a9955",
            warning: "#d7ba7d",
            scrollTrack: "#181818",
            scrollThumb: "#424242",
            scrollThumbHover: "#4f4f4f",
        },
    },
};

/** Default theme key */
export const DEFAULT_THEME_KEY = "dracula";

/** Get a theme by key. Falls back to dracula if key is invalid. */
export function getEditorTheme(key: string): EditorTheme {
    return editorThemes[key] ?? editorThemes[DEFAULT_THEME_KEY];
}

/** Get all theme keys for listing in a picker */
export function getThemeKeys(): string[] {
    return Object.keys(editorThemes);
}

/* ── Prism CSS map (loaded as raw text) ──────────────────── */

const prismCssModules: Record<string, () => Promise<string>> = {
    "prism-vscode-dark.css": () => import("./prism-vscode-dark.css?raw").then((m) => m.default),
    "prism-synthwave84.css": () => import("./prism-synthwave84.css?raw").then((m) => m.default),
    "prism-material-dark.css": () => import("./prism-material-dark.css?raw").then((m) => m.default),
    "prism-hopscotch.css": () => import("./prism-hopscotch.css?raw").then((m) => m.default),
    "prism-atom-dark.css": () => import("./prism-atom-dark.css?raw").then((m) => m.default),
    "prism-vsc-dark-plus.css": () => import("./prism-vsc-dark-plus.css?raw").then((m) => m.default),
};

const STYLE_ID = "prism-theme-dynamic";
let activePrismCss: string | null = null;

/**
 * Dynamically swap the active PrismJS syntax-highlighting CSS.
 * Injects raw CSS text into a managed `<style>` tag, replacing any previous theme.
 */
export async function applyPrismTheme(themeKey: string): Promise<void> {
    const theme = getEditorTheme(themeKey);
    const cssFile = theme.prismCss ?? "prism-vscode-dark.css";
    if (cssFile === activePrismCss) return;

    const loader = prismCssModules[cssFile];
    if (!loader) return;

    const cssText = await loader();

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = cssText;
    activePrismCss = cssFile;
}
