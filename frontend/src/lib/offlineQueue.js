/**
 * Offline-first queue persisted in IndexedDB.
 * Syncs when navigator.onLine and socket/API are available.
 */

const DB_NAME = "chatappey_offline";
const DB_VERSION = 1;
const STORE = "queue";

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
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

export const QueueItemStatus = {
  PENDING: "pending",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
};

export const QueueItemType = {
  MESSAGE: "message",
  IMAGE_UPLOAD: "image_upload",
  VIDEO_UPLOAD: "video_upload",
  REACTION: "reaction",
  STATUS_UPLOAD: "status_upload",
};

export async function enqueueOffline(type, payload) {
  const item = {
    type,
    payload,
    status: QueueItemStatus.PENDING,
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return withStore("readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.add(item);
      req.onsuccess = () => resolve({ ...item, id: req.result });
      req.onerror = () => reject(req.error);
    });
  });
}

export async function listQueue(filterStatus) {
  return withStore("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        let items = req.result || [];
        if (filterStatus) items = items.filter((i) => i.status === filterStatus);
        items.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function updateQueueItem(id, patch) {
  return withStore("readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          resolve(null);
          return;
        }
        const next = { ...existing, ...patch, updatedAt: Date.now() };
        const putReq = store.put(next);
        putReq.onsuccess = () => resolve(next);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

export async function removeQueueItem(id) {
  return withStore("readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearSentItems() {
  const items = await listQueue(QueueItemStatus.SENT);
  await Promise.all(items.map((i) => removeQueueItem(i.id)));
}

/**
 * Process queue in order. handler(item) should throw on failure.
 */
export async function flushOfflineQueue(handler, { maxAttempts = 3 } = {}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { processed: 0 };

  const items = await listQueue();
  const pending = items.filter(
    (i) =>
      i.status === QueueItemStatus.PENDING ||
      (i.status === QueueItemStatus.FAILED && (i.attempts || 0) < maxAttempts)
  );

  let processed = 0;
  for (const item of pending) {
    await updateQueueItem(item.id, { status: QueueItemStatus.SENDING });
    try {
      await handler(item);
      await updateQueueItem(item.id, { status: QueueItemStatus.SENT });
      await removeQueueItem(item.id);
      processed += 1;
    } catch (err) {
      await updateQueueItem(item.id, {
        status: QueueItemStatus.FAILED,
        attempts: (item.attempts || 0) + 1,
        lastError: err?.message || String(err),
      });
    }
  }
  return { processed };
}

export async function clearOfflineQueue() {
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

