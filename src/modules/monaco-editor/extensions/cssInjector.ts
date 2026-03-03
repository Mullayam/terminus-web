/**
 * @module monaco-editor/extensions/cssInjector
 *
 * Shared utility for injecting extension CSS into the DOM.
 * Used by both workerBridge (worker path) and manager (fallback path).
 *
 * Tracks injected styles to prevent duplicate injection.
 */

const injectedCss = new Set<string>();

/**
 * Inject a CSS string into `<head>` via a `<style>` element.
 * De-duplicates by `folder:path` key; safe to call multiple times.
 */
export function injectExtensionCss(folder: string, path: string, content: string): void {
  const key = `ext-css:${folder}:${path}`;
  if (injectedCss.has(key)) return;

  const style = document.createElement("style");
  style.setAttribute("data-ext-css", key);
  style.textContent = content;
  document.head.appendChild(style);
  injectedCss.add(key);
  console.log(`[monaco-ext] Injected CSS: ${path}`);
}

/**
 * Remove all injected extension CSS from the DOM.
 */
export function removeAllExtensionCss(): void {
  for (const key of injectedCss) {
    const el = document.querySelector(`style[data-ext-css="${key}"]`);
    if (el) el.remove();
  }
  injectedCss.clear();
}

/**
 * Check if a specific CSS file has been injected.
 */
export function isCssInjected(folder: string, path: string): boolean {
  return injectedCss.has(`ext-css:${folder}:${path}`);
}
