/**
 * @module monaco-editor/lib/filesystem
 *
 * Pluggable file-system provider abstraction.
 * Types, caching, filtering, pagination, provider registry,
 * and the generic useFileSystemTree hook.
 */
export type {
  FileSystemProvider,
  FileEntry,
  FsProviderStatus,
  FsStatusListener,
  FileOperationHandlers,
  ReaddirOptions,
  IgnoreConfig,
} from "./file-system-types";
export { DEFAULT_IGNORED_NAMES } from "./file-system-types";
export { SftpFileSystemProvider } from "./sftp-fs-provider";
export {
  registerFsProvider,
  unregisterFsProvider,
  createFsProvider,
  hasFsProvider,
  listFsProviders,
  type FsProviderFactory,
} from "./fsProviderRegistry";
export { useFileSystemTree, type UseFileSystemTreeOptions } from "./useFileSystemTree";
export {
  createSftpHandlers,
  createApiHandlers,
  composeHandlers,
  type SftpHandlerOptions,
  type ApiHandlerOptions,
} from "./fs-handler-factories";
export { DirCache, type DirCacheOptions } from "./DirCache";
export { filterEntries, paginateEntries } from "./filterEntries";
