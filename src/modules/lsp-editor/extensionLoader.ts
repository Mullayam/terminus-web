/**
 * Dynamically import @codingame language extensions at runtime.
 *
 * Rules:
 *  - NO static imports of @codingame extension packages
 *  - Track loaded extensions to avoid duplicate imports
 *  - Gracefully handle missing packages (warn, don't crash)
 */

const loadedExtensions = new Set<string>();

/**
 * Map languageId → npm package name for @codingame extensions.
 * Only packages that are actually installed will succeed.
 */
const EXTENSION_PACKAGES: Record<string, string> = {
  json: '@codingame/monaco-vscode-json-default-extension',
  python: '@codingame/monaco-vscode-python-default-extension',
  typescript: '@codingame/monaco-vscode-typescript-default-extension',
  typescriptreact: '@codingame/monaco-vscode-typescript-default-extension',
  javascript: '@codingame/monaco-vscode-javascript-default-extension',
  javascriptreact: '@codingame/monaco-vscode-javascript-default-extension',
  css: '@codingame/monaco-vscode-css-default-extension',
  scss: '@codingame/monaco-vscode-css-default-extension',
  html: '@codingame/monaco-vscode-html-default-extension',
  go: '@codingame/monaco-vscode-go-default-extension',
  rust: '@codingame/monaco-vscode-rust-default-extension',
  java: '@codingame/monaco-vscode-java-default-extension',
  cpp: '@codingame/monaco-vscode-cpp-default-extension',
  csharp: '@codingame/monaco-vscode-csharp-default-extension',
  yaml: '@codingame/monaco-vscode-yaml-default-extension',
};

/**
 * Dynamically import the @codingame language extension for the given languageId.
 * If already loaded, this is a no-op.
 */
export async function loadLanguageExtension(languageId: string): Promise<void> {
  if (loadedExtensions.has(languageId)) return;

  const packageName = EXTENSION_PACKAGES[languageId];
  if (!packageName) {
    console.warn(`[extensionLoader] No @codingame extension mapped for: ${languageId}`);
    return;
  }

  try {
    await import(/* @vite-ignore */ packageName);
    loadedExtensions.add(languageId);
    console.log(`[extensionLoader] Loaded extension for: ${languageId}`);
  } catch (err) {
    console.error(
      `[extensionLoader] Failed to load extension "${packageName}".`,
      `Did you run: npm install ${packageName}@<version> ?`,
      err,
    );
  }
}
