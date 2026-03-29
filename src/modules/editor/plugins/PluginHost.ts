/**
 * @module editor/plugins/PluginHost
 *
 * Core plugin host that manages plugin lifecycle, routing events,
 * and aggregating decorations / panels / completions from all active plugins.
 *
 * This is a pure TypeScript class – no React dependency.
 * The React integration is done via usePluginHost hook.
 *
 * Design:
 *   - Immutable state snapshots: every mutation creates new collection
 *     references so useSyncExternalStore can detect changes by reference.
 *   - Batched emit: multiple mutations inside a batch() produce a single
 *     notification to React, avoiding cascading re-renders.
 *   - Ownership tracking: decorations/lenses/etc. are prefixed with
 *     pluginId: and cleaned up automatically on disable.
 */
import type { StoreApi } from "zustand";
import type { EditorStoreType, FormatterDefinition, KeyBinding, ContextMenuItem } from "../types";
import type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    PluginHostState,
    InlineDecoration,
    GutterDecoration,
    CodeLensItem,
    InlineAnnotation,
    FoldingRange,
    CompletionProvider,
    Diagnostic,
    PanelDescriptor,
} from "./types";
import { ThemeManager } from "../themes/manager";
import { FormatterRegistry } from "../formatters";
import { validatePlugin } from "./validatePlugin";
import { KeybindingManager } from "./KeybindingManager";

type Listener = () => void;

function createEmptyState(): PluginHostState {
    return {
        plugins: new Map(),
        enabledPlugins: new Set(),
        inlineDecorations: [],
        gutterDecorations: [],
        codeLenses: [],
        inlineAnnotations: [],
        diagnostics: [],
        foldingRanges: [],
        panels: new Map(),
        openPanels: new Set(),
        completionProviders: new Map(),
        commands: new Map(),
    };
}

export class PluginHost {
    private store: StoreApi<EditorStoreType>;
    private textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
    private state: PluginHostState;
    private listeners: Set<Listener> = new Set();
    private contentListeners: Set<(c: string) => void> = new Set();
    private selectionListeners: Set<(s: { start: number; end: number; text: string }) => void> = new Set();
    private saveListeners: Set<Listener> = new Set();
    private languageListeners: Set<(lang: string) => void> = new Set();
    private disposables: Map<string, Array<() => void>> = new Map();
    private apiCache: Map<string, ExtendedPluginAPI> = new Map();
    readonly keybindingManager = new KeybindingManager();

    constructor(
        store: StoreApi<EditorStoreType>,
        textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>,
    ) {
        this.store = store;
        this.textareaRef = textareaRef;
        this.state = createEmptyState();
    }

    // ── State snapshot (for React) ───────────────────────────

    getSnapshot(): PluginHostState {
        return this.state;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private batchDepth = 0;
    private batchDirty = false;

    private emit() {
        if (this.batchDepth > 0) {
            this.batchDirty = true;
            return;
        }
        this.state = { ...this.state };
        for (const l of this.listeners) l();
    }

    private batch(fn: () => void): void {
        this.batchDepth++;
        try {
            fn();
        } finally {
            this.batchDepth--;
            if (this.batchDepth === 0 && this.batchDirty) {
                this.batchDirty = false;
                this.emit();
            }
        }
    }

    // ── Plugin registration ──────────────────────────────────

    register(plugin: ExtendedEditorPlugin): void {
        if (this.state.plugins.has(plugin.id)) return;

        const validation = validatePlugin(plugin);
        if (!validation.valid) {
            const errors = validation.issues.filter((i) => i.level === "error");
            console.error(
                `[PluginHost] Plugin "${validation.pluginId}" failed validation:`,
                errors.map((e) => `${e.field}: ${e.message}`),
            );
            return;
        }

        this.state.plugins = new Map(this.state.plugins);
        this.state.plugins.set(plugin.id, plugin);

        if (plugin.defaultEnabled !== false) {
            this.enable(plugin.id);
        }
        this.emit();
    }

    registerAll(plugins: ExtendedEditorPlugin[]): void {
        this.batch(() => {
            for (const plugin of plugins) this.register(plugin);
        });
    }

    unregister(pluginId: string): void {
        if (!this.state.plugins.has(pluginId)) return;
        this.disable(pluginId);
        this.state.plugins = new Map(this.state.plugins);
        this.state.plugins.delete(pluginId);
        this.apiCache.delete(pluginId);
        this.emit();
    }

    unregisterAll(ids: Iterable<string>): void {
        this.batch(() => {
            for (const id of ids) this.unregister(id);
        });
    }

    enable(pluginId: string): void {
        const plugin = this.state.plugins.get(pluginId);
        if (!plugin || this.state.enabledPlugins.has(pluginId)) return;

        this.batch(() => {
            this.state.enabledPlugins = new Set(this.state.enabledPlugins);
            this.state.enabledPlugins.add(pluginId);
            const api = this.getAPI(pluginId);

            try { plugin.onInit?.(api); } catch (e) { console.error(`[Plugin:${pluginId}] onInit error:`, e); }
            try { plugin.onMount?.(api); } catch (e) { console.error(`[Plugin:${pluginId}] onMount error:`, e); }

            const activateResult = plugin.onActivate?.(api);
            if (activateResult instanceof Promise) {
                activateResult.catch((e) => console.error(`[Plugin:${pluginId}] onActivate error:`, e));
            }

            plugin.formatters?.forEach((f) => api.registerFormatter(f));
            plugin.panels?.forEach((p) => this.registerPanel(p));
            plugin.completionProviders?.forEach((cp) => this.registerCompletionProvider(cp));

            if (plugin.keybindings?.length) {
                this.keybindingManager.registerPluginBindings(pluginId, plugin.keybindings);
            }
        });
    }

    disable(pluginId: string): void {
        if (!this.state.enabledPlugins.has(pluginId)) return;

        this.batch(() => {
            const plugin = this.state.plugins.get(pluginId);
            const api = this.getAPI(pluginId);

            try { plugin?.onDeactivate?.(api); } catch (e) { console.error(`[Plugin:${pluginId}] onDeactivate error:`, e); }
            try { plugin?.onUnmount?.(); } catch (e) { console.error(`[Plugin:${pluginId}] onUnmount error:`, e); }

            this.disposables.get(pluginId)?.forEach((d) => { try { d(); } catch { /* ignore */ } });
            this.disposables.delete(pluginId);

            this.clearInlineDecorations(pluginId);
            this.clearGutterDecorations(pluginId);
            this.clearCodeLenses(pluginId);
            this.clearInlineAnnotations(pluginId);
            this.clearDiagnostics(pluginId);
            this.clearFoldingRanges(pluginId);
            this.keybindingManager.unregisterPluginBindings(pluginId);

            this.state.enabledPlugins = new Set(this.state.enabledPlugins);
            this.state.enabledPlugins.delete(pluginId);
        });
    }

    isEnabled(pluginId: string): boolean {
        return this.state.enabledPlugins.has(pluginId);
    }

    getPlugins(): ExtendedEditorPlugin[] {
        return Array.from(this.state.plugins.values());
    }

    // ── Event dispatching ────────────────────────────────────

    dispatchContentChange(content: string): void {
        for (const l of this.contentListeners) l(content);
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onContentChange) {
                try { plugin.onContentChange(content, this.getAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onContentChange error:`, e); }
            }
        }
    }

    dispatchSelectionChange(selection: { start: number; end: number; text: string }): void {
        for (const l of this.selectionListeners) l(selection);
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onSelectionChange) {
                try { plugin.onSelectionChange(selection, this.getAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onSelectionChange error:`, e); }
            }
        }
    }

    dispatchSave(): void {
        for (const l of this.saveListeners) l();
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onSave) {
                try { plugin.onSave(this.getAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onSave error:`, e); }
            }
        }
    }

    dispatchLanguageChange(language: string): void {
        for (const l of this.languageListeners) l(language);
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onLanguageChange) {
                try { plugin.onLanguageChange(language, this.getAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onLanguageChange error:`, e); }
            }
        }
    }

    // ── Keybinding dispatch ────────────────────────────────

    handleKeyEvent(e: KeyboardEvent, context: "editor" | "find" | "always" = "editor"): boolean {
        const handler = this.keybindingManager.getHandler(e, context);
        if (handler) {
            handler(e);
            return e.defaultPrevented;
        }
        return false;
    }

    // ── Decoration management (always produce new arrays) ────

    private addInlineDecorations(decorations: InlineDecoration[]): void {
        this.state.inlineDecorations = [...this.state.inlineDecorations, ...decorations];
        this.emit();
    }

    private removeInlineDecorations(ids: string[]): void {
        const idSet = new Set(ids);
        this.state.inlineDecorations = this.state.inlineDecorations.filter((d) => !idSet.has(d.id));
        this.emit();
    }

    private clearInlineDecorations(ownerId: string): void {
        const prefix = ownerId + ":";
        const next = this.state.inlineDecorations.filter((d) => !d.id.startsWith(prefix));
        if (next.length !== this.state.inlineDecorations.length) {
            this.state.inlineDecorations = next;
            this.emit();
        }
    }

    private addGutterDecorations(decorations: GutterDecoration[]): void {
        this.state.gutterDecorations = [...this.state.gutterDecorations, ...decorations];
        this.emit();
    }

    private removeGutterDecorations(ids: string[]): void {
        const idSet = new Set(ids);
        this.state.gutterDecorations = this.state.gutterDecorations.filter((d) => !idSet.has(d.id));
        this.emit();
    }

    private clearGutterDecorations(ownerId: string): void {
        const prefix = ownerId + ":";
        const next = this.state.gutterDecorations.filter((d) => !d.id.startsWith(prefix));
        if (next.length !== this.state.gutterDecorations.length) {
            this.state.gutterDecorations = next;
            this.emit();
        }
    }

    private setCodeLenses(lenses: CodeLensItem[]): void {
        const ids = new Set(lenses.map((l) => l.id));
        const others = this.state.codeLenses.filter((l) => !ids.has(l.id));
        this.state.codeLenses = [...others, ...lenses];
        this.emit();
    }

    private clearCodeLenses(ownerId: string): void {
        const prefix = ownerId + ":";
        const next = this.state.codeLenses.filter((l) => !l.id.startsWith(prefix));
        if (next.length !== this.state.codeLenses.length) {
            this.state.codeLenses = next;
            this.emit();
        }
    }

    private setInlineAnnotations(annotations: InlineAnnotation[]): void {
        const ids = new Set(annotations.map((a) => a.id));
        const others = this.state.inlineAnnotations.filter((a) => !ids.has(a.id));
        this.state.inlineAnnotations = [...others, ...annotations];
        this.emit();
    }

    private clearInlineAnnotations(ownerId: string): void {
        const prefix = ownerId + ":";
        const next = this.state.inlineAnnotations.filter((a) => !a.id.startsWith(prefix));
        if (next.length !== this.state.inlineAnnotations.length) {
            this.state.inlineAnnotations = next;
            this.emit();
        }
    }

    private setDiagnostics(diagnostics: Diagnostic[]): void {
        const ids = new Set(diagnostics.map((d) => d.id));
        const others = this.state.diagnostics.filter((d) => !ids.has(d.id));
        this.state.diagnostics = [...others, ...diagnostics];
        this.emit();
    }

    private clearDiagnostics(ownerId: string): void {
        const prefix = ownerId + ":";
        const next = this.state.diagnostics.filter((d) => !d.id.startsWith(prefix));
        if (next.length !== this.state.diagnostics.length) {
            this.state.diagnostics = next;
            this.emit();
        }
    }

    private setFoldingRanges(ranges: FoldingRange[]): void {
        const ids = new Set(ranges.map((r) => r.id));
        const others = this.state.foldingRanges.filter((r) => !ids.has(r.id));
        this.state.foldingRanges = [...others, ...ranges];
        this.emit();
    }

    private clearFoldingRanges(ownerId: string): void {
        const prefix = ownerId + ":";
        const next = this.state.foldingRanges.filter((r) => !r.id.startsWith(prefix));
        if (next.length !== this.state.foldingRanges.length) {
            this.state.foldingRanges = next;
            this.emit();
        }
    }

    // ── Panel management ─────────────────────────────────────

    private registerPanel(panel: PanelDescriptor): void {
        this.state.panels = new Map(this.state.panels);
        this.state.panels.set(panel.id, panel);
        this.emit();
    }

    private unregisterPanel(id: string): void {
        if (!this.state.panels.has(id)) return;
        this.state.panels = new Map(this.state.panels);
        this.state.panels.delete(id);
        this.state.openPanels = new Set(this.state.openPanels);
        this.state.openPanels.delete(id);
        this.emit();
    }

    togglePanel(id: string): void {
        this.state.openPanels = new Set(this.state.openPanels);
        if (this.state.openPanels.has(id)) {
            this.state.openPanels.delete(id);
        } else {
            this.state.openPanels.add(id);
        }
        this.emit();
    }

    // ── Completion provider management ───────────────────────

    private registerCompletionProvider(provider: CompletionProvider): void {
        this.state.completionProviders = new Map(this.state.completionProviders);
        this.state.completionProviders.set(provider.id, provider);
        this.emit();
    }

    private unregisterCompletionProvider(id: string): void {
        if (!this.state.completionProviders.has(id)) return;
        this.state.completionProviders = new Map(this.state.completionProviders);
        this.state.completionProviders.delete(id);
        this.emit();
    }

    // ── Command management ───────────────────────────────────

    private registerCommand(id: string, handler: (...args: unknown[]) => void): void {
        this.state.commands = new Map(this.state.commands);
        this.state.commands.set(id, handler);
    }

    private executeCommand(id: string, ...args: unknown[]): void {
        const cmd = this.state.commands.get(id);
        if (cmd) cmd(...args);
        else console.warn(`[PluginHost] Command "${id}" not found.`);
    }

    // ── API Factory (cached per plugin) ──────────────────────

    getAPI(pluginId: string): ExtendedPluginAPI {
        let api = this.apiCache.get(pluginId);
        if (!api) {
            api = this.createAPI(pluginId);
            this.apiCache.set(pluginId, api);
        }
        return api;
    }

    createAPI(pluginId: string): ExtendedPluginAPI {
        const host = this;
        const store = this.store;
        const textareaRef = this.textareaRef;

        const addDisposable = (fn: () => void) => {
            if (!host.disposables.has(pluginId)) {
                host.disposables.set(pluginId, []);
            }
            host.disposables.get(pluginId)!.push(fn);
        };

        return {
            getContent: () => store.getState().content,
            setContent: (content: string) => store.getState().pushChange(content),
            getSelection: () => {
                const ta = textareaRef.current;
                if (!ta) return { start: 0, end: 0, text: "" };
                return {
                    start: ta.selectionStart,
                    end: ta.selectionEnd,
                    text: ta.value.slice(ta.selectionStart, ta.selectionEnd),
                };
            },
            setSelection: (start: number, end: number) => {
                const ta = textareaRef.current;
                if (!ta) return;
                ta.selectionStart = start;
                ta.selectionEnd = end;
                ta.focus();
            },
            insertText: (text: string, position?: number) => {
                const ta = textareaRef.current;
                if (!ta) return;
                const pos = position ?? ta.selectionStart;
                const val = ta.value;
                const newContent = val.slice(0, pos) + text + val.slice(pos);
                store.getState().pushChange(newContent);
                requestAnimationFrame(() => {
                    ta.selectionStart = pos + text.length;
                    ta.selectionEnd = pos + text.length;
                    ta.focus();
                });
            },
            getTheme: () => {
                const themeId = store.getState().activeThemeId;
                const tm = ThemeManager.getInstance();
                return tm.get(themeId) ?? tm.get("dracula")!;
            },
            setTheme: (themeId: string) => store.getState().setThemeId(themeId),
            showToast: (title: string, description?: string, type?: "default" | "success" | "error") => {
                if (type === "error") {
                    store.getState().setError(description ?? title);
                } else {
                    console.info(`[Plugin:${pluginId}] ${title}${description ? ": " + description : ""}`);
                }
            },
            registerFormatter: (definition: FormatterDefinition) => {
                FormatterRegistry.register(definition);
                addDisposable(() => FormatterRegistry.unregister(definition.name));
            },
            registerKeybinding: (binding: KeyBinding) => {
                host.keybindingManager.registerPluginBindings(pluginId, [binding]);
                addDisposable(() => host.keybindingManager.unregisterPluginBindings(pluginId));
            },
            addContextMenuItem: (_item: ContextMenuItem) => {
                // Context menu items gathered at render time from plugin.contextMenuItems
            },
            getFileInfo: () => {
                const s = store.getState();
                return { fileName: s.fileName, filePath: s.filePath, language: s.language };
            },

            addInlineDecorations: (decs) => host.addInlineDecorations(decs),
            removeInlineDecorations: (ids) => host.removeInlineDecorations(ids),
            clearInlineDecorations: (ownerId) => host.clearInlineDecorations(ownerId),
            addGutterDecorations: (decs) => host.addGutterDecorations(decs),
            removeGutterDecorations: (ids) => host.removeGutterDecorations(ids),
            clearGutterDecorations: (ownerId) => host.clearGutterDecorations(ownerId),
            setCodeLenses: (lenses) => host.setCodeLenses(lenses),
            clearCodeLenses: (ownerId) => host.clearCodeLenses(ownerId),
            setInlineAnnotations: (anns) => host.setInlineAnnotations(anns),
            clearInlineAnnotations: (ownerId) => host.clearInlineAnnotations(ownerId),
            registerCompletionProvider: (provider) => {
                host.registerCompletionProvider(provider);
                addDisposable(() => host.unregisterCompletionProvider(provider.id));
            },
            unregisterCompletionProvider: (id) => host.unregisterCompletionProvider(id),
            setDiagnostics: (diags) => host.setDiagnostics(diags),
            clearDiagnostics: (ownerId) => host.clearDiagnostics(ownerId),
            setFoldingRanges: (ranges) => host.setFoldingRanges(ranges),
            clearFoldingRanges: (ownerId) => host.clearFoldingRanges(ownerId),
            registerPanel: (panel) => {
                host.registerPanel(panel);
                addDisposable(() => host.unregisterPanel(panel.id));
            },
            unregisterPanel: (id) => host.unregisterPanel(id),
            togglePanel: (id) => host.togglePanel(id),
            isPanelOpen: (id) => host.state.openPanels.has(id),

            getState: () => store.getState() as unknown as Record<string, unknown>,
            subscribe: (listener) => {
                const unsub = host.subscribe(listener);
                addDisposable(unsub);
                return unsub;
            },

            getCursorPosition: () => {
                const ta = textareaRef.current;
                if (!ta) return { line: 1, col: 1, offset: 0 };
                const s = store.getState();
                return { line: s.cursorLine, col: s.cursorCol, offset: ta.selectionStart };
            },
            getLineContent: (line: number) => {
                const lines = store.getState().content.split("\n");
                return lines[line - 1] ?? "";
            },
            getLineCount: () => store.getState().lineCount,

            getSurroundingContext: (radius = 250) => {
                const s = store.getState();
                const lines = s.content.split("\n");
                const curLine = s.cursorLine;
                const curCol = s.cursorCol;
                const startLine = Math.max(0, curLine - 1 - radius);
                const endLine = Math.min(lines.length, curLine + radius);
                return {
                    linesBefore: lines.slice(startLine, curLine - 1),
                    currentLine: lines[curLine - 1] ?? "",
                    linesAfter: lines.slice(curLine, endLine),
                    cursorLine: curLine,
                    cursorCol: curCol,
                };
            },

            registerCommand: (id, handler) => {
                host.registerCommand(`${pluginId}:${id}`, handler);
                addDisposable(() => {
                    const cmds = new Map(host.state.commands);
                    cmds.delete(`${pluginId}:${id}`);
                    host.state.commands = cmds;
                });
            },
            executeCommand: (id, ...args) => host.executeCommand(id, ...args),

            onContentChange: (listener) => {
                host.contentListeners.add(listener);
                addDisposable(() => host.contentListeners.delete(listener));
                return () => host.contentListeners.delete(listener);
            },
            onSelectionChange: (listener) => {
                host.selectionListeners.add(listener);
                addDisposable(() => host.selectionListeners.delete(listener));
                return () => host.selectionListeners.delete(listener);
            },
            onSave: (listener) => {
                host.saveListeners.add(listener);
                addDisposable(() => host.saveListeners.delete(listener));
                return () => host.saveListeners.delete(listener);
            },
            onLanguageChange: (listener) => {
                host.languageListeners.add(listener);
                addDisposable(() => host.languageListeners.delete(listener));
                return () => host.languageListeners.delete(listener);
            },
        };
    }

    // ── Cleanup ──────────────────────────────────────────────

    destroy(): void {
        for (const id of this.state.enabledPlugins) {
            this.disable(id);
        }
        this.state = createEmptyState();
        this.listeners.clear();
        this.contentListeners.clear();
        this.selectionListeners.clear();
        this.saveListeners.clear();
        this.languageListeners.clear();
        this.apiCache.clear();
        this.keybindingManager.destroy();
    }
}
