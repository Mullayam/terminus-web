/**
 * @module monaco-editor/hooks/useMonacoEditor
 *
 * Hook that provides imperative access to the Monaco editor instance
 * and common operations.
 *
 * Usage:
 *   const { editorRef, monacoRef, getContent, setContent } = useMonacoEditor();
 *   <MonacoEditor onMount={(editor, monaco) => {
 *     editorRef.current = editor;
 *     monacoRef.current = monaco;
 *   }} />
 */

import { useRef, useCallback } from "react";
import type { Monaco, MonacoEditorInstance } from "../types";

export function useMonacoEditor() {
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const onMount = useCallback((editor: MonacoEditorInstance, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }, []);

  const getContent = useCallback(() => {
    return editorRef.current?.getValue() ?? "";
  }, []);

  const setContent = useCallback((value: string) => {
    editorRef.current?.setValue(value);
  }, []);

  const getLanguage = useCallback(() => {
    return editorRef.current?.getModel()?.getLanguageId() ?? "";
  }, []);

  const setLanguage = useCallback((languageId: string) => {
    const model = editorRef.current?.getModel();
    if (model && monacoRef.current) {
      monacoRef.current.editor.setModelLanguage(model, languageId);
    }
  }, []);

  const focus = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  const getSelection = useCallback(() => {
    const sel = editorRef.current?.getSelection();
    const model = editorRef.current?.getModel();
    if (!sel || !model) return { text: "", range: null };
    return {
      text: model.getValueInRange(sel),
      range: sel,
    };
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("user", [
        { range: selection, text, forceMoveMarkers: true },
      ]);
    }
  }, []);

  const formatDocument = useCallback(() => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }, []);

  const revealLine = useCallback((lineNumber: number) => {
    editorRef.current?.revealLineInCenter(lineNumber);
  }, []);

  return {
    editorRef,
    monacoRef,
    onMount,
    getContent,
    setContent,
    getLanguage,
    setLanguage,
    focus,
    getSelection,
    insertAtCursor,
    formatDocument,
    revealLine,
  };
}
