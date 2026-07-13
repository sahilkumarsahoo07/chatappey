/**
 * Bulk / single delivery ACK for group messages (WhatsApp-like).
 */

import mongoose from "mongoose";
import GroupMessage from "../models/groupMessage.model.js";
import Group from "../models/group.model.js";
import { applyComputedStatus } from "./groupMessageStatus.utils.js";
import { canUpgradeStatus, emitToUser } from "./messageStatus.utils.js";

function isValidObjectId(id) {
  return id && mongoose.Types.ObjectId.isValid(String(id));
}

/**
 * Mark one or many group messages as delivered to `userId`.
 * Emits `group:messageDelivered` to the group room and each sender's user room.
 *
 * @returns {Promise<Array<{ messageId, status, deliveredAt }>>}
 */
export async function ackGroupMessagesDelivered({
  io,
  userSocketMap,
  groupId,
  userId,
  messageIds = null,
  limit = 150,
}) {
  if (!io || !groupId || !userId) return [];
  if (messageIds?.length === 0) return [];

  const group = await Group.findById(groupId).select("members");
  if (!group) return [];

  const isMember = group.members.some(
    (m) => String(m.user?._id || m.user) === String(userId)
  );
  if (!isMember) return [];

  const memberIds = group.members.map((m) => m.user?._id || m.user);
  const now = new Date();

  const filter = {
    groupId,
    senderId: { $ne: userId },
    messageType: { $ne: "system" },
    deliveredTo: { $not: { $elemMatch: { userId } } },
  };

  if (messageIds?.length) {
    const validIds = messageIds
      .map((id) => String(id))
      .filter((id) => isValidObjectId(id) && !String(id).startsWith("temp-"));
    if (validIds.length === 0) return [];
    filter._id = { $in: validIds };
  }

  const pending = await GroupMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  const updates = [];

  for (const message of pending) {
    const already = (message.deliveredTo || []).some(
      (d) => String(d.userId) === String(userId)
    );
    if (!already) {
      message.deliveredTo = message.deliveredTo || [];
      message.deliveredTo.push({ userId, deliveredAt: now });
    }

    const nextStatus = applyComputedStatus(message, memberIds);
    if (canUpgradeStatus(message.status, nextStatus) || !message.status) {
      message.status = nextStatus;
    }
    await message.save();

    const payload = {
      groupId: String(groupId),
      messageId: String(message._id),
      clientMessageId: message.clientMessageId || null,
      deliveredBy: {
        _id: userId,
        deliveredAt: now,
      },
      status: message.status,
      deliveredAt: now,
    };

    io.to(String(groupId)).emit("group:messageDelivered", payload);
    // Ensure sender gets the update even if not in group room / multi-device
    emitToUser(io, userSocketMap, message.senderId, "group:messageDelivered", payload);

    updates.push({
      messageId: String(message._id),
      status: message.status,
      deliveredAt: now,
    });
  }

  return updates;
}

export { isValidObjectId };
