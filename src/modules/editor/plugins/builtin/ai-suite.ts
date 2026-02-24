/**
 * @module editor/plugins/builtin/ai-suite
 *
 * AI-Assisted Capabilities plugin suite.
 * Provides:
 *  - AI code completion (ghost text)
 *  - Inline code explanation
 *  - Refactoring suggestions
 *  - AI-based bug detection
 *  - Natural language to code
 *  - Smart commit message generation
 *  - Auto documentation generator
 *  - Code summarization for large files
 *  - AI-based test case generation
 *
 * All AI features use a pluggable adapter pattern so the backend
 * (OpenAI, Anthropic, local LLM, etc.) can be swapped without
 * changing plugin code. By default ships with a mock/demo adapter.
 */
import { createElement } from "react";
import type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    CompletionProvider,
    CompletionItem,
    CompletionContext,
    InlineAnnotation,
    PanelDescriptor,
} from "../types";

// ═══════════════════════════════════════════════════════════════
//  AI ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface AiAdapter {
    /** Complete the code at cursor position */
    complete(prompt: string, context: AiContext): Promise<string>;
    /** Explain a code selection */
    explain(code: string, language: string): Promise<string>;
    /** Suggest refactoring for a code selection */
    refactor(code: string, language: string): Promise<string>;
    /** Detect bugs in code */
    detectBugs(code: string, language: string): Promise<AiBugReport[]>;
    /** Convert natural language to code */
    naturalLanguageToCode(prompt: string, language: string): Promise<string>;
    /** Generate a commit message from a diff */
    generateCommitMessage(diff: string): Promise<string>;
    /** Generate documentation for code */
    generateDocs(code: string, language: string): Promise<string>;
    /** Summarize a large file */
    summarize(content: string, language: string): Promise<string>;
    /** Generate test cases for code */
    generateTests(code: string, language: string): Promise<string>;
    /** Explain selected code inline */
    explainSelection(code: string, language: string): Promise<string>;
    /** Fix selected code */
    fixSelection(code: string, language: string): Promise<string>;
}

export interface AiContext {
    content: string;
    cursorOffset: number;
    language: string;
    fileName: string;
    lineText: string;
    lineBefore: string;
    lineAfter: string;
}

export interface AiBugReport {
    line: number;
    message: string;
    severity: "error" | "warning" | "info";
    suggestion?: string;
}

// ═══════════════════════════════════════════════════════════════
//  DEMO / MOCK ADAPTER
// ═══════════════════════════════════════════════════════════════

/**
 * Demo AI adapter that returns plausible mock results.
 * Replace with a real adapter (OpenAI, Anthropic, etc.) in production.
 */
export class DemoAiAdapter implements AiAdapter {
    async complete(prompt: string, ctx: AiContext): Promise<string> {
        // Simulate a context-aware completion
        const line = ctx.lineText.trim();

        if (line.endsWith("= ")) return "null;";
        if (line.endsWith("(")) return ")";
        if (line.includes("console.")) return "log()";
        if (line.includes("import ")) return `{ } from '';`;
        if (line.includes("function ")) return "() {\n  \n}";
        if (line.includes("const ")) return "value = null;";
        if (line.endsWith("//")) return " TODO: implement";

        return "";
    }

    async explain(code: string, language: string): Promise<string> {
        const lines = code.split("\n").length;
        return [
            `## Code Explanation (${language})`,
            "",
            `This code block contains ${lines} lines of ${language} code.`,
            "",
            "### Summary",
            `The code appears to define logic for processing data. ` +
            `Key constructs include variable declarations, function calls, and control flow statements.`,
            "",
            "### Key Points",
            "- Variables are declared using appropriate scope keywords",
            "- Functions follow standard naming conventions",
            "- Error handling patterns are present where needed",
            "",
            "*Note: This is a demo explanation. Connect a real AI adapter for detailed analysis.*",
        ].join("\n");
    }

    async refactor(code: string, language: string): Promise<string> {
        return [
            `// Refactoring suggestions for ${language}:`,
            "// 1. Consider extracting repeated logic into helper functions",
            "// 2. Use descriptive variable names for better readability",
            "// 3. Add type annotations where possible",
            "// 4. Consider using early returns to reduce nesting",
            "",
            "// Demo adapter – connect a real AI for actual refactored code.",
            "",
            code,
        ].join("\n");
    }

    async detectBugs(code: string, language: string): Promise<AiBugReport[]> {
        const bugs: AiBugReport[] = [];
        const lines = code.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Simple heuristic checks
            if (line.includes("== null") && !line.includes("=== null")) {
                bugs.push({
                    line: i + 1,
                    message: "Use strict equality (===) instead of loose equality (==) for null checks",
                    severity: "warning",
                    suggestion: line.replace("== null", "=== null"),
                });
            }
            if (line.match(/catch\s*\(\s*\w+\s*\)\s*\{\s*\}/)) {
                bugs.push({
                    line: i + 1,
                    message: "Empty catch block – errors are silently swallowed",
                    severity: "warning",
                });
            }
            if (line.includes("var ")) {
                bugs.push({
                    line: i + 1,
                    message: "Prefer 'const' or 'let' over 'var' to avoid hoisting issues",
                    severity: "info",
                    suggestion: line.replace("var ", "const "),
                });
            }
        }

        return bugs;
    }

    async naturalLanguageToCode(prompt: string, language: string): Promise<string> {
        const lower = prompt.toLowerCase();
        if (lower.includes("hello world")) {
            if (language === "python") return 'print("Hello, World!")';
            if (language === "go") return 'fmt.Println("Hello, World!")';
            return 'console.log("Hello, World!");';
        }
        if (lower.includes("fetch") || lower.includes("api")) {
            return [
                "async function fetchData(url) {",
                "  try {",
                "    const response = await fetch(url);",
                "    if (!response.ok) throw new Error(`HTTP ${response.status}`);",
                "    return await response.json();",
                "  } catch (error) {",
                "    console.error('Fetch failed:', error);",
                "    throw error;",
                "  }",
                "}",
            ].join("\n");
        }
        return `// Generated from: "${prompt}"\n// Connect a real AI adapter for actual code generation.`;
    }

    async generateCommitMessage(diff: string): Promise<string> {
        const addCount = (diff.match(/^\+[^+]/gm) || []).length;
        const removeCount = (diff.match(/^-[^-]/gm) || []).length;

        if (addCount > removeCount * 2) return "feat: add new functionality";
        if (removeCount > addCount * 2) return "refactor: remove unused code";
        if (addCount > 0 && removeCount > 0) return "fix: update logic and fix issues";
        return "chore: update files";
    }

    async generateDocs(code: string, language: string): Promise<string> {
        const lines = code.split("\n");
        const fnMatch = lines[0]?.match(/(?:function|def|fn|func)\s+(\w+)/);
        const name = fnMatch?.[1] ?? "unknown";

        if (language === "python") {
            return `"""${name}\n\nDescription:\n    TODO: Add description\n\nArgs:\n    TODO: Document arguments\n\nReturns:\n    TODO: Document return value\n"""\n${code}`;
        }

        return `/**\n * ${name}\n *\n * @description TODO: Add description\n * @param {*} args - TODO: Document parameters\n * @returns {*} TODO: Document return value\n */\n${code}`;
    }

    async summarize(content: string, language: string): Promise<string> {
        const lines = content.split("\n");
        const fns = lines.filter((l) => l.match(/(?:function|def|fn|func|class|interface|type|struct)\s+\w+/)).length;
        const imports = lines.filter((l) => l.match(/^(?:import|from|require|use|#include)/)).length;

        return [
            `## File Summary (${language})`,
            "",
            `- **Total lines**: ${lines.length}`,
            `- **Functions/Classes**: ~${fns}`,
            `- **Imports**: ${imports}`,
            "",
            "*Connect a real AI adapter for detailed summarization.*",
        ].join("\n");
    }

    async generateTests(code: string, language: string): Promise<string> {
        const fnMatch = code.match(/(?:function|def|fn|func)\s+(\w+)/);
        const name = fnMatch?.[1] ?? "myFunction";

        if (language === "python") {
            return [
                `import pytest`,
                ``,
                `class Test${name.charAt(0).toUpperCase() + name.slice(1)}:`,
                `    def test_basic(self):`,
                `        """Test basic functionality of ${name}"""`,
                `        # TODO: Set up test data`,
                `        result = ${name}()`,
                `        assert result is not None`,
                ``,
                `    def test_edge_case(self):`,
                `        """Test edge cases for ${name}"""`,
                `        # TODO: Add edge case tests`,
                `        pass`,
                ``,
                `    def test_error_handling(self):`,
                `        """Test error handling in ${name}"""`,
                `        # TODO: Test error scenarios`,
                `        with pytest.raises(Exception):`,
                `            ${name}(None)`,
            ].join("\n");
        }

        return [
            `describe("${name}", () => {`,
            `  it("should work with basic input", () => {`,
            `    // TODO: Set up test data`,
            `    const result = ${name}();`,
            `    expect(result).toBeDefined();`,
            `  });`,
            ``,
            `  it("should handle edge cases", () => {`,
            `    // TODO: Add edge case tests`,
            `    expect(() => ${name}(null)).not.toThrow();`,
            `  });`,
            ``,
            `  it("should handle errors gracefully", () => {`,
            `    // TODO: Test error scenarios`,
            `    expect(() => ${name}(undefined)).not.toThrow();`,
            `  });`,
            `});`,
        ].join("\n");
    }

    async explainSelection(code: string, language: string): Promise<string> {
        const lines = code.split("\n").length;
        return `This ${language} code (${lines} line${lines !== 1 ? "s" : ""}) performs data processing. Connect a real AI adapter for detailed explanation.`;
    }

    async fixSelection(code: string, language: string): Promise<string> {
        // Simple heuristic fixes
        let fixed = code;
        fixed = fixed.replace(/\bvar\b/g, "const");
        fixed = fixed.replace(/==(?!=)/g, "===");
        fixed = fixed.replace(/!=(?!=)/g, "!==");
        return fixed;
    }
}

// ═══════════════════════════════════════════════════════════════
//  AI COMPLETION PROVIDER
// ═══════════════════════════════════════════════════════════════

class AiCompletionProvider implements CompletionProvider {
    id = "ai-suite:completion";
    triggerCharacters = [" ", ".", "(", "=", ":"];
    private adapter: AiAdapter;

    constructor(adapter: AiAdapter) {
        this.adapter = adapter;
    }

    async provideCompletions(ctx: CompletionContext): Promise<CompletionItem[]> {
        if (ctx.wordBeforeCursor.length < 2 && !ctx.triggerCharacter) return [];

        try {
            const result = await this.adapter.complete(ctx.lineText, {
                content: ctx.content,
                cursorOffset: ctx.cursorOffset,
                language: ctx.language,
                fileName: ctx.fileName,
                lineText: ctx.lineText,
                lineBefore: ctx.content.slice(Math.max(0, ctx.cursorOffset - 500), ctx.cursorOffset),
                lineAfter: ctx.content.slice(ctx.cursorOffset, ctx.cursorOffset + 200),
            });

            if (!result) return [];

            return [
                {
                    label: result.length > 40 ? result.slice(0, 40) + "…" : result,
                    kind: "ai",
                    detail: "AI Suggestion",
                    documentation: result,
                    insertText: result,
                    sortOrder: -1, // Highest priority
                },
            ];
        } catch {
            return [];
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  AI RESULTS PANEL
// ═══════════════════════════════════════════════════════════════

let _lastAiResult = "";

function AiResultsPanel({ api }: { api: ExtendedPluginAPI }) {
    return createElement("div", {
        style: {
            padding: "16px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: "13px",
            lineHeight: "1.6",
            color: "var(--editor-foreground, #f8f8f2)",
            overflow: "auto",
            height: "100%",
            whiteSpace: "pre-wrap",
        },
    },
        _lastAiResult
            ? createElement("div", null,
                createElement("div", {
                    style: { marginBottom: "12px", fontWeight: 600, color: "var(--editor-accent, #bd93f9)" },
                }, "AI Results"),
                createElement("pre", {
                    style: {
                        whiteSpace: "pre-wrap",
                        background: "var(--editor-input-bg, #282a36)",
                        padding: "12px",
                        borderRadius: "6px",
                        border: "1px solid var(--editor-border, #44475a)",
                        fontSize: "12px",
                        fontFamily: "var(--editor-font-family, monospace)",
                    },
                }, _lastAiResult),
              )
            : createElement("div", {
                style: { color: "var(--editor-muted, #6272a4)", textAlign: "center", marginTop: "40px" },
            }, "Run an AI command to see results here.\n\nUse the context menu or keyboard shortcuts."),
    );
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

export function createAiSuitePlugin(adapter?: AiAdapter): ExtendedEditorPlugin {
    const ai = adapter ?? new DemoAiAdapter();

    return {
        id: "ai-suite",
        name: "AI Assistant",
        version: "1.0.0",
        description: "AI-powered code completion, explanation, refactoring, bug detection, and more",
        category: "ai",
        defaultEnabled: true,

        completionProviders: [new AiCompletionProvider(ai)],

        panels: [
            {
                id: "ai-suite:panel",
                title: "AI Results",
                position: "right",
                defaultSize: 400,
                render: (api) => createElement(AiResultsPanel, { api }),
            },
        ],

        onActivate(api) {
            // ── Register AI commands ─────────────────────────

            api.registerCommand("ai.explain", async () => {
                const sel = api.getSelection();
                const code = sel.text || api.getContent();
                const { language } = api.getFileInfo();
                _lastAiResult = "Analyzing…";
                api.togglePanel("ai-suite:panel");
                const result = await ai.explain(code, language);
                _lastAiResult = result;
                // Force panel re-render by toggling
                if (!api.isPanelOpen("ai-suite:panel")) api.togglePanel("ai-suite:panel");
            });

            api.registerCommand("ai.refactor", async () => {
                const sel = api.getSelection();
                if (!sel.text) { api.showToast("AI Refactor", "Select code to refactor", "error"); return; }
                const { language } = api.getFileInfo();
                _lastAiResult = "Refactoring…";
                api.togglePanel("ai-suite:panel");
                const result = await ai.refactor(sel.text, language);
                _lastAiResult = result;
            });

            api.registerCommand("ai.detectBugs", async () => {
                const content = api.getContent();
                const { language } = api.getFileInfo();
                _lastAiResult = "Scanning for bugs…";
                api.togglePanel("ai-suite:panel");
                const bugs = await ai.detectBugs(content, language);
                if (bugs.length === 0) {
                    _lastAiResult = "No bugs detected! ✓";
                } else {
                    _lastAiResult = bugs.map((b) =>
                        `Line ${b.line} [${b.severity}]: ${b.message}${b.suggestion ? "\n  → Suggestion: " + b.suggestion : ""}`,
                    ).join("\n\n");
                }
            });

            api.registerCommand("ai.naturalLanguage", async (prompt?: unknown) => {
                const text = typeof prompt === "string" ? prompt : "hello world";
                const { language } = api.getFileInfo();
                const code = await ai.naturalLanguageToCode(text, language);
                api.insertText(code);
            });

            api.registerCommand("ai.commitMessage", async () => {
                const content = api.getContent();
                const message = await ai.generateCommitMessage(content);
                _lastAiResult = `Suggested commit message:\n\n${message}`;
                api.togglePanel("ai-suite:panel");
            });

            api.registerCommand("ai.generateDocs", async () => {
                const sel = api.getSelection();
                const code = sel.text || api.getContent();
                const { language } = api.getFileInfo();
                const docs = await ai.generateDocs(code, language);
                _lastAiResult = docs;
                api.togglePanel("ai-suite:panel");
            });

            api.registerCommand("ai.summarize", async () => {
                const content = api.getContent();
                const { language } = api.getFileInfo();
                const summary = await ai.summarize(content, language);
                _lastAiResult = summary;
                api.togglePanel("ai-suite:panel");
            });

            api.registerCommand("ai.generateTests", async () => {
                const sel = api.getSelection();
                const code = sel.text || api.getContent();
                const { language } = api.getFileInfo();
                const tests = await ai.generateTests(code, language);
                _lastAiResult = tests;
                api.togglePanel("ai-suite:panel");
            });

            api.registerCommand("ai.explainSelection", async () => {
                const sel = api.getSelection();
                if (!sel.text) { api.showToast("AI", "Select code to explain", "error"); return; }
                const { language } = api.getFileInfo();
                const explanation = await ai.explainSelection(sel.text, language);
                _lastAiResult = explanation;
                api.togglePanel("ai-suite:panel");
            });

            api.registerCommand("ai.fixSelection", async () => {
                const sel = api.getSelection();
                if (!sel.text) { api.showToast("AI", "Select code to fix", "error"); return; }
                const { language } = api.getFileInfo();
                const fixed = await ai.fixSelection(sel.text, language);
                // Replace selection with fixed code
                const content = api.getContent();
                const newContent = content.slice(0, sel.start) + fixed + content.slice(sel.end);
                api.setContent(newContent);
                api.showToast("AI Fix", "Code fixed", "success");
            });

            // ── Register keybindings ─────────────────────────

            api.registerKeybinding({
                id: "ai-suite:explain",
                label: "AI: Explain Code",
                keys: "Ctrl+Shift+E",
                handler: () => api.executeCommand("ai-suite:ai.explain"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:refactor",
                label: "AI: Refactor Selection",
                keys: "Ctrl+Shift+R",
                handler: () => api.executeCommand("ai-suite:ai.refactor"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:bugs",
                label: "AI: Detect Bugs",
                keys: "Ctrl+Shift+B",
                handler: () => api.executeCommand("ai-suite:ai.detectBugs"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:docs",
                label: "AI: Generate Docs",
                keys: "Ctrl+Shift+D",
                handler: () => api.executeCommand("ai-suite:ai.generateDocs"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:tests",
                label: "AI: Generate Tests",
                keys: "Ctrl+Shift+T",
                handler: () => api.executeCommand("ai-suite:ai.generateTests"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:summarize",
                label: "AI: Summarize File",
                keys: "Ctrl+Shift+U",
                handler: () => api.executeCommand("ai-suite:ai.summarize"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:explain-selection",
                label: "AI: Explain Selection",
                keys: "Ctrl+Alt+E",
                handler: () => api.executeCommand("ai-suite:ai.explainSelection"),
                when: "editor",
                category: "AI",
            });

            api.registerKeybinding({
                id: "ai-suite:fix-selection",
                label: "AI: Fix Selection",
                keys: "Ctrl+Alt+F",
                handler: () => api.executeCommand("ai-suite:ai.fixSelection"),
                when: "editor",
                category: "AI",
            });

            // ── Context menu items ───────────────────────────

            api.addContextMenuItem({
                label: "AI: Explain Selection",
                action: () => api.executeCommand("ai-suite:ai.explainSelection"),
                shortcut: "Ctrl+Alt+E",
                priority: 100,
            });

            api.addContextMenuItem({
                label: "AI: Fix Selection",
                action: () => api.executeCommand("ai-suite:ai.fixSelection"),
                shortcut: "Ctrl+Alt+F",
                priority: 101,
            });

            api.addContextMenuItem({
                label: "AI: Refactor Selection",
                action: () => api.executeCommand("ai-suite:ai.refactor"),
                shortcut: "Ctrl+Shift+R",
                priority: 102,
            });

            api.addContextMenuItem({
                label: "AI: Generate Tests",
                action: () => api.executeCommand("ai-suite:ai.generateTests"),
                shortcut: "Ctrl+Shift+T",
                priority: 103,
            });

            api.addContextMenuItem({
                label: "AI: Generate Docs",
                action: () => api.executeCommand("ai-suite:ai.generateDocs"),
                shortcut: "Ctrl+Shift+D",
                priority: 104,
            });

            api.addContextMenuItem({
                label: "AI: Detect Bugs",
                action: () => api.executeCommand("ai-suite:ai.detectBugs"),
                shortcut: "Ctrl+Shift+B",
                priority: 105,
            });
        },
    };
}
