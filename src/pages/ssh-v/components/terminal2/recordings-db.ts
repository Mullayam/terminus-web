/**
 * Saved terminal recordings, in their own IndexedDB database so the shared
 * `idb` schema stays untouched. Metadata and the (possibly large) asciicast
 * text live in separate stores so listing never loads the recordings.
 */

export interface RecordingMeta {
  id: string;
  name: string;
  host: string;
  sessionId: string;
  createdAt: number;
  /** Seconds. */
  duration: number;
  /** Size of the .cast text in bytes (approx., UTF-16 length). */
  bytes: number;
  width: number;
  height: number;
  events: number;
}

const DB_NAME = "terminus-recordings";
const META = "meta";
const CASTS = "casts";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CASTS)) db.createObjectStore(CASTS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listRecordings(): Promise<RecordingMeta[]> {
  const db = await openDb();
  const all = await request(db.transaction(META, "readonly").objectStore(META).getAll() as IDBRequest<RecordingMeta[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveRecording(meta: RecordingMeta, cast: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, CASTS], "readwrite");
  tx.objectStore(META).put(meta);
  tx.objectStore(CASTS).put({ id: meta.id, cast });
  await done(tx);
}

export async function getCast(id: string): Promise<string | null> {
  const db = await openDb();
  const row = await request(db.transaction(CASTS, "readonly").objectStore(CASTS).get(id) as IDBRequest<{ id: string; cast: string } | undefined>);
  return row?.cast ?? null;
}

export async function renameRecording(id: string, name: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, "readwrite");
  const store = tx.objectStore(META);
  const meta = await request(store.get(id) as IDBRequest<RecordingMeta | undefined>);
  if (meta) store.put({ ...meta, name });
  await done(tx);
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, CASTS], "readwrite");
  tx.objectStore(META).delete(id);
  tx.objectStore(CASTS).delete(id);
  await done(tx);
}
