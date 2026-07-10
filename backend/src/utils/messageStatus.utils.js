/**
 * WhatsApp-like message status helpers.
 * Order: sent < delivered < read (never downgrade).
 */

export const STATUS_RANK = { sent: 1, delivered: 2, read: 3, scheduled: 0, pending: 0 };

export function canUpgradeStatus(current, next) {
  return (STATUS_RANK[next] || 0) > (STATUS_RANK[current] || 0);
}

/** Emit to all devices of a user (user room). Falls back to legacy socket map. */
export function emitToUser(io, userSocketMap, userId, event, payload) {
  if (userId == null) return;
  const key = String(typeof userId === "object" && userId._id != null ? userId._id : userId);
  const room = io.sockets?.adapter?.rooms?.get(`user:${key}`);
  if (room && room.size > 0) {
    io.to(`user:${key}`).emit(event, payload);
    return;
  }
  const sid = userSocketMap[key];
  if (sid) {
    io.to(sid).emit(event, payload);
  }
}

export function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a?._id ?? a) === String(b?._id ?? b);
}
