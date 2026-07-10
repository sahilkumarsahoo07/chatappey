/**
 * IndexedDB cache for chat message threads — instant open + background sync.
 */

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

export function mergeMessages(existing = [], incoming = []) {
  const map = new Map();
  for (const m of existing) {
    if (m?._id != null) map.set(String(m._id), m);
  }
  for (const m of incoming) {
    if (m?._id != null) map.set(String(m._id), m);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function trimMessages(messages) {
  if (!Array.isArray(messages) || messages.length <= CACHE_MAX_MESSAGES) {
    return messages || [];
  }
  return messages.slice(-CACHE_MAX_MESSAGES);
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
    const messages = trimMessages(payload.messages || []);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const record = {
        key: threadKey(type, peerId),
        type,
        peerId: String(peerId),
        messages,
        hasMoreOlder: Boolean(payload.hasMoreOlder),
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
  memoryThreads.set(threadKey(type, peerId), {
    ...data,
    messages: trimMessages(data.messages || []),
    syncedAt: data.syncedAt ?? Date.now(),
  });
}

export function clearMemoryThreads() {
  memoryThreads.clear();
}

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
