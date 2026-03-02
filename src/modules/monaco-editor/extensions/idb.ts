/**
 * @module monaco-editor/extensions/idb
 *
 * Dexie-based IndexedDB storage for the VSCode extension loader.
 *
 * Tables:
 *   - `extension_index`  — master list / metadata per extension folder
 *   - `assets`           — decoded file content keyed by structured path
 *
 * Uses the same class-based Dexie pattern as `src/lib/idb/db-ops.ts`.
 */

import Dexie, { type EntityTable } from "dexie";

/* ── Row Interfaces ───────────────────────────────────────── */

export interface ExtensionIndexRecord {
  /** Primary key — e.g. "folder::javascript" or "ext-index::folder-list" */
  key: string;
  /** JSON-serialised payload */
  value: string;
  /** Epoch when written */
  updatedAt: number;
}

export interface AssetRecord {
  /** Primary key — e.g. "ext:python:snippet:python" */
  key: string;
  /** Raw string content (JSON string, grammar text, etc.) */
  value: string;
  /** Epoch when written */
  updatedAt: number;
}

/* ── Database Class ───────────────────────────────────────── */

class ExtensionDatabase extends Dexie {
  extensionIndex!: EntityTable<ExtensionIndexRecord, "key">;
  assets!: EntityTable<AssetRecord, "key">;

  constructor() {
    super("monaco-vscode-extensions");

    this.version(1).stores({
      extensionIndex: "key",
      assets: "key",
    });
  }
}

/** Singleton instance */
const db = new ExtensionDatabase();

/* ── Generic helpers ─────────────────────────────────────── */

export type StoreName = "extensionIndex" | "assets";

export async function idbGet(store: StoreName, key: string): Promise<string | null> {
  try {
    const row = await db[store].get(key);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function idbSet(store: StoreName, key: string, value: string): Promise<void> {
  try {
    await db[store].put({ key, value, updatedAt: Date.now() });
  } catch {
    // silently fail
  }
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  try {
    await db[store].delete(key);
  } catch {
    // silently fail
  }
}

/**
 * Get all entries where the key starts with `prefix`.
 */
export async function idbGetAllByPrefix(
  store: StoreName,
  prefix: string,
): Promise<{ key: string; value: string }[]> {
  try {
    const rows = await db[store]
      .where("key")
      .startsWith(prefix)
      .toArray();
    return rows.map((r) => ({ key: r.key, value: r.value }));
  } catch {
    return [];
  }
}

/**
 * Bulk-put multiple entries for a store.
 */
export async function idbBulkPut(
  store: StoreName,
  entries: Array<{ key: string; value: string }>,
): Promise<void> {
  try {
    const now = Date.now();
    await db[store].bulkPut(entries.map((e) => ({ ...e, updatedAt: now })));
  } catch {
    // silently fail
  }
}

/**
 * Clear all entries in a store.
 */
export async function idbClearStore(store: StoreName): Promise<void> {
  try {
    await db[store].clear();
  } catch {
    // silently fail
  }
}

/**
 * Expose raw Dexie instance for advanced queries.
 */
export function getExtDb(): ExtensionDatabase {
  return db;
}

/* ── Well-known store name constants (backwards compat) ──── */

export const STORE_INDEX: StoreName = "extensionIndex";
export const STORE_ASSETS: StoreName = "assets";

