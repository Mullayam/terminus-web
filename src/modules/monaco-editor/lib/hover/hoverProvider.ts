/**
 * @module lib/hoverProvider
 *
 * Dynamic Hover-Provider registry for Monaco Editor.
 *
 * Users define hover entries per language as `Record<string, string>`
 * (word → Markdown content). This module:
 *  1. Persists custom hover data in `EditorSettings.customHoverProviders`
 *  2. Registers / disposes `monaco.languages.registerHoverProvider` per language
 *  3. Returns a disposable to tear everything down
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/* ── Types ─────────────────────────────────────────────────── */

/** A stored hover-provider entry (persisted in EditorSettings) */
export interface CustomHoverEntry {
  /** Target language id, e.g. "go", "python", "typescript" */
  languageId: string;
  /** Raw JSON string of `Record<string, string>` — word → Markdown */
  hoversJson: string;
}

/**
 * Parses the JSON and returns a typed map, or null on failure.
 */
export function parseHovers(json: string): Record<string, string> | null {
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
    // Validate: all values must be strings
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k !== "string" || typeof v !== "string") return null;
    }
    return obj as Record<string, string>;
  } catch {
    return null;
  }
}

/* ── Registration ──────────────────────────────────────────── */

/**
 * Register hover providers for every entry.
 *
 * @returns An `IDisposable` that, when disposed, un-registers all providers.
 */
export function registerCustomHoverProviders(
  monaco: Monaco,
  entries: CustomHoverEntry[],
): monacoNs.IDisposable {
  const disposables: monacoNs.IDisposable[] = [];

  for (const entry of entries) {
    const hovers = parseHovers(entry.hoversJson);
    if (!hovers) continue; // skip malformed entries

    const d = monaco.languages.registerHoverProvider(entry.languageId, {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const info = hovers[word.word];
        if (!info) return null;

        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: info }],
        };
      },
    });

    disposables.push(d);
  }

  return {
    dispose() {
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;
    },
  };
}

/* ── Go Demo Data ──────────────────────────────────────────── */

/**
 * Returns a ready-to-use Go hover JSON string covering built-in
 * functions, keywords, control flow, types, and the `fmt` package.
 *
 * Useful as a starter template for users.
 */
export function getGoHoverDemoJson(): string {
  const goHovers: Record<string, string> = {
    // ── fmt package ──
    fmt: [
      "**package fmt**",
      "Implements formatted I/O similar to C's printf and scanf.",
      "",
      "```go",
      'import "fmt"',
      "```",
    ].join("\n"),

    Println: [
      "**fmt.Println**(a ...any) (n int, err error)",
      "",
      "Prints to stdout with spaces between operands and a newline at the end.",
      "",
      "```go",
      'fmt.Println("Hello", "World")',
      "// Output: Hello World",
      "```",
    ].join("\n"),

    Printf: [
      "**fmt.Printf**(format string, a ...any) (n int, err error)",
      "",
      "Formats according to a format specifier and writes to stdout.",
      "",
      "```go",
      'fmt.Printf("Hello %s, you are %d years old", "John", 25)',
      "```",
    ].join("\n"),

    Sprintf: [
      "**fmt.Sprintf**(format string, a ...any) string",
      "",
      "Formats according to a format specifier and returns the resulting string.",
      "",
      "```go",
      'str := fmt.Sprintf("Hello %s", "World")',
      "```",
    ].join("\n"),

    Errorf: [
      "**fmt.Errorf**(format string, a ...any) error",
      "",
      "Creates a new error with a formatted message.",
      "",
      "```go",
      'err := fmt.Errorf("user %d not found", userID)',
      "```",
    ].join("\n"),

    // ── Keywords ──
    func: [
      "**func** — function declaration",
      "",
      "```go",
      "func name(param type) returnType {",
      "    // body",
      "}",
      "```",
    ].join("\n"),

    var: [
      "**var** — variable declaration",
      "",
      "```go",
      "var x int = 10",
      "var name string",
      "```",
    ].join("\n"),

    const: [
      "**const** — constant declaration",
      "",
      "```go",
      "const Pi = 3.14159",
      "const MaxSize int = 100",
      "```",
    ].join("\n"),

    type: [
      "**type** — type declaration",
      "",
      "```go",
      "type User struct {",
      "    ID   int",
      '    Name string',
      "}",
      "```",
    ].join("\n"),

    struct: [
      "**struct** — composite data type",
      "",
      "```go",
      "type Point struct {",
      "    X float64",
      "    Y float64",
      "}",
      "p := Point{X: 1.0, Y: 2.0}",
      "```",
    ].join("\n"),

    interface: [
      "**interface** — defines a set of method signatures",
      "",
      "```go",
      "type Animal interface {",
      "    Sound() string",
      "    Move()  string",
      "}",
      "```",
    ].join("\n"),

    // ── Control flow ──
    if: [
      "**if** — conditional statement",
      "",
      "```go",
      "if x > 0 {",
      '    fmt.Println("positive")',
      "} else {",
      '    fmt.Println("non-positive")',
      "}",
      "```",
    ].join("\n"),

    for: [
      "**for** — Go's only loop construct",
      "",
      "```go",
      "// C-style loop",
      "for i := 0; i < 10; i++ { }",
      "",
      "// while-style",
      "for x < 100 { }",
      "",
      "// range loop",
      "for i, v := range slice { }",
      "```",
    ].join("\n"),

    range: [
      "**range** — iterates over arrays, slices, maps, channels",
      "",
      "```go",
      "nums := []int{1, 2, 3}",
      "for i, v := range nums {",
      "    fmt.Println(i, v)",
      "}",
      "```",
    ].join("\n"),

    switch: [
      "**switch** — multi-way branch statement",
      "",
      "```go",
      "switch day {",
      'case "Mon":',
      '    fmt.Println("Monday")',
      'case "Fri":',
      '    fmt.Println("Friday")',
      "default:",
      '    fmt.Println("Other")',
      "}",
      "```",
    ].join("\n"),

    return: [
      "**return** — returns from current function",
      "",
      "```go",
      "// single return",
      "func add(a, b int) int {",
      "    return a + b",
      "}",
      "",
      "// multiple return",
      "func divide(a, b float64) (float64, error) {",
      '    if b == 0 { return 0, fmt.Errorf("division by zero") }',
      "    return a / b, nil",
      "}",
      "```",
    ].join("\n"),

    defer: [
      "**defer** — defers execution until surrounding function returns",
      "",
      "```go",
      "func readFile(path string) {",
      "    f, _ := os.Open(path)",
      "    defer f.Close() // runs when readFile() returns",
      "    // read file...",
      "}",
      "```",
    ].join("\n"),

    go: [
      "**go** — starts a new goroutine",
      "",
      "```go",
      "go func() {",
      '    fmt.Println("running concurrently")',
      "}()",
      "",
      "go myFunction(args)",
      "```",
    ].join("\n"),

    chan: [
      "**chan** — channel type for goroutine communication",
      "",
      "```go",
      "ch := make(chan int)        // unbuffered",
      "ch := make(chan int, 10)    // buffered",
      "",
      "ch <- 42     // send",
      "v := <-ch    // receive",
      "```",
    ].join("\n"),

    select: [
      "**select** — waits on multiple channel operations",
      "",
      "```go",
      "select {",
      "case msg := <-ch1:",
      '    fmt.Println("ch1:", msg)',
      "case msg := <-ch2:",
      '    fmt.Println("ch2:", msg)',
      "default:",
      '    fmt.Println("no message")',
      "}",
      "```",
    ].join("\n"),

    // ── Built-in functions ──
    make: [
      "**make**(t Type, size ...int) Type",
      "",
      "Allocates and initializes slices, maps, or channels.",
      "",
      "```go",
      "slice := make([]int, 5)          // len=5",
      "slice := make([]int, 5, 10)      // len=5 cap=10",
      'map   := make(map[string]int)',
      "ch    := make(chan int, 5)",
      "```",
    ].join("\n"),

    append: [
      "**append**(slice []T, elems ...T) []T",
      "",
      "Appends elements to the end of a slice.",
      "",
      "```go",
      "nums := []int{1, 2, 3}",
      "nums  = append(nums, 4, 5)",
      "// nums = [1 2 3 4 5]",
      "```",
    ].join("\n"),

    len: [
      "**len**(v Type) int",
      "",
      "Returns the length of a string, array, slice, map, or channel.",
      "",
      "```go",
      'len("hello")        // 5',
      "len([]int{1,2,3})   // 3",
      "len(map[string]int) // number of keys",
      "```",
    ].join("\n"),

    cap: [
      "**cap**(v Type) int",
      "",
      "Returns the capacity of a slice or channel.",
      "",
      "```go",
      "s := make([]int, 3, 10)",
      "fmt.Println(cap(s)) // 10",
      "```",
    ].join("\n"),

    new: [
      "**new**(T Type) *T",
      "",
      "Allocates memory for a new zero value of type T and returns a pointer.",
      "",
      "```go",
      "p := new(int)      // *int pointing to 0",
      "*p = 42",
      "```",
    ].join("\n"),

    delete: [
      "**delete**(m map[K]V, key K)",
      "",
      "Deletes the element with the specified key from the map.",
      "",
      "```go",
      'm := map[string]int{"a": 1, "b": 2}',
      'delete(m, "a")',
      "```",
    ].join("\n"),

    copy: [
      "**copy**(dst, src []T) int",
      "",
      "Copies elements from src into dst, returns number of elements copied.",
      "",
      "```go",
      "src := []int{1, 2, 3}",
      "dst := make([]int, len(src))",
      "n   := copy(dst, src)",
      "```",
    ].join("\n"),

    panic: [
      "**panic**(v any)",
      "",
      "Stops normal execution of current goroutine and begins panicking.",
      "",
      "```go",
      "if x < 0 {",
      '    panic("negative value")',
      "}",
      "```",
    ].join("\n"),

    recover: [
      "**recover**() any",
      "",
      "Regains control of a panicking goroutine. Must be called inside defer.",
      "",
      "```go",
      "defer func() {",
      "    if r := recover(); r != nil {",
      '        fmt.Println("recovered:", r)',
      "    }",
      "}()",
      "```",
    ].join("\n"),

    // ── Types ──
    string: "**string** — immutable sequence of bytes (UTF-8 encoded text)",
    int: "**int**  — signed integer, size platform dependent (32 or 64 bit)",
    int8: "**int8** — signed 8-bit integer (-128 to 127)",
    int16: "**int16** — signed 16-bit integer (-32768 to 32767)",
    int32: "**int32** — signed 32-bit integer (also aliased as rune)",
    int64: "**int64** — signed 64-bit integer",
    uint: "**uint** — unsigned integer",
    float32: "**float32** — 32-bit IEEE 754 floating point",
    float64: "**float64** — 64-bit IEEE 754 floating point",
    bool: "**bool** — boolean type: true or false",
    byte: "**byte** — alias for uint8",
    rune: "**rune** — alias for int32, represents a Unicode code point",
    error:
      "**error** — built-in interface type\n\n```go\ntype error interface {\n    Error() string\n}\n```",
    nil: "**nil** — zero value for pointers, channels, funcs, interfaces, maps, slices",
  };

  return JSON.stringify(goHovers, null, 2);
}
