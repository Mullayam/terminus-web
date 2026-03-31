export { ExtensionInstaller, validateManifest, ALLOWED_APIS } from "./extension-installer";
export type { ValidationResult } from "./extension-installer";
export { ExtensionOPFS } from "./opfs";
export {
    getExtensionDB,
    indexExtension,
    removeExtensionIndex,
    searchExtensions,
    listExtensions,
    listExtensionFiles,
    setExtensionEnabled,
    indexFile,
    removeFileIndex,
} from "./extension-db";
export type {
    ExtensionRecord,
    CommandRecord,
    FileRecord,
    SearchResult,
} from "./extension-db";
