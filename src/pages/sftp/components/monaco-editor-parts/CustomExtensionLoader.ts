// extensionLoader.ts

const ESM_SH = 'https://esm.sh'
const loadedExtensions = new Set<string>()

const EXTENSION_MAP: Record<string, { pkg: string; version: string }> = {
  json:            { pkg: '@codingame/monaco-vscode-json-default-extension',       version: '26.2.1' },
  python:          { pkg: '@codingame/monaco-vscode-python-default-extension',     version: '26.2.1' },
  typescript:      { pkg: '@codingame/monaco-vscode-typescript-default-extension', version: '26.2.1' },
  typescriptreact: { pkg: '@codingame/monaco-vscode-typescript-default-extension', version: '26.2.1' },
  javascript:      { pkg: '@codingame/monaco-vscode-javascript-default-extension', version: '26.2.1' },
  css:             { pkg: '@codingame/monaco-vscode-css-default-extension',        version: '26.2.1' },
  scss:            { pkg: '@codingame/monaco-vscode-css-default-extension',        version: '26.2.1' },
  html:            { pkg: '@codingame/monaco-vscode-html-default-extension',       version: '26.2.1' },
  go:              { pkg: '@codingame/monaco-vscode-go-default-extension',         version: '26.2.1' },
  rust:            { pkg: '@codingame/monaco-vscode-rust-default-extension',       version: '26.2.1' },
}

export async function loadLanguageExtension(languageId: string): Promise<void> {
  if (loadedExtensions.has(languageId)) return

  const entry = EXTENSION_MAP[languageId]
  if (!entry) {
    console.warn(`[extensionLoader] No extension for: ${languageId}`)
    return
  }

  // Direct import from esm.sh — sub-imports resolve on esm.sh domain ✅
  const url = `${ESM_SH}/${entry.pkg}@${entry.version}`

  try {
    await import(/* @vite-ignore */ url)
    loadedExtensions.add(languageId)
    console.log(`[extensionLoader] ✅ Loaded: ${languageId}`)
  } catch (err) {
    console.error(`[extensionLoader] ❌ Failed: ${languageId}`, err)
  }
}