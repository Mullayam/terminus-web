/**
 * @module monaco-editor/plugins/parameter-hints-plugin
 *
 * Provides function signature / parameter hints as you type
 * inside function call parentheses. Shows parameter name,
 * type, and active-parameter highlighting.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const COMMON_SIGNATURES: Record<string, { label: string; params: string[]; doc?: string }[]> = {
  // JavaScript/TypeScript builtins
  "console.log": [{ label: "console.log(data: ...any[]): void", params: ["data: ...any[]"], doc: "Prints to stdout with newline." }],
  "console.error": [{ label: "console.error(data: ...any[]): void", params: ["data: ...any[]"] }],
  "console.warn": [{ label: "console.warn(data: ...any[]): void", params: ["data: ...any[]"] }],
  setTimeout: [{ label: "setTimeout(handler: Function, timeout?: number, ...args: any[]): number", params: ["handler: Function", "timeout?: number", "...args: any[]"] }],
  setInterval: [{ label: "setInterval(handler: Function, timeout?: number, ...args: any[]): number", params: ["handler: Function", "timeout?: number", "...args: any[]"] }],
  parseInt: [{ label: "parseInt(string: string, radix?: number): number", params: ["string: string", "radix?: number"] }],
  parseFloat: [{ label: "parseFloat(string: string): number", params: ["string: string"] }],
  JSON: [],
  "JSON.stringify": [{ label: "JSON.stringify(value: any, replacer?: any, space?: string | number): string", params: ["value: any", "replacer?: (key: string, value: any) => any", "space?: string | number"] }],
  "JSON.parse": [{ label: "JSON.parse(text: string, reviver?: Function): any", params: ["text: string", "reviver?: Function"] }],
  fetch: [{ label: "fetch(input: RequestInfo, init?: RequestInit): Promise<Response>", params: ["input: RequestInfo | URL", "init?: RequestInit"] }],
  "Array.from": [{ label: "Array.from(iterable: Iterable<T>, mapfn?: Function): T[]", params: ["iterable: Iterable<T>", "mapfn?: (v: T, k: number) => U"] }],
  "Object.keys": [{ label: "Object.keys(o: object): string[]", params: ["o: object"] }],
  "Object.values": [{ label: "Object.values(o: object): any[]", params: ["o: object"] }],
  "Object.entries": [{ label: "Object.entries(o: object): [string, any][]", params: ["o: object"] }],
  "Object.assign": [{ label: "Object.assign(target: T, ...sources: any[]): T", params: ["target: T", "...sources: any[]"] }],
  "Promise.all": [{ label: "Promise.all(values: Iterable<Promise>): Promise<any[]>", params: ["values: Iterable<T | PromiseLike<T>>"] }],
  "Promise.resolve": [{ label: "Promise.resolve(value?: T): Promise<T>", params: ["value?: T | PromiseLike<T>"] }],
  // Map / Set
  "Map.prototype.set": [{ label: "set(key: K, value: V): this", params: ["key: K", "value: V"] }],
  "Map.prototype.get": [{ label: "get(key: K): V | undefined", params: ["key: K"] }],
  // String methods
  replace: [{ label: "replace(searchValue: string | RegExp, replaceValue: string): string", params: ["searchValue: string | RegExp", "replaceValue: string | Function"] }],
  split: [{ label: "split(separator: string | RegExp, limit?: number): string[]", params: ["separator: string | RegExp", "limit?: number"] }],
  slice: [{ label: "slice(start?: number, end?: number): string | T[]", params: ["start?: number", "end?: number"] }],
  substring: [{ label: "substring(start: number, end?: number): string", params: ["start: number", "end?: number"] }],
  indexOf: [{ label: "indexOf(searchElement: T, fromIndex?: number): number", params: ["searchElement: T", "fromIndex?: number"] }],
  includes: [{ label: "includes(searchElement: T, fromIndex?: number): boolean", params: ["searchElement: T", "fromIndex?: number"] }],
  // Array methods
  map: [{ label: "map(callbackfn: (value: T, index: number) => U): U[]", params: ["callbackfn: (value: T, index: number, array: T[]) => U"] }],
  filter: [{ label: "filter(predicate: (value: T, index: number) => boolean): T[]", params: ["predicate: (value: T, index: number, array: T[]) => boolean"] }],
  reduce: [{ label: "reduce(callbackfn: (prev: U, curr: T) => U, initialValue?: U): U", params: ["callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U", "initialValue?: U"] }],
  forEach: [{ label: "forEach(callbackfn: (value: T, index: number) => void): void", params: ["callbackfn: (value: T, index: number, array: T[]) => void"] }],
  find: [{ label: "find(predicate: (value: T, index: number) => boolean): T | undefined", params: ["predicate: (value: T, index: number) => boolean"] }],
  sort: [{ label: "sort(compareFn?: (a: T, b: T) => number): T[]", params: ["compareFn?: (a: T, b: T) => number"] }],
  push: [{ label: "push(...items: T[]): number", params: ["...items: T[]"] }],
  join: [{ label: "join(separator?: string): string", params: ["separator?: string"] }],
};

const HINT_LANGS = ["javascript", "typescript", "typescriptreact", "javascriptreact"];

export const parameterHintsPlugin: MonacoPlugin = {
  id: "builtin-parameter-hints",
  name: "Parameter Hints",
  version: "1.0.0",
  description: "Shows function signature hints as you type arguments",

  onMount(ctx: PluginContext) {
    ctx.registerSignatureHelpProvider(HINT_LANGS, {
      signatureHelpTriggerCharacters: ["(", ","],
      signatureHelpRetriggerCharacters: [","],

      provideSignatureHelp(model, position) {
        const textUntil = model.getValueInRange({
          startLineNumber: Math.max(1, position.lineNumber - 5),
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Find the unclosed function call
        let depth = 0;
        let funcEnd = -1;
        let activeParam = 0;

        for (let i = textUntil.length - 1; i >= 0; i--) {
          const ch = textUntil[i];
          if (ch === ")") depth++;
          else if (ch === "(") {
            if (depth === 0) {
              funcEnd = i;
              break;
            }
            depth--;
          } else if (ch === "," && depth === 0) {
            activeParam++;
          }
        }

        if (funcEnd < 0) return null;

        // Extract function name before the (
        const before = textUntil.substring(0, funcEnd).trimEnd();
        const fnNameMatch = before.match(/([\w$.]+)\s*$/);
        if (!fnNameMatch) return null;

        const fnName = fnNameMatch[1];

        // Look up in our signature database
        // Try full name first, then method name only
        const sigs = COMMON_SIGNATURES[fnName] ?? COMMON_SIGNATURES[fnName.split(".").pop()!] ?? [];
        if (!sigs.length) return null;

        return {
          value: {
            signatures: sigs.map((s) => ({
              label: s.label,
              documentation: s.doc ? { value: s.doc } : undefined,
              parameters: s.params.map((p) => ({
                label: p,
                documentation: undefined,
              })),
            })),
            activeSignature: 0,
            activeParameter: activeParam,
          },
          dispose() {},
        };
      },
    });
  },
};
