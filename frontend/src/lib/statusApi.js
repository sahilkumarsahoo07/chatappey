import { axiosInstance } from "./axios";

/**
 * Upload status with progress callback (0–100).
 * Uses multipart FormData — media never goes to Mongo as Base64.
 */
export async function uploadStatusApi(
  { media, thumbnail, duration, caption, privacy, excludedUserIds, includedUserIds, music, mentions, restory },
  onProgress
) {
  const form = new FormData();
  if (media) form.append("media", media);
  if (thumbnail) form.append("thumbnail", thumbnail);
  form.append("duration", String(duration ?? 5));
  if (caption) form.append("caption", caption);
  if (privacy) form.append("privacy", privacy);
  if (excludedUserIds?.length) {
    form.append("excludedUserIds", JSON.stringify(excludedUserIds));
  }
  if (includedUserIds?.length) {
    form.append("includedUserIds", JSON.stringify(includedUserIds));
  }
  if (music?.audioUrl || music?.title) {
    form.append("music", JSON.stringify(music));
  }
  if (mentions?.length) {
    form.append("mentions", JSON.stringify(mentions));
  }
  if (restory) {
    form.append("restory", JSON.stringify(restory));
  }

  const res = await axiosInstance.post("/status/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (!onProgress || !evt.total) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return res.data;
}

export async function fetchStatusFeed() {
  const res = await axiosInstance.get("/status");
  return res.data;
}

export async function fetchUserStatuses(userId) {
  const res = await axiosInstance.get(`/status/${userId}`);
  return res.data;
}

export async function deleteStatusApi(statusId) {
  const res = await axiosInstance.delete(`/status/${statusId}`);
  return res.data;
}

export async function viewStatusApi(statusId) {
  const res = await axiosInstance.post(`/status/view/${statusId}`);
  return res.data;
}

export async function fetchStatusViewers(statusId) {
  const res = await axiosInstance.get(`/status/viewers/${statusId}`);
  return res.data;
}

export async function toggleStatusLikeApi(statusId) {
  const res = await axiosInstance.post(`/status/${statusId}/like`);
  return res.data;
}

export async function reactToStatusApi(statusId, emoji) {
  const res = await axiosInstance.post(`/status/${statusId}/react`, { emoji });
  return res.data;
}

export async function commentOnStatusApi(statusId, { text, replyTo, mentions }) {
  const res = await axiosInstance.post(`/status/${statusId}/comment`, {
    text,
    replyTo,
    mentions,
  });
  return res.data;
}

export async function deleteStatusCommentApi(statusId, commentId) {
  const res = await axiosInstance.delete(`/status/${statusId}/comment/${commentId}`);
  return res.data;
}

export async function fetchStatusCommentsApi(statusId) {
  const res = await axiosInstance.get(`/status/comments/${statusId}`);
  return res.data;
}

export async function fetchStatusEngagementApi(statusId) {
  const res = await axiosInstance.get(`/status/engagement/${statusId}`);
  return res.data;
}

export const STATUS_REACTION_EMOJIS = ["❤️", "😂", "🔥", "😍", "👍", "👏", "😢", "😮"];

