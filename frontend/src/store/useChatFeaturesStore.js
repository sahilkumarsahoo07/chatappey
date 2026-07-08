import { create } from "zustand";
import toast from "react-hot-toast";
import { chatFeaturesApi } from "../lib/chatFeaturesApi";
import { useChatStore } from "./useChatStore";
import { useGroupStore } from "./useGroupStore";
import { haptic } from "../lib/haptics";

export const useChatFeaturesStore = create((set, get) => ({
  starredIds: new Set(),
  starredItems: [],
  archivedDms: [],
  archivedGroups: [],
  isStarredLoading: false,
  isArchivedLoading: false,
  preferencesCache: {},

  loadStarredIds: async () => {
    try {
      const res = await chatFeaturesApi.getStarredIds();
      set({ starredIds: new Set(res.data.ids || []) });
    } catch {
      /* silent */
    }
  },

  loadStarred: async () => {
    set({ isStarredLoading: true });
    try {
      const res = await chatFeaturesApi.getStarred();
      set({ starredItems: res.data.items || [] });
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to load starred messages");
    } finally {
      set({ isStarredLoading: false });
    }
  },

  toggleStar: async (messageId, chatType, targetId, isStarred) => {
    try {
      if (isStarred) {
        await chatFeaturesApi.unstarMessage(messageId);
        const next = new Set(get().starredIds);
        next.delete(messageId);
        set({ starredIds: next });
        toast.success("Removed from starred");
      } else {
        await chatFeaturesApi.starMessage(messageId, chatType, targetId);
        const next = new Set(get().starredIds);
        next.add(messageId);
        set({ starredIds: next });
        toast.success("Message starred");
      }
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to update star");
    }
  },

  loadArchived: async () => {
    set({ isArchivedLoading: true });
    try {
      const res = await chatFeaturesApi.getArchived();
      set({
        archivedDms: res.data.dms || [],
        archivedGroups: res.data.groups || [],
      });
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to load archived chats");
    } finally {
      set({ isArchivedLoading: false });
    }
  },

  setArchive: async (chatType, targetId, archived) => {
    try {
      await chatFeaturesApi.setArchive(chatType, targetId, archived);
      if (chatType === "dm") {
        useChatStore.getState().refreshUsers();
      } else {
        useGroupStore.getState().getGroups();
      }
      get().loadArchived();
      haptic("archive");
      toast.success(archived ? "Chat archived" : "Chat unarchived");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to update archive");
    }
  },

  setMute: async (chatType, targetId, duration) => {
    try {
      await chatFeaturesApi.setMute(chatType, targetId, duration);
      if (chatType === "dm") {
        useChatStore.getState().refreshUsers();
      } else {
        useGroupStore.getState().getGroups();
      }
      toast.success(duration === "always" ? "Chat muted" : "Chat muted temporarily");
      haptic("mute");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to mute chat");
    }
  },

  clearMute: async (chatType, targetId) => {
    try {
      await chatFeaturesApi.clearMute(chatType, targetId);
      if (chatType === "dm") {
        useChatStore.getState().refreshUsers();
      } else {
        useGroupStore.getState().getGroups();
      }
      toast.success("Chat unmuted");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to unmute chat");
    }
  },

  getPreference: async (chatType, targetId) => {
    const key = `${chatType}:${targetId}`;
    const cached = get().preferencesCache[key];
    if (cached) return cached;
    try {
      const res = await chatFeaturesApi.getPreference(chatType, targetId);
      const pref = res.data.preference;
      set({
        preferencesCache: { ...get().preferencesCache, [key]: pref },
      });
      return pref;
    } catch {
      return null;
    }
  },

  updateWallpaper: async (chatType, targetId, wallpaper) => {
    try {
      await chatFeaturesApi.updatePreference({ chatType, targetId, wallpaper });
      const key = `${chatType}:${targetId}`;
      const existing = get().preferencesCache[key] || {};
      set({
        preferencesCache: {
          ...get().preferencesCache,
          [key]: { ...existing, wallpaper },
        },
      });
      toast.success("Wallpaper updated");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to update wallpaper");
    }
  },

  isStarred: (messageId) => get().starredIds.has(messageId),
}));
