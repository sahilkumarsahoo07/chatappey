/**
 * Group message delivery / read status (WhatsApp-like aggregate ticks).
 * Status never downgrades: sent < delivered < read
 */

import { canUpgradeStatus } from "./messageStatus.utils.js";

export function receiptUserId(entry) {
  if (entry == null) return null;
  if (typeof entry === "object") {
    return String(entry.userId?._id || entry.userId || entry._id || entry);
  }
  return String(entry);
}

export function normalizeReceiptList(list = []) {
  const map = new Map();
  for (const entry of list || []) {
    const id = receiptUserId(entry);
    if (!id || id === "undefined" || id === "null") continue;
    const at =
      entry?.deliveredAt ||
      entry?.readAt ||
      entry?.at ||
      null;
    const prev = map.get(id);
    if (!prev) {
      map.set(id, {
        userId: id,
        deliveredAt: entry?.deliveredAt || (entry?.readAt ? entry.readAt : at),
        readAt: entry?.readAt || null,
        fullName: entry?.fullName || entry?.userId?.fullName,
        profilePic: entry?.profilePic || entry?.userId?.profilePic,
      });
    } else {
      map.set(id, {
        ...prev,
        deliveredAt: prev.deliveredAt || entry?.deliveredAt || at,
        readAt: prev.readAt || entry?.readAt || null,
        fullName: prev.fullName || entry?.fullName || entry?.userId?.fullName,
        profilePic: prev.profilePic || entry?.profilePic || entry?.userId?.profilePic,
      });
    }
  }
  return [...map.values()];
}

/** Member ids excluding sender (and optional self filter). */
export function groupRecipientIds(memberIds = [], senderId) {
  const sid = String(senderId?._id || senderId || "");
  return (memberIds || [])
    .map((m) => String(m?._id || m?.user?._id || m?.user || m))
    .filter((id) => id && id !== sid);
}

/**
 * WhatsApp aggregate:
 * - read: every other member has read
 * - delivered: every other member has delivered (read counts as delivered)
 * - else sent
 */
export function computeGroupMessageStatus(message, memberIds = []) {
  if (!message || message.messageType === "system") return message?.status || "sent";
  const senderId = message.senderId?._id || message.senderId;
  const others = groupRecipientIds(memberIds, senderId);
  if (others.length === 0) return "read";

  const readIds = new Set(
    [
      ...(message.readBy || []),
      ...(message.readReceipts || []),
    ]
      .map(receiptUserId)
      .filter(Boolean)
  );
  const deliveredIds = new Set(
    (message.deliveredTo || []).map(receiptUserId).filter(Boolean)
  );
  // Read implies delivered
  for (const id of readIds) deliveredIds.add(id);

  if (others.every((id) => readIds.has(String(id)))) return "read";
  if (others.every((id) => deliveredIds.has(String(id)))) return "delivered";
  return "sent";
}

export function applyComputedStatus(message, memberIds) {
  const next = computeGroupMessageStatus(message, memberIds);
  if (!message?.status || message.status === "pending") return next;
  return canUpgradeStatus(message.status, next) ? next : message.status;
}
