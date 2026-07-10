/** Client-side message status helpers (WhatsApp-like, never downgrade) */

export const STATUS_RANK = {
  pending: 0,
  scheduled: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function canUpgradeStatus(current, next) {
  return (STATUS_RANK[next] || 0) > (STATUS_RANK[current] || 0);
}

export function upgradeStatus(current, next) {
  return canUpgradeStatus(current, next) ? next : current;
}

export function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a?._id ?? a) === String(b?._id ?? b);
}

export function makeClientMessageId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Match a message by real id, clientMessageId, or optimisticId */
export function messageMatchesIds(msg, { messageId, clientMessageId } = {}) {
  if (!msg) return false;
  if (messageId && sameId(msg._id, messageId)) return true;
  if (messageId && sameId(msg.realId, messageId)) return true;
  if (clientMessageId) {
    if (msg.clientMessageId === clientMessageId) return true;
    if (msg.optimisticId === clientMessageId) return true;
    if (sameId(msg._id, clientMessageId)) return true;
  }
  return false;
}
