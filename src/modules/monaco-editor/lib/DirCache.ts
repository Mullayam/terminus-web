/**
 * @module DirCache
 *
 * In-memory directory listing cache with TTL support.
 *
 * Performance rules applied:
 *   - "Always cache results" — avoid repeated readdir calls
 *   - "Cache file tree structure" — keep entries in memory
 *   - File watcher → cache invalidation (single dir, not full flush)
 *
 * @example
 * ```ts
 * const cache = new DirCache({ ttl: 30_000 });
 * cache.set("/home/user", entries);
 * cache.get("/home/user"); // → entries (within TTL)
 * cache.invalidate("/home/user"); // watcher notification
 * ```
 */
import type { FileEntry } from "./file-system-types";

export interface DirCacheOptions {
    /** Time-to-live in ms before entries are considered stale (default 60 000). */
    ttl?: number;
    /** Maximum number of directories to cache (LRU eviction). Default 200. */
    maxSize?: number;
}

interface CacheEntry {
    entries: FileEntry[];
    timestamp: number;
}

export class DirCache {
    private readonly ttl: number;
    private readonly maxSize: number;
    private readonly map = new Map<string, CacheEntry>();

    constructor(opts: DirCacheOptions = {}) {
        this.ttl = opts.ttl ?? 60_000;
        this.maxSize = opts.maxSize ?? 200;
    }

    /** Get cached entries if still fresh. Returns `undefined` on miss/stale. */
    get(dirPath: string): FileEntry[] | undefined {
        const entry = this.map.get(dirPath);
        if (!entry) return undefined;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.map.delete(dirPath);
            return undefined;
        }
        // Move to end for LRU ordering
        this.map.delete(dirPath);
        this.map.set(dirPath, entry);
        return entry.entries;
    }

    /** Store directory listing in cache. */
    set(dirPath: string, entries: FileEntry[]): void {
        // Evict oldest if over capacity
        if (this.map.size >= this.maxSize) {
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined) this.map.delete(oldest);
        }
        this.map.set(dirPath, { entries, timestamp: Date.now() });
    }

    /** Check if a fresh cache entry exists (without reading it). */
    has(dirPath: string): boolean {
        return this.get(dirPath) !== undefined;
    }

    /** Invalidate a single directory (watcher / mutation). */
    invalidate(dirPath: string): void {
        this.map.delete(dirPath);
    }

    /** Invalidate all children of a directory (recursive). */
    invalidateChildren(parentDir: string): void {
        const prefix = parentDir.endsWith("/") ? parentDir : parentDir + "/";
        for (const key of Array.from(this.map.keys())) {
            if (key.startsWith(prefix)) {
                this.map.delete(key);
            }
        }
    }

    /** Flush entire cache. */
    clear(): void {
        this.map.clear();
    }

    /** Number of cached directories. */
    get size(): number { return this.map.size; }
}
