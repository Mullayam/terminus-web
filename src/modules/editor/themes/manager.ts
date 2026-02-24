/**
 * @module editor/themes/manager
 *
 * ThemeManager – singleton that manages the full lifecycle of editor themes.
 *
 * Design Patterns:
 *  - **Factory Pattern**: `createTheme()` merges partial user JSON into a full theme.
 *  - **Observer Pattern**: Subscribers are notified when the active theme changes.
 *  - **Singleton**: One manager per application via `ThemeManager.getInstance()`.
 *
 * Persistence: Custom themes are stored in `localStorage` under
 * `terminus-editor-themes`.  The active theme ID is stored under
 * `terminus-editor-active-theme`.
 */
import type { EditorTheme, PartialTheme } from "../types";
import { BUILT_IN_THEMES, dracula } from "./defaults";

const LS_THEMES_KEY = "terminus-editor-themes";
const LS_ACTIVE_KEY = "terminus-editor-active-theme";

type ThemeChangeListener = (theme: EditorTheme) => void;

export class ThemeManager {
    // ── Singleton ────────────────────────────────────────────
    private static instance: ThemeManager | null = null;
    static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    // ── Internal state ───────────────────────────────────────
    private themes: Map<string, EditorTheme> = new Map();
    private activeId: string;
    private listeners: Set<ThemeChangeListener> = new Set();

    private constructor() {
        // Register built-in themes
        for (const t of BUILT_IN_THEMES) {
            this.themes.set(t.id, t);
        }
        // Load custom themes from localStorage
        this.loadCustomThemes();
        // Restore active theme
        this.activeId = this.loadActiveId();
    }

    // ── Public API ───────────────────────────────────────────

    /** Get all registered themes (built-in + custom) */
    getAll(): EditorTheme[] {
        return Array.from(this.themes.values());
    }

    /** Get built-in themes only */
    getBuiltIn(): EditorTheme[] {
        return Array.from(this.themes.values()).filter((t) => t.isBuiltIn);
    }

    /** Get custom (user-created) themes only */
    getCustom(): EditorTheme[] {
        return Array.from(this.themes.values()).filter((t) => !t.isBuiltIn);
    }

    /** Retrieve a theme by ID */
    get(id: string): EditorTheme | undefined {
        return this.themes.get(id);
    }

    /** Get the currently active theme */
    getActive(): EditorTheme {
        return this.themes.get(this.activeId) ?? dracula;
    }

    /** Get the active theme ID */
    getActiveId(): string {
        return this.activeId;
    }

    /** Switch active theme by ID */
    setActive(id: string): void {
        if (!this.themes.has(id)) return;
        this.activeId = id;
        this.persistActiveId();
        this.notify();
    }

    // ── Factory Pattern: create theme from partial JSON ──────

    /**
     * Create a full EditorTheme from a partial user definition.
     * Missing fields are inherited from `baseThemeId` (defaults to "dracula").
     */
    createTheme(partial: PartialTheme, baseThemeId = "dracula"): EditorTheme {
        const base = this.themes.get(baseThemeId) ?? dracula;
        return {
            id: partial.id,
            name: partial.name,
            type: partial.type ?? base.type,
            colors: { ...base.colors, ...partial.colors },
            syntax: { ...base.syntax, ...partial.syntax },
            font: { ...base.font, ...partial.font },
            isBuiltIn: false,
        };
    }

    /**
     * Register a new custom theme (by partial JSON, merged with base).
     * Persists to localStorage automatically.
     */
    addCustomTheme(partial: PartialTheme, baseThemeId = "dracula"): EditorTheme {
        const theme = this.createTheme(partial, baseThemeId);
        this.themes.set(theme.id, theme);
        this.persistCustomThemes();
        return theme;
    }

    /** Register a fully-defined custom theme */
    addFullTheme(theme: EditorTheme): void {
        this.themes.set(theme.id, { ...theme, isBuiltIn: false });
        this.persistCustomThemes();
    }

    /** Update an existing custom theme (cannot update built-in) */
    updateTheme(id: string, partial: Partial<PartialTheme>): EditorTheme | null {
        const existing = this.themes.get(id);
        if (!existing || existing.isBuiltIn) return null;
        const updated: EditorTheme = {
            ...existing,
            name: partial.name ?? existing.name,
            type: partial.type ?? existing.type,
            colors: { ...existing.colors, ...(partial.colors ?? {}) },
            syntax: { ...existing.syntax, ...(partial.syntax ?? {}) },
            font: { ...existing.font, ...(partial.font ?? {}) },
        };
        this.themes.set(id, updated);
        this.persistCustomThemes();
        if (this.activeId === id) this.notify();
        return updated;
    }

    /** Delete a custom theme (cannot delete built-in) */
    deleteTheme(id: string): boolean {
        const theme = this.themes.get(id);
        if (!theme || theme.isBuiltIn) return false;
        this.themes.delete(id);
        this.persistCustomThemes();
        if (this.activeId === id) {
            this.activeId = "dracula";
            this.persistActiveId();
            this.notify();
        }
        return true;
    }

    /**
     * Import themes from a JSON object.
     * Format: `{ "themeId": { name, type?, colors?, syntax?, font? }, ... }`
     */
    importFromJSON(json: Record<string, Omit<PartialTheme, "id">>, baseThemeId = "dracula"): EditorTheme[] {
        const imported: EditorTheme[] = [];
        for (const [id, def] of Object.entries(json)) {
            const theme = this.addCustomTheme({ id, ...def }, baseThemeId);
            imported.push(theme);
        }
        return imported;
    }

    /**
     * Export all custom themes as a JSON object.
     */
    exportToJSON(): Record<string, Omit<PartialTheme, "id">> {
        const result: Record<string, Omit<PartialTheme, "id">> = {};
        for (const theme of this.getCustom()) {
            result[theme.id] = {
                name: theme.name,
                type: theme.type,
                colors: theme.colors,
                syntax: theme.syntax,
                font: theme.font,
            };
        }
        return result;
    }

    // ── Observer Pattern: subscribe to theme changes ─────────

    /** Subscribe to active-theme changes. Returns an unsubscribe function. */
    subscribe(listener: ThemeChangeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        const theme = this.getActive();
        this.listeners.forEach((fn) => fn(theme));
    }

    // ── CSS variable application ─────────────────────────────

    /**
     * Apply a theme's colors/syntax/font as CSS custom-properties on an element.
     * This enables instant theme switching without reloading.
     */
    static applyThemeToElement(theme: EditorTheme, el: HTMLElement): void {
        const s = el.style;
        // Colors
        Object.entries(theme.colors).forEach(([key, value]) => {
            s.setProperty(`--editor-${camelToKebab(key)}`, value);
        });
        // Syntax
        Object.entries(theme.syntax).forEach(([key, value]) => {
            s.setProperty(`--syntax-${camelToKebab(key)}`, value);
        });
        // Font
        s.setProperty("--editor-font-family", theme.font.family);
        s.setProperty("--editor-font-size", `${theme.font.size}px`);
        s.setProperty("--editor-font-weight", String(theme.font.weight));
        s.setProperty("--editor-line-height", `${theme.font.lineHeight}px`);
        s.setProperty("--editor-cursor-style", theme.font.cursorStyle);
    }

    // ── Persistence (localStorage) ───────────────────────────

    private loadCustomThemes(): void {
        try {
            const raw = localStorage.getItem(LS_THEMES_KEY);
            if (!raw) return;
            const data = JSON.parse(raw) as EditorTheme[];
            for (const theme of data) {
                this.themes.set(theme.id, { ...theme, isBuiltIn: false });
            }
        } catch {
            // Ignore corrupt data
        }
    }

    private persistCustomThemes(): void {
        try {
            const custom = this.getCustom();
            localStorage.setItem(LS_THEMES_KEY, JSON.stringify(custom));
        } catch {
            // localStorage full or unavailable
        }
    }

    private loadActiveId(): string {
        try {
            const id = localStorage.getItem(LS_ACTIVE_KEY);
            return id && this.themes.has(id) ? id : "dracula";
        } catch {
            return "dracula";
        }
    }

    private persistActiveId(): void {
        try {
            localStorage.setItem(LS_ACTIVE_KEY, this.activeId);
        } catch {
            // Ignore
        }
    }
}

// ── Helper ───────────────────────────────────────────────────

function camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
