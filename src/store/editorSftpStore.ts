/**
 * @module editorSftpStore
 * @deprecated — Use `@/store/editorFsStore` instead. This file re-exports
 * for backward compatibility.
 */
export {
    useEditorFsStore as useEditorSftpStore,
    type FsProviderStatus as EditorSftpStatus,
    type EditorFsSession as EditorSftpSession,
} from "./editorFsStore";

