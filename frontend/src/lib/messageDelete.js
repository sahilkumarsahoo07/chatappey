/** Shared WhatsApp-style deleted-message helpers */

export const DELETED_TEXT_EVERYONE = "This message was deleted";
export const DELETED_TEXT_YOU = "You deleted this message";

export function getMessageSenderId(message) {
  if (!message) return null;
  const s = message.senderId;
  return s?._id ? String(s._id) : s ? String(s) : null;
}

export function isMessageDeleted(message) {
  if (!message) return false;
  if (message.deletedForEveryone || message.deleted) return true;
  const t = message.text;
  return t === DELETED_TEXT_EVERYONE || t === DELETED_TEXT_YOU;
}

/** Label shown inside the bubble for the current viewer */
export function getDeletedMessageLabel(message, authUserId) {
  if (!isMessageDeleted(message)) return null;
  const deletedBy = message.deletedBy?._id || message.deletedBy;
  if (deletedBy && String(deletedBy) === String(authUserId)) {
    return DELETED_TEXT_YOU;
  }
  // Legacy deletes (no deletedBy): own messages → "You deleted…"
  if (
    !deletedBy &&
    getMessageSenderId(message) === String(authUserId) &&
    (message.text === DELETED_TEXT_EVERYONE || message.text === DELETED_TEXT_YOU)
  ) {
    return DELETED_TEXT_YOU;
  }
  return DELETED_TEXT_EVERYONE;
}

export function applyOptimisticDeleteForEveryone(message, authUserId) {
  return {
    ...message,
    deleted: true,
    deletedForEveryone: true,
    deletedAt: new Date().toISOString(),
    deletedBy: authUserId,
    text: DELETED_TEXT_EVERYONE,
    image: null,
    audio: null,
    file: null,
    fileName: null,
    video: null,
    videoThumbnail: null,
    videoDuration: null,
    videoPublicId: null,
    poll: null,
    canDeleteForEveryone: false,
  };
}

export const deletedSidebarPreview = {
  text: DELETED_TEXT_EVERYONE,
  image: null,
  audio: null,
  file: null,
  video: null,
};
