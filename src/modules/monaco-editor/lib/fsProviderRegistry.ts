/**
 * @module fsProviderRegistry
 *
 * Simple factory / registry that maps a provider-type string
 * (e.g. "sftp", "api", "local") to a `FileSystemProvider` constructor.
 *
 * Usage:
 *   registerFsProvider("sftp", SftpFileSystemProvider);
 *   const p = createFsProvider("sftp", { sessionId, hostUser });
 */
import type { FileSystemProvider } from "./file-system-types";

/* ── Types ──────────────────────────────────────────────────── */

export type FsProviderFactory = (opts: Record<string, unknown>) => FileSystemProvider;

/* ── Registry ───────────────────────────────────────────────── */

const _registry = new Map<string, FsProviderFactory>();

/**
 * Register a factory function for a given provider type.
 * Calling with the same type replaces the previous registration.
 */
export function registerFsProvider(type: string, factory: FsProviderFactory): void {
    _registry.set(type, factory);
}

/**
 * Unregister a previously registered provider type.
 */
export function unregisterFsProvider(type: string): boolean {
    return _registry.delete(type);
}

/**
 * Create an instance of a registered provider type.
 *
 * @throws if the type has not been registered.
 */
export function createFsProvider(type: string, opts: Record<string, unknown> = {}): FileSystemProvider {
    const factory = _registry.get(type);
    if (!factory) {
        throw new Error(`[FsProviderRegistry] Unknown provider type "${type}". Registered: ${[..._registry.keys()].join(", ") || "(none)"}`);
    }
    return factory(opts);
}

/**
 * Check whether a provider type is registered.
 */
export function hasFsProvider(type: string): boolean {
    return _registry.has(type);
}

/**
 * List all registered provider types.
 */
export function listFsProviders(): string[] {
    return [..._registry.keys()];
}
