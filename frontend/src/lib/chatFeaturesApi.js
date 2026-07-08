import { axiosInstance } from "./axios";

export const chatFeaturesApi = {
  getPreference: (chatType, targetId) =>
    axiosInstance.get(`/chat/preferences/${chatType}/${targetId}`),

  updatePreference: (payload) =>
    axiosInstance.put("/chat/preferences", payload),

  setArchive: (chatType, targetId, archived) =>
    axiosInstance.post("/chat/archive", { chatType, targetId, archived }),

  getArchived: () => axiosInstance.get("/chat/archived"),

  setMute: (chatType, targetId, duration) =>
    axiosInstance.post("/chat/mute", { chatType, targetId, duration }),

  clearMute: (chatType, targetId) =>
    axiosInstance.delete(`/chat/mute/${chatType}/${targetId}`),

  getStarred: () => axiosInstance.get("/chat/starred"),

  getStarredIds: () => axiosInstance.get("/chat/starred/ids"),

  starMessage: (messageId, chatType, targetId) =>
    axiosInstance.post("/chat/starred", { messageId, chatType, targetId }),

  unstarMessage: (messageId) =>
    axiosInstance.delete(`/chat/starred/${messageId}`),

  getSharedMedia: (chatType, targetId, tab, page = 1, limit = 24) =>
    axiosInstance.get(`/chat/shared-media/${chatType}/${targetId}`, {
      params: { tab, page, limit },
    }),

  uploadVideo: (file, duration, onProgress) => {
    const form = new FormData();
    form.append("video", file);
    form.append("duration", String(Math.round(duration || 0)));
    return axiosInstance.post("/chat/upload-video", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
};

export const MAX_VIDEO_MB = 50;
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm";
