/**
 * WhatsApp-style "Delete for Everyone" window (ms).
 * Override with env DELETE_FOR_EVERYONE_WINDOW_MS (e.g. 900000 = 15 min).
 */
export const DELETE_FOR_EVERYONE_WINDOW_MS = Number(
  process.env.DELETE_FOR_EVERYONE_WINDOW_MS || 15 * 60 * 1000
);

export const DELETED_TEXT_EVERYONE = "This message was deleted";
export const DELETED_TEXT_YOU = "You deleted this message";

/** Clear media / content fields while keeping timestamps & receipts */
export const CLEARED_MEDIA_FIELDS = {
  image: null,
  audio: null,
  file: null,
  fileName: null,
  video: null,
  videoThumbnail: null,
  videoDuration: null,
  videoPublicId: null,
  poll: undefined,
};

export function getSenderId(message) {
  if (!message) return null;
  const s = message.senderId;
  return s?._id ? String(s._id) : s ? String(s) : null;
}

/**
 * Backend source of truth: can this user still delete for everyone?
 */
export function canDeleteForEveryone(message, userId) {
  if (!message || !userId) return false;
  if (message.deletedForEveryone || message.deleted) return false;
  // Legacy tombstone
  if (message.text === DELETED_TEXT_EVERYONE || message.text === DELETED_TEXT_YOU) {
    return false;
  }
  if (getSenderId(message) !== String(userId)) return false;
  const created = new Date(message.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= DELETE_FOR_EVERYONE_WINDOW_MS;
}

export function getDeleteOptions(message, userId) {
  const isSender = getSenderId(message) === String(userId);
  const alreadyGone =
    message?.deletedForEveryone ||
    message?.deleted ||
    message?.text === DELETED_TEXT_EVERYONE ||
    message?.text === DELETED_TEXT_YOU;

  return {
    canDeleteForMe: !alreadyGone,
    canDeleteForEveryone: canDeleteForEveryone(message, userId),
    isSender,
    windowMs: DELETE_FOR_EVERYONE_WINDOW_MS,
    expiresAt:
      isSender && message?.createdAt
        ? new Date(new Date(message.createdAt).getTime() + DELETE_FOR_EVERYONE_WINDOW_MS).toISOString()
        : null,
  };
}

/** Apply delete-for-everyone fields onto a mongoose doc (mutates) */
export function applyDeleteForEveryoneFields(message, userId) {
  message.deleted = true;
  message.deletedForEveryone = true;
  message.deletedAt = new Date();
  message.deletedBy = userId;
  message.text = DELETED_TEXT_EVERYONE;
  message.image = null;
  message.audio = null;
  message.file = null;
  message.fileName = null;
  message.video = null;
  message.videoThumbnail = null;
  message.videoDuration = null;
  message.videoPublicId = null;
  message.poll = undefined;
  return message;
}

/** Annotate plain message objects with canDeleteForEveryone for the viewer */
export function annotateDeleteFlags(messages, userId) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((m) => {
    const obj = typeof m.toObject === "function" ? m.toObject() : { ...m };
    obj.canDeleteForEveryone = canDeleteForEveryone(obj, userId);
    return obj;
  });
}
