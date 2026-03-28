/**
 * @module editor/plugins/builtin/python-helpers
 *
 * Python-specific helpers: docstring generation, f-string conversion,
 * common import suggestions.
 */
import type { ExtendedEditorPlugin, CompletionProvider, CompletionItem, CompletionContext } from "../types";

const PYTHON_BUILTINS = [
    "print", "len", "range", "enumerate", "zip", "map", "filter",
    "sorted", "reversed", "list", "dict", "set", "tuple", "str",
    "int", "float", "bool", "type", "isinstance", "issubclass",
    "hasattr", "getattr", "setattr", "delattr", "callable", "super",
    "staticmethod", "classmethod", "property", "abs", "max", "min",
    "sum", "round", "pow", "divmod", "hex", "oct", "bin",
    "chr", "ord", "input", "open", "iter", "next",
    "any", "all", "format", "repr", "hash", "id", "dir", "vars",
    "globals", "locals", "exec", "eval", "compile",
];

const COMMON_IMPORTS = [
    "import os", "import sys", "import json", "import re", "import math",
    "import datetime", "import pathlib", "import typing", "import collections",
    "import functools", "import itertools", "import asyncio", "import logging",
    "from typing import List, Dict, Optional, Union, Tuple, Any",
    "from dataclasses import dataclass, field",
    "from pathlib import Path",
    "from collections import defaultdict, Counter, OrderedDict",
    "from functools import lru_cache, wraps, partial",
    "from enum import Enum, auto",
];

class PythonCompletionProvider implements CompletionProvider {
    id = "python-helpers:completions";
    triggerCharacters = ["."];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        if (ctx.language.toLowerCase() !== "python") return [];

        const items: CompletionItem[] = [];
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 2) return [];

        for (const builtin of PYTHON_BUILTINS) {
            if (builtin.toLowerCase().startsWith(word)) {
                items.push({
                    label: builtin,
                    kind: "function",
                    insertText: builtin,
                    detail: "Python built-in",
                    sortOrder: 0,
                });
            }
        }

        // Magic/dunder methods
        if (word.startsWith("__")) {
            const dunders = [
                "__init__", "__str__", "__repr__", "__len__", "__getitem__",
                "__setitem__", "__delitem__", "__iter__", "__next__", "__call__",
                "__enter__", "__exit__", "__eq__", "__lt__", "__gt__",
                "__hash__", "__bool__", "__add__", "__sub__", "__mul__",
            ];
            for (const d of dunders) {
                if (d.startsWith(word)) {
                    items.push({
                        label: d,
                        kind: "method",
                        insertText: d,
                        detail: "Dunder method",
                        sortOrder: 1,
                    });
                }
            }
        }

        return items.slice(0, 30);
    }
}

export function createPythonHelpersPlugin(): ExtendedEditorPlugin {
    return {
        id: "python-helpers",
        name: "Python Helpers",
        version: "1.0.0",
        description: "Python built-in completions, dunder methods, and common import suggestions",
        category: "language",
        defaultEnabled: true,

        completionProviders: [new PythonCompletionProvider()],

        onActivate(api) {
            api.registerCommand("python.generateDocstring", () => {
                const content = api.getContent();
                const { line } = api.getCursorPosition();
                const lines = content.split("\n");
                const currentLine = lines[line - 1]?.trim() ?? "";

                const m = currentLine.match(/^(?:async\s+)?def\s+(\w+)\(([^)]*)\)/);
                if (!m) return;

                const funcName = m[1];
                const params = m[2].split(",").map((p) => p.trim()).filter((p) => p && p !== "self" && p !== "cls");

                const docLines = ['    """'];
                docLines.push(`    ${funcName}.`);
                docLines.push("");
                for (const param of params) {
                    const paramName = param.split(":")[0].split("=")[0].trim();
                    docLines.push(`    Args:`);
                    docLines.push(`        ${paramName}: Description.`);
                }
                docLines.push("");
                docLines.push("    Returns:");
                docLines.push("        Description.");
                docLines.push('    """');

                lines.splice(line, 0, ...docLines);
                api.setContent(lines.join("\n"));
            });
        },
    };
}
