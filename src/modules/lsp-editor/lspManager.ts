/**
 * Manage the LanguageClientWrapper + EditorApp lifecycle.
 *
 * On every file open:
 *  1. Detect language from file extension
 *  2. Dynamically load the @codingame extension
 *  3. Dispose the previous LanguageClientWrapper
 *  4. Start/update the EditorApp with new code resources
 *  5. Start a new LanguageClientWrapper connected via WebSocket
 *
 * Rules:
 *  - Always dispose the previous client before starting a new one
 *  - Use real file URIs — NO in-memory FS
 *  - WebSocket URL includes ?language=<languageId>
 */

import {
  LanguageClientWrapper,
  type LanguageClientConfig,
} from 'monaco-languageclient/lcwrapper';
import {
  EditorApp,
  type EditorAppConfig,
} from 'monaco-languageclient/editorApp';
import * as vscode from 'vscode';
import { loadLanguageExtension } from './extensionLoader';
import { getLanguageId } from './languageMap';

const WS_BASE = 'ws://localhost:30000/lsp';

let currentLcWrapper: LanguageClientWrapper | null = null;
let currentEditorApp: EditorApp | null = null;

/**
 * Open a file in the Monaco editor with LSP support.
 *
 * @param htmlContainer - DOM element to mount the editor
 * @param fileUri       - Real URI: 'file:///C:/project/main.py' or 'https://...'
 * @param filename      - Just for extension detection: 'main.py'
 * @param content       - File content as string
 */
export async function openFileInEditor(
  htmlContainer: HTMLElement,
  fileUri: string,
  filename: string,
  content: string,
): Promise<void> {
  // 1. Detect language from extension
  const languageId = getLanguageId(filename);
  console.log(`[lspManager] Opening: ${filename} → language: ${languageId}`);

  // 2. Dynamically load only the needed @codingame extension
  await loadLanguageExtension(languageId);

  // 3. Dispose previous LSP client if one is running
  if (currentLcWrapper) {
    console.log('[lspManager] Disposing previous LSP client...');
    await currentLcWrapper.dispose();
    currentLcWrapper = null;
  }

  // 4. Editor app config — use real file URI, no in-memory FS
  const editorAppConfig: EditorAppConfig = {
    codeResources: {
      modified: {
        text: content,
        uri: fileUri,
      },
    },
  };

  // 5. Start EditorApp once, or update code resources on subsequent opens
  if (!currentEditorApp) {
    currentEditorApp = new EditorApp(editorAppConfig);
    await currentEditorApp.start(htmlContainer);
  } else {
    await currentEditorApp.updateCodeResources(editorAppConfig.codeResources);
  }

  // 6. Only connect LSP for non-plaintext languages
  if (languageId === 'plaintext') {
    console.log('[lspManager] Plaintext file — skipping LSP connection.');
    return;
  }

  // 7. Build WebSocket URL with language query param
  const wsUrl = `${WS_BASE}?language=${languageId}`;
  console.log(`[lspManager] Connecting to: ${wsUrl}`);

  // 8. Language client config
  const languageClientConfig: LanguageClientConfig = {
    languageId,
    connection: {
      options: {
        $type: 'WebSocketUrl',
        url: wsUrl,
      },
    },
    clientOptions: {
      documentSelector: [languageId],
      workspaceFolder: {
        index: 0,
        name: 'workspace',
        uri: vscode.Uri.parse(fileUri).with({ path: '/' }),
      },
    },
  };

  // 9. Start the new LSP client
  try {
    currentLcWrapper = new LanguageClientWrapper(languageClientConfig);
    await currentLcWrapper.start();
    console.log(`[lspManager] LSP ready for: ${languageId}`);
  } catch (err) {
    console.error(`[lspManager] LSP connection failed for ${languageId}:`, err);
    console.warn('[lspManager] Editor remains open — LSP features unavailable.');
    currentLcWrapper = null;
  }
}

/**
 * Dispose both the LSP client and the editor app.
 */
export async function stopLsp(): Promise<void> {
  if (currentLcWrapper) {
    await currentLcWrapper.dispose();
    currentLcWrapper = null;
    console.log('[lspManager] LSP client disposed.');
  }
}

/**
 * Fully dispose the editor and LSP.
 */
export async function disposeAll(): Promise<void> {
  await stopLsp();
  if (currentEditorApp) {
    await currentEditorApp.dispose();
    currentEditorApp = null;
    console.log('[lspManager] EditorApp disposed.');
  }
}

/**
 * Get the current EditorApp instance (e.g. to access the editor or diff editor).
 */
export function getEditorApp(): EditorApp | null {
  return currentEditorApp;
}
