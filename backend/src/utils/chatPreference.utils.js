import ChatPreference from "../models/chatPreference.model.js";

export function isChatMuted(pref) {
  if (!pref?.mutedUntil) return false;
  return new Date(pref.mutedUntil) > new Date();
}

export async function getPreferencesMap(userId) {
  const prefs = await ChatPreference.find({ userId }).lean();
  const map = new Map();
  prefs.forEach((p) => {
    map.set(`${p.chatType}:${p.targetId}`, p);
  });
  return map;
}

export async function unarchiveDmChat(senderId, receiverId) {
  await ChatPreference.updateMany(
    {
      chatType: "dm",
      isArchived: true,
      $or: [
        { userId: senderId, targetId: receiverId },
        { userId: receiverId, targetId: senderId },
      ],
    },
    { $set: { isArchived: false } }
  );
}

export async function unarchiveGroupChatForMembers(groupId, memberIds) {
  if (!memberIds?.length) return;
  await ChatPreference.updateMany(
    {
      chatType: "group",
      targetId: groupId,
      userId: { $in: memberIds },
      isArchived: true,
    },
    { $set: { isArchived: false } }
  );
}

/** Cron: clear expired mutes */
export async function clearExpiredMutes() {
  const result = await ChatPreference.updateMany(
    { mutedUntil: { $lte: new Date(), $ne: null } },
    { $set: { mutedUntil: null } }
  );
  return result.modifiedCount || 0;
}
