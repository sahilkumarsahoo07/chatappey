/**
 * IndexedDB cache for chat message threads — instant open + background sync.
 */

import { mergeThreadMessages } from "./messageSync";

const DB_NAME = "chatappey_cache";
const DB_VERSION = 1;
const STORE = "threads";
export const CACHE_MAX_MESSAGES = 500;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function threadKey(type, peerId) {
  return `${type}:${peerId}`;
}

/** @deprecated Prefer mergeThreadMessages — kept as alias for existing imports */
export function mergeMessages(existing = [], incoming = []) {
  return mergeThreadMessages(existing, incoming);
}

function trimMessages(messages) {
  if (!Array.isArray(messages) || messages.length <= CACHE_MAX_MESSAGES) {
    return { messages: messages || [], trimmed: false };
  }
  return { messages: messages.slice(-CACHE_MAX_MESSAGES), trimmed: true };
}

export async function readThread(type, peerId) {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(threadKey(type, peerId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function writeThread(type, peerId, payload) {
  try {
    const { messages, trimmed } = trimMessages(payload.messages || []);
    const hasMoreOlder = trimmed ? true : Boolean(payload.hasMoreOlder);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const record = {
        key: threadKey(type, peerId),
        type,
        peerId: String(peerId),
        messages,
        hasMoreOlder,
        oldestCachedAt: messages[0]?.createdAt || payload.oldestCachedAt || null,
        newestAt: messages[messages.length - 1]?.createdAt || payload.newestAt || null,
        syncedAt: payload.syncedAt ?? Date.now(),
      };
      const req = tx.objectStore(STORE).put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function removeThread(type, peerId) {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(threadKey(type, peerId));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

export async function clearAllThreads() {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

/** In-memory L1 cache for instant chat switching */
const memoryThreads = new Map();

export function readMemoryThread(type, peerId) {
  return memoryThreads.get(threadKey(type, peerId)) || null;
}

export function writeMemoryThread(type, peerId, data) {
  const { messages, trimmed } = trimMessages(data.messages || []);
  memoryThreads.set(threadKey(type, peerId), {
    ...data,
    type,
    peerId: String(peerId),
    messages,
    hasMoreOlder: trimmed ? true : Boolean(data.hasMoreOlder),
    oldestCachedAt: messages[0]?.createdAt || data.oldestCachedAt || null,
    newestAt: messages[messages.length - 1]?.createdAt || data.newestAt || null,
    syncedAt: data.syncedAt ?? Date.now(),
  });
}

export function clearMemoryThreads() {
  memoryThreads.clear();
}

/**
 * Instant open: memory first, else IndexedDB.
 * If memory already has messages, skip IDB (avoids cache-then-replace flicker).
 */
export async function hydrateThread(type, peerId) {
  const mem = readMemoryThread(type, peerId);
  if (mem?.messages?.length) return mem;
  const idb = await readThread(type, peerId);
  if (idb?.messages?.length) {
    writeMemoryThread(type, peerId, idb);
    return idb;
  }
  return null;
}

/** List cached thread cursors for reconnect catch-up (top N by newestAt). */
export function listMemoryThreadCursors(limit = 20) {
  const rows = [];
  for (const record of memoryThreads.values()) {
    if (!record?.peerId || !record?.newestAt) continue;
    rows.push({
      type: record.type,
      peerId: record.peerId,
      newestAt: record.newestAt,
      syncedAt: record.syncedAt || 0,
    });
  }
  rows.sort((a, b) => new Date(b.newestAt) - new Date(a.newestAt));
  return rows.slice(0, limit);
}
