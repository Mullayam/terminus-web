/**
 * Initialize the MonacoVscodeApiWrapper ONCE for the entire app lifetime.
 *
 * Rules:
 *  - Guard with a boolean flag — if already started, return immediately
 *  - NO file-system setup (no RegisteredFileSystemProvider)
 *  - Call configureDefaultWorkerFactory() before wrapper.start()
 */

import {
  MonacoVscodeApiWrapper,
  type MonacoVscodeApiConfig,
} from 'monaco-languageclient/vscodeApiWrapper';
import { configureDefaultWorkerFactory } from 'monaco-languageclient/workerFactory';
import { LogLevel } from '@codingame/monaco-vscode-api';

let wrapper: MonacoVscodeApiWrapper | null = null;
let started = false;

export async function initEditorApi(htmlContainer: HTMLElement): Promise<void> {
  if (started) return;
  started = true;

  // Must configure worker factory before starting the wrapper
  configureDefaultWorkerFactory();

  const config: MonacoVscodeApiConfig = {
    $type: 'extended',
    viewsConfig: {
      $type: 'EditorService',
      htmlContainer,
    },
    logLevel: LogLevel.Info,
    userConfiguration: {
      json: JSON.stringify({
        'workbench.colorTheme': 'Default Dark Modern',
        'editor.fontSize': 14,
        'editor.tabSize': 2,
        'editor.fontFamily': 'Fira Code, Consolas, monospace',
        'editor.wordWrap': 'on',
        'editor.minimap.enabled': true,
        'editor.lineNumbers': 'on',
        'editor.quickSuggestions': true,
        'editor.wordBasedSuggestions': 'off',
        'editor.parameterHints.enabled': true,
        'editor.lightbulb.enabled': 'On',
        'editor.guides.bracketPairsHorizontal': 'active',
        'editor.experimental.asyncTokenization': true,
      }),
    },
  };

  wrapper = new MonacoVscodeApiWrapper(config);
  await wrapper.start();
  console.log('[editorSetup] MonacoVscodeApiWrapper started.');
}

export function getWrapper(): MonacoVscodeApiWrapper | null {
  return wrapper;
}

export function disposeEditorApi(): void {
  if (wrapper) {
    wrapper.dispose();
    wrapper = null;
    started = false;
    console.log('[editorSetup] MonacoVscodeApiWrapper disposed.');
  }
}
