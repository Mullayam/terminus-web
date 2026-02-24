/**
 * @module editor/plugins/PluginHost
 *
 * Core plugin host that manages plugin lifecycle, routing events,
 * and aggregating decorations / panels / completions from all active plugins.
 *
 * This is a pure TypeScript class – no React dependency.
 * The React integration is done via usePluginHost hook.
 */
import type { StoreApi } from "zustand";
import type { EditorStoreType, EditorTheme, FormatterDefinition, KeyBinding, ContextMenuItem } from "../types";
import type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    PluginHostState,
    InlineDecoration,
    GutterDecoration,
    CodeLensItem,
    InlineAnnotation,
    CompletionProvider,
    Diagnostic,
    PanelDescriptor,
} from "./types";
import { ThemeManager } from "../themes/manager";
import { FormatterRegistry } from "../formatters";

type Listener = () => void;

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

    constructor(
        store: StoreApi<EditorStoreType>,
        textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>,
    ) {
        this.store = store;
        this.textareaRef = textareaRef;
        this.state = {
            plugins: new Map(),
            enabledPlugins: new Set(),
            inlineDecorations: [],
            gutterDecorations: [],
            codeLenses: [],
            inlineAnnotations: [],
            diagnostics: [],
            panels: new Map(),
            openPanels: new Set(),
            completionProviders: new Map(),
            commands: new Map(),
        };
    }

    // ── State snapshot (for React) ───────────────────────────

    getSnapshot(): PluginHostState {
        return this.state;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit() {
        // Create a new state reference so React detects the change
        this.state = { ...this.state };
        this.listeners.forEach((l) => l());
    }

    // ── Plugin registration ──────────────────────────────────

    register(plugin: ExtendedEditorPlugin): void {
        if (this.state.plugins.has(plugin.id)) {
            console.warn(`[PluginHost] Plugin "${plugin.id}" is already registered.`);
            return;
        }
        this.state.plugins.set(plugin.id, plugin);
        if (plugin.defaultEnabled !== false) {
            this.enable(plugin.id);
        }
        this.emit();
    }

    unregister(pluginId: string): void {
        this.disable(pluginId);
        this.state.plugins.delete(pluginId);
        this.emit();
    }

    enable(pluginId: string): void {
        const plugin = this.state.plugins.get(pluginId);
        if (!plugin || this.state.enabledPlugins.has(pluginId)) return;

        this.state.enabledPlugins.add(pluginId);
        const api = this.createAPI(pluginId);

        // Run legacy onInit / onMount
        try { plugin.onInit?.(api); } catch (e) { console.error(`[Plugin:${pluginId}] onInit error:`, e); }
        try { plugin.onMount?.(api); } catch (e) { console.error(`[Plugin:${pluginId}] onMount error:`, e); }

        // Run extended onActivate
        const activateResult = plugin.onActivate?.(api);
        if (activateResult instanceof Promise) {
            activateResult.catch((e) => console.error(`[Plugin:${pluginId}] onActivate error:`, e));
        }

        // Register static contributions
        plugin.keybindings?.forEach((kb) => api.registerKeybinding(kb));
        plugin.contextMenuItems?.forEach((item) => api.addContextMenuItem(item));
        plugin.formatters?.forEach((f) => api.registerFormatter(f));
        plugin.panels?.forEach((p) => this.registerPanel(p));
        plugin.completionProviders?.forEach((cp) => this.registerCompletionProvider(cp));

        this.emit();
    }

    disable(pluginId: string): void {
        if (!this.state.enabledPlugins.has(pluginId)) return;
        const plugin = this.state.plugins.get(pluginId);
        const api = this.createAPI(pluginId);

        try { plugin?.onDeactivate?.(api); } catch (e) { console.error(`[Plugin:${pluginId}] onDeactivate error:`, e); }
        try { plugin?.onUnmount?.(); } catch (e) { console.error(`[Plugin:${pluginId}] onUnmount error:`, e); }

        // Clean up disposables
        this.disposables.get(pluginId)?.forEach((d) => d());
        this.disposables.delete(pluginId);

        // Remove contributions owned by this plugin
        this.clearInlineDecorations(pluginId);
        this.clearGutterDecorations(pluginId);
        this.clearCodeLenses(pluginId);
        this.clearInlineAnnotations(pluginId);
        this.clearDiagnostics(pluginId);

        this.state.enabledPlugins.delete(pluginId);
        this.emit();
    }

    isEnabled(pluginId: string): boolean {
        return this.state.enabledPlugins.has(pluginId);
    }

    getPlugins(): ExtendedEditorPlugin[] {
        return Array.from(this.state.plugins.values());
    }

    // ── Event dispatching ────────────────────────────────────

    dispatchContentChange(content: string): void {
        this.contentListeners.forEach((l) => l(content));
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onContentChange) {
                try { plugin.onContentChange(content, this.createAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onContentChange error:`, e); }
            }
        }
    }

    dispatchSelectionChange(selection: { start: number; end: number; text: string }): void {
        this.selectionListeners.forEach((l) => l(selection));
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onSelectionChange) {
                try { plugin.onSelectionChange(selection, this.createAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onSelectionChange error:`, e); }
            }
        }
    }

    dispatchSave(): void {
        this.saveListeners.forEach((l) => l());
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onSave) {
                try { plugin.onSave(this.createAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onSave error:`, e); }
            }
        }
    }

    dispatchLanguageChange(language: string): void {
        this.languageListeners.forEach((l) => l(language));
        for (const [id, plugin] of this.state.plugins) {
            if (this.state.enabledPlugins.has(id) && plugin.onLanguageChange) {
                try { plugin.onLanguageChange(language, this.createAPI(id)); }
                catch (e) { console.error(`[Plugin:${id}] onLanguageChange error:`, e); }
            }
        }
    }

    // ── Decoration management ────────────────────────────────

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
        this.state.inlineDecorations = this.state.inlineDecorations.filter(
            (d) => !d.id.startsWith(`${ownerId}:`),
        );
        this.emit();
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
        this.state.gutterDecorations = this.state.gutterDecorations.filter(
            (d) => !d.id.startsWith(`${ownerId}:`),
        );
        this.emit();
    }

    private setCodeLenses(lenses: CodeLensItem[]): void {
        // Replace all lenses – the caller is responsible for including its own
        const otherLenses = this.state.codeLenses.filter(
            (l) => !lenses.some((nl) => nl.id === l.id),
        );
        this.state.codeLenses = [...otherLenses, ...lenses];
        this.emit();
    }

    private clearCodeLenses(ownerId: string): void {
        this.state.codeLenses = this.state.codeLenses.filter(
            (l) => !l.id.startsWith(`${ownerId}:`),
        );
        this.emit();
    }

    private setInlineAnnotations(annotations: InlineAnnotation[]): void {
        const ids = new Set(annotations.map((a) => a.id));
        const others = this.state.inlineAnnotations.filter((a) => !ids.has(a.id));
        this.state.inlineAnnotations = [...others, ...annotations];
        this.emit();
    }

    private clearInlineAnnotations(ownerId: string): void {
        this.state.inlineAnnotations = this.state.inlineAnnotations.filter(
            (a) => !a.id.startsWith(`${ownerId}:`),
        );
        this.emit();
    }

    private setDiagnostics(diagnostics: Diagnostic[]): void {
        const ids = new Set(diagnostics.map((d) => d.id));
        const others = this.state.diagnostics.filter((d) => !ids.has(d.id));
        this.state.diagnostics = [...others, ...diagnostics];
        this.emit();
    }

    private clearDiagnostics(ownerId: string): void {
        this.state.diagnostics = this.state.diagnostics.filter(
            (d) => !d.id.startsWith(`${ownerId}:`),
        );
        this.emit();
    }

    // ── Panel management ─────────────────────────────────────

    private registerPanel(panel: PanelDescriptor): void {
        this.state.panels.set(panel.id, panel);
        this.emit();
    }

    private unregisterPanel(id: string): void {
        this.state.panels.delete(id);
        this.state.openPanels.delete(id);
        this.emit();
    }

    private togglePanel(id: string): void {
        if (this.state.openPanels.has(id)) {
            this.state.openPanels = new Set(this.state.openPanels);
            this.state.openPanels.delete(id);
        } else {
            this.state.openPanels = new Set(this.state.openPanels);
            this.state.openPanels.add(id);
        }
        this.emit();
    }

    // ── Completion provider management ───────────────────────

    private registerCompletionProvider(provider: CompletionProvider): void {
        this.state.completionProviders.set(provider.id, provider);
        this.emit();
    }

    private unregisterCompletionProvider(id: string): void {
        this.state.completionProviders.delete(id);
        this.emit();
    }

    // ── Command management ───────────────────────────────────

    private registerCommand(id: string, handler: (...args: unknown[]) => void): void {
        this.state.commands.set(id, handler);
    }

    private executeCommand(id: string, ...args: unknown[]): void {
        const cmd = this.state.commands.get(id);
        if (cmd) cmd(...args);
        else console.warn(`[PluginHost] Command "${id}" not found.`);
    }

    // ── API Factory ──────────────────────────────────────────

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
            // ── Base EditorPluginAPI ─────────────────────────
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
                // Use the store's error field for simple toasts, or console
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
            registerKeybinding: (_binding: KeyBinding) => {
                // Keybindings are handled externally; store them for reference
                // The usePluginHost hook reads them from plugin.keybindings
            },
            addContextMenuItem: (_item: ContextMenuItem) => {
                // Context menu items gathered from activated plugins at render time
            },
            getFileInfo: () => {
                const s = store.getState();
                return { fileName: s.fileName, filePath: s.filePath, language: s.language };
            },

            // ── Extended API ─────────────────────────────────
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

            registerCommand: (id, handler) => {
                host.registerCommand(`${pluginId}:${id}`, handler);
                addDisposable(() => host.state.commands.delete(`${pluginId}:${id}`));
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
        this.state.plugins.clear();
        this.listeners.clear();
        this.contentListeners.clear();
        this.selectionListeners.clear();
        this.saveListeners.clear();
        this.languageListeners.clear();
    }
}
