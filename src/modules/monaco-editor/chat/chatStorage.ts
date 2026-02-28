/**
 * @module monaco-editor/chat/chatStorage
 *
 * IndexedDB persistence for AI Chat conversations using Dexie.
 *
 * Conversations are keyed by `hostId` + `filename` so users get
 * separate chat histories per host machine and file.
 */

import Dexie, { type EntityTable } from "dexie";
import type { ChatConversation, ChatMessage, CodeBlock } from "./types";

/* ── Stored record shape ───────────────────────────────────── */

export interface StoredConversation {
  /** Unique conversation ID (primary key) */
  id: string;
  /** Host identifier (session / tab id) */
  hostId: string;
  /** Filename the conversation belongs to */
  filename: string;
  /** Conversation title */
  title: string;
  /** JSON-serialized messages */
  messages: string;
  /** Epoch ms */
  createdAt: number;
  /** Epoch ms */
  updatedAt: number;
}

/* ── Database ──────────────────────────────────────────────── */

class ChatDB extends Dexie {
  conversations!: EntityTable<StoredConversation, "id">;

  constructor() {
    super("terminus-chat");

    this.version(1).stores({
      // Compound index on [hostId+filename] for fast lookup
      conversations: "id, [hostId+filename], hostId, filename, updatedAt",
    });
  }
}

/** Singleton database instance */
const db = new ChatDB();

/* ── Helpers: serialise / deserialise ──────────────────────── */

function toStored(
  conv: ChatConversation,
  hostId: string,
  filename: string,
): StoredConversation {
  return {
    id: conv.id,
    hostId,
    filename,
    title: conv.title,
    messages: JSON.stringify(conv.messages),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

function fromStored(row: StoredConversation): ChatConversation {
  let messages: ChatMessage[] = [];
  try {
    messages = JSON.parse(row.messages);
  } catch {
    /* corrupted — treat as empty */
  }
  return {
    id: row.id,
    title: row.title,
    messages,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* ── CRUD ──────────────────────────────────────────────────── */

/**
 * Load all conversations for a given host + filename pair.
 * Returns newest-first.
 */
export async function loadConversations(
  hostId: string,
  filename: string,
): Promise<ChatConversation[]> {
  const rows = await db.conversations
    .where("[hostId+filename]")
    .equals([hostId, filename])
    .reverse()
    .sortBy("updatedAt");
  return rows.map(fromStored);
}

/**
 * Save (upsert) a single conversation.
 */
export async function saveConversation(
  conv: ChatConversation,
  hostId: string,
  filename: string,
): Promise<void> {
  await db.conversations.put(toStored(conv, hostId, filename));
}

/**
 * Save multiple conversations in a single transaction.
 */
export async function saveAllConversations(
  convs: ChatConversation[],
  hostId: string,
  filename: string,
): Promise<void> {
  await db.conversations.bulkPut(convs.map((c) => toStored(c, hostId, filename)));
}

/**
 * Delete a conversation by ID.
 */
export async function deleteStoredConversation(id: string): Promise<void> {
  await db.conversations.delete(id);
}

/**
 * Delete all conversations for a host + filename pair.
 */
export async function clearStoredConversations(
  hostId: string,
  filename: string,
): Promise<void> {
  await db.conversations
    .where("[hostId+filename]")
    .equals([hostId, filename])
    .delete();
}
