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
