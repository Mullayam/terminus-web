/**
 * @module monaco-editor/plugins/image-preview-plugin
 *
 * When an image file path is opened in the editor, displays an
 * inline image preview overlay instead of showing raw binary data.
 * Detects image URIs/paths and shows a preview widget.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "image-preview-plugin-css";
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif|tiff?)$/i;

const CSS = `
.image-preview-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--vscode-editor-background, #1e1e1e);
  z-index: 10;
  gap: 12px;
}
.image-preview-img {
  max-width: 90%;
  max-height: 70vh;
  object-fit: contain;
  border: 1px solid var(--vscode-panel-border, #333);
  border-radius: 6px;
  background: repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 16px 16px;
}
.image-preview-info {
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #888);
  font-family: var(--vscode-font-family, system-ui);
  text-align: center;
}
.image-preview-info span {
  margin: 0 8px;
}
.image-preview-close {
  position: absolute;
  top: 8px; right: 12px;
  background: var(--vscode-button-secondaryBackground, #3a3a3a);
  color: var(--vscode-button-secondaryForeground, #ccc);
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  z-index: 11;
}
.image-preview-close:hover {
  background: var(--vscode-button-secondaryHoverBackground, #454545);
}
`;

export const imagePreviewPlugin: MonacoPlugin = {
  id: "builtin-image-preview",
  name: "Image Preview",
  version: "1.0.0",
  description: "Shows image preview when an image file is opened",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let overlay: HTMLElement | null = null;

    const showPreview = (filePath: string) => {
      removePreview();

      const editorDom = ctx.editor.getDomNode();
      const parent = editorDom?.parentElement;
      if (!parent) return;

      parent.style.position = "relative";

      overlay = document.createElement("div");
      overlay.className = "image-preview-overlay";

      const closeBtn = document.createElement("button");
      closeBtn.className = "image-preview-close";
      closeBtn.textContent = "✕ Close Preview";
      closeBtn.addEventListener("click", removePreview);
      overlay.appendChild(closeBtn);

      const img = document.createElement("img");
      img.className = "image-preview-img";
      img.alt = filePath.split("/").pop() ?? "Image";

      // Resolve the image URL
      // If it's an absolute URL or data URI, use directly
      // Otherwise, treat as a relative path
      if (filePath.startsWith("http") || filePath.startsWith("data:") || filePath.startsWith("blob:")) {
        img.src = filePath;
      } else {
        // For SFTP-loaded files, the content is the file path on the server
        // We can't display server files directly, but we can show the path info
        img.src = filePath;
      }

      img.onload = () => {
        if (info) {
          info.innerHTML = `<span>${img.naturalWidth} × ${img.naturalHeight}</span><span>${filePath.split("/").pop()}</span>`;
        }
      };

      img.onerror = () => {
        img.style.display = "none";
        if (info) {
          info.textContent = `Cannot preview: ${filePath.split("/").pop()}`;
        }
      };

      overlay.appendChild(img);

      const info = document.createElement("div");
      info.className = "image-preview-info";
      info.textContent = filePath.split("/").pop() ?? "";
      overlay.appendChild(info);

      parent.appendChild(overlay);
    };

    const removePreview = () => {
      overlay?.remove();
      overlay = null;
    };

    const checkFile = () => {
      const filePath = ctx.getFilePath() ?? "";
      if (IMAGE_EXTENSIONS.test(filePath)) {
        showPreview(filePath);
      } else {
        removePreview();
      }
    };

    // Check on mount
    checkFile();

    // Listen for file path changes via the plugin event system
    ctx.on("file-opened", (data) => {
      const path = (data as any)?.path ?? "";
      if (IMAGE_EXTENSIONS.test(path)) {
        showPreview(path);
      } else {
        removePreview();
      }
    });

    ctx.addDisposable({
      dispose() {
        removePreview();
      },
    });
  },

  onLanguageChange(_lang: string, ctx: PluginContext) {
    const filePath = ctx.getFilePath() ?? "";
    // If language changed and file is not an image, remove overlay
    if (!IMAGE_EXTENSIONS.test(filePath)) {
      // overlay cleanup is handled by dispose or next check
    }
  },
};
