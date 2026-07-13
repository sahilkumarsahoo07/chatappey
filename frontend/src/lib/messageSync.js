/**
 * WhatsApp-grade message thread sync + stable ordering.
 *
 * Ordering rules (identical for every participant once confirmed):
 * 1. Confirmed messages: serverCreatedAt → Mongo ObjectId time → _id
 * 2. Optimistic/pending messages: ALWAYS after all confirmed, by clientSeq
 *
 * Never trust client Date.now() for ordering confirmed messages.
 */

import { messageMatchesIds, sameId, upgradeStatus } from "./messageStatus";

/** Collect all identity keys for a message (for Map indexing). */
export function messageIdentityKeys(msg) {
  if (!msg) return [];
  const keys = new Set();
  const add = (v) => {
    if (v == null || v === "") return;
    keys.add(String(v));
  };
  add(msg._id);
  add(msg.realId);
  add(msg.clientMessageId);
  add(msg.optimisticId);
  return [...keys];
}

export function isPendingMessage(msg) {
  if (!msg) return false;
  if (msg.isOptimistic || msg.pending || msg.sending) return true;
  if (msg.status === "pending") return true;
  const id = String(msg._id || "");
  if (id.startsWith("temp-")) return true;
  // No server timestamp yet → still pending for sort purposes
  if (!msg.serverCreatedAt && !msg.createdAt && id.startsWith("temp-")) return true;
  return false;
}

/** Extract timestamp from Mongo ObjectId (seconds → ms). Null for temp ids. */
export function objectIdTimestamp(id) {
  if (id == null) return null;
  const s = String(typeof id === "object" ? id._id ?? id : id);
  if (!/^[a-fA-F0-9]{24}$/.test(s)) return null;
  try {
    return parseInt(s.slice(0, 8), 16) * 1000;
  } catch {
    return null;
  }
}

/**
 * Authoritative server time for ordering.
 * Prefers explicit serverCreatedAt, then createdAt only if message is confirmed.
 */
export function getServerSortTime(msg) {
  if (!msg || isPendingMessage(msg)) return null;
  if (msg.serverCreatedAt) {
    const t = new Date(msg.serverCreatedAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (msg.createdAt) {
    const t = new Date(msg.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  return objectIdTimestamp(msg.realId || msg._id);
}

function getClientSeq(msg) {
  const n = Number(msg?.clientSeq);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Stable WhatsApp-like comparator.
 * Pending (optimistic) messages sort after every confirmed message.
 */
export function compareMessages(a, b) {
  const aPending = isPendingMessage(a);
  const bPending = isPendingMessage(b);

  if (aPending && bPending) {
    const ds = getClientSeq(a) - getClientSeq(b);
    if (ds !== 0) return ds;
    return String(a?.optimisticId || a?._id || "").localeCompare(
      String(b?.optimisticId || b?._id || "")
    );
  }
  if (aPending) return 1; // a after b
  if (bPending) return -1;

  const ta = getServerSortTime(a) ?? 0;
  const tb = getServerSortTime(b) ?? 0;
  if (ta !== tb) return ta - tb;

  // Same millisecond — ObjectId order is globally consistent
  const ida = String(a?.realId || a?._id || "");
  const idb = String(b?.realId || b?._id || "");
  return ida.localeCompare(idb);
}

export function sortMessages(messages = []) {
  if (!Array.isArray(messages) || messages.length < 2) return messages || [];
  return [...messages].sort(compareMessages);
}

/** Normalize inbound server message with explicit serverCreatedAt. */
export function withServerOrdering(msg) {
  if (!msg) return msg;
  const serverCreatedAt =
    msg.serverCreatedAt ||
    msg.createdAt ||
    (objectIdTimestamp(msg._id)
      ? new Date(objectIdTimestamp(msg._id)).toISOString()
      : null);
  return {
    ...msg,
    serverCreatedAt,
    createdAt: msg.createdAt || serverCreatedAt,
    isOptimistic: false,
    pending: false,
    sending: false,
  };
}

/**
 * Prefer server fields but keep stable UI identity (optimisticId / clientMessageId)
 * and never downgrade delivery ticks.
 */
export function reconcileMessages(existing, incoming, { preferServer = true } = {}) {
  if (!existing) return withServerOrdering(incoming);
  if (!incoming) return { ...existing };

  const incomingNorm = isPendingMessage(incoming)
    ? { ...incoming }
    : withServerOrdering(incoming);

  const base = preferServer
    ? { ...existing, ...incomingNorm }
    : { ...incomingNorm, ...existing };

  const clientMessageId =
    existing.clientMessageId ||
    incomingNorm.clientMessageId ||
    existing.optimisticId ||
    null;

  const optimisticId =
    existing.optimisticId ||
    clientMessageId ||
    existing._id;

  const realId =
    incomingNorm.realId ||
    incomingNorm._id ||
    existing.realId ||
    null;

  const serverId =
    incomingNorm._id && !String(incomingNorm._id).startsWith("temp-")
      ? incomingNorm._id
      : existing.realId && !String(existing.realId).startsWith("temp-")
        ? existing.realId
        : existing._id && !String(existing._id).startsWith("temp-")
          ? existing._id
          : incomingNorm._id || existing._id;

  const serverCreatedAt =
    incomingNorm.serverCreatedAt ||
    existing.serverCreatedAt ||
    incomingNorm.createdAt ||
    null;

  const stillPending =
    preferServer && incomingNorm && !isPendingMessage(incomingNorm)
      ? false
      : isPendingMessage(existing) && isPendingMessage(incomingNorm);

  return {
    ...base,
    _id: serverId,
    realId: realId && !String(realId).startsWith("temp-") ? realId : serverId,
    clientMessageId,
    optimisticId,
    clientSeq: existing.clientSeq ?? incomingNorm.clientSeq,
    clientCreatedAt:
      existing.clientCreatedAt ||
      incomingNorm.clientCreatedAt ||
      existing.createdAt,
    serverCreatedAt,
    // Display clock: prefer server once confirmed
    createdAt: stillPending
      ? existing.clientCreatedAt || existing.createdAt || incomingNorm.createdAt
      : serverCreatedAt || incomingNorm.createdAt || existing.createdAt,
    isOptimistic: stillPending,
    pending: stillPending,
    sending: stillPending ? existing.sending || incomingNorm.sending : false,
    status: upgradeStatus(existing.status, incomingNorm.status || existing.status),
    image: incomingNorm.image || existing.image,
    audio: incomingNorm.audio || existing.audio,
    video: incomingNorm.video || existing.video,
    file: incomingNorm.file || existing.file,
  };
}

/**
 * Identity-aware merge — prevents optimistic+server duplicates.
 * Always returns stably sorted list (server order + pending at end).
 */
export function mergeThreadMessages(existing = [], incoming = [], options = {}) {
  const map = new Map();
  const keyToPrimary = new Map();

  const register = (msg, preferServer) => {
    if (!msg) return;
    const keys = messageIdentityKeys(msg);
    if (keys.length === 0) return;

    let primary = null;
    for (const k of keys) {
      if (keyToPrimary.has(k)) {
        primary = keyToPrimary.get(k);
        break;
      }
    }

    if (primary == null) {
      primary = keys[0];
      const stored = isPendingMessage(msg) ? { ...msg } : withServerOrdering(msg);
      map.set(primary, stored);
      for (const k of keys) keyToPrimary.set(k, primary);
      return;
    }

    const prev = map.get(primary);
    const merged = reconcileMessages(prev, msg, { preferServer });
    map.set(primary, merged);

    for (const k of messageIdentityKeys(merged)) {
      keyToPrimary.set(k, primary);
    }
  };

  for (const m of existing) register(m, false);
  for (const m of incoming) register(m, options.preferServer !== false);

  return sortMessages([...map.values()]);
}

/** Append or replace a single message in a thread (socket / ACK / HTTP). */
export function upsertMessage(list = [], msg, options = {}) {
  if (!msg) return list || [];
  return mergeThreadMessages(list, [msg], options);
}

/** True if message already exists under any identity. */
export function threadHasMessage(list = [], msg) {
  if (!msg || !list?.length) return false;
  const keys = new Set(messageIdentityKeys(msg));
  return list.some((m) => messageIdentityKeys(m).some((k) => keys.has(k)));
}

/** Oldest / newest cursors for delta sync — confirmed messages only. */
export function threadCursors(messages = []) {
  const confirmed = (messages || []).filter((m) => !isPendingMessage(m));
  if (!confirmed.length) {
    return { oldest: null, newest: null };
  }
  const sorted = sortMessages(confirmed);
  return {
    oldest: sorted[0]?.serverCreatedAt || sorted[0]?.createdAt || null,
    newest:
      sorted[sorted.length - 1]?.serverCreatedAt ||
      sorted[sorted.length - 1]?.createdAt ||
      null,
  };
}

/**
 * Stale-fetch gate: ignore HTTP responses after the user switched threads.
 */
export function createThreadFetchGate(getSelectedId) {
  let generation = 0;
  return {
    begin(threadId) {
      generation += 1;
      return { gen: generation, threadId: String(threadId) };
    },
    isCurrent(threadId, token) {
      if (!token) return sameId(getSelectedId(), threadId);
      return (
        token.gen === generation &&
        String(token.threadId) === String(threadId) &&
        sameId(getSelectedId(), threadId)
      );
    },
  };
}

/**
 * Reconcile ACK / socket echo into the open list.
 */
export function applyServerAck(list, clientMessageId, serverMessage) {
  if (!serverMessage) return list;
  const existing =
    list.find((m) => messageMatchesIds(m, { clientMessageId })) || {
      clientMessageId,
      optimisticId: clientMessageId,
    };
  const reconciled = reconcileMessages(existing, {
    ...withServerOrdering(serverMessage),
    clientMessageId,
    optimisticId: existing.optimisticId || clientMessageId,
    clientSeq: existing.clientSeq,
    realId: serverMessage._id,
    isOptimistic: false,
    pending: false,
  });
  return upsertMessage(list, reconciled);
}

/** Monotonic client send sequence (per tab) for pending-message order. */
let __clientSeq = 0;
export function nextClientSeq() {
  __clientSeq += 1;
  return __clientSeq;
}
