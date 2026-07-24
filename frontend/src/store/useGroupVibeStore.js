import { create } from "zustand";
import { toast } from "react-hot-toast";
import {
  getGroupVibesApi,
  createGroupVibeApi,
  getAllGroupVibesSummaryApi,
  viewGroupVibeApi,
  reactToGroupVibeApi,
  getGroupVibeViewersApi,
  replyToGroupVibeApi,
  deleteGroupVibeApi,
  getCreatorVibeArchiveApi,
  updateGroupVibePermissionsApi,
} from "../lib/groupVibeApi";
import { audioManager } from "../lib/audioManager";
import { groupVibePreloader } from "../lib/groupVibePreloader";
import { useAuthStore } from "./useAuthStore";

export const useGroupVibeStore = create((set, get) => ({
  // State
  groupVibesMap: {}, // { groupId: [ vibe1, vibe2 ] }
  summaries: {}, // { groupId: { totalCount, unseenCount, hasUnseen, latestAt } }
  loadingGroupId: null,
  isSubmitting: false,

  // Active Modals & Viewer State
  activeViewerGroupId: null,
  activeVibeIndex: 0,
  isViewerOpen: false,
  isCreatorOpen: false,
  creatorTargetGroupId: null,

  // Viewers Drawer & Archive State
  viewersDrawerOpen: false,
  viewersList: [],
  viewersLoading: false,
  archiveOpen: false,
  archiveList: [],
  archiveLoading: false,

  // Floating live reactions during story playback
  floatingReactions: [], // [{ id, emoji, x }]

  // --- ACTIONS ---

  setCreatorOpen: (open, groupId = null) => {
    set({ isCreatorOpen: open, creatorTargetGroupId: groupId });
  },

  setViewerOpen: (open, groupId = null, initialIndex = 0) => {
    if (!open) {
      audioManager.stop();
      set({
        isViewerOpen: false,
        activeViewerGroupId: null,
        activeVibeIndex: 0,
        viewersDrawerOpen: false,
      });
    } else {
      set({
        isViewerOpen: true,
        activeViewerGroupId: groupId,
        activeVibeIndex: initialIndex,
      });
      // Automatically record view for starting vibe
      const vibes = get().groupVibesMap[groupId] || [];
      if (vibes[initialIndex]) {
        get().viewVibe(groupId, vibes[initialIndex]._id);
      }
    }
  },

  setActiveVibeIndex: (index) => {
    const { activeViewerGroupId, groupVibesMap } = get();
    if (!activeViewerGroupId) return;
    const vibes = groupVibesMap[activeViewerGroupId] || [];
    if (index >= 0 && index < vibes.length) {
      audioManager.stop();
      set({ activeVibeIndex: index, viewersDrawerOpen: false });
      const currentVibe = vibes[index];
      if (currentVibe) {
        get().viewVibe(activeViewerGroupId, currentVibe._id);
      }
    }
  },

  nextVibe: () => {
    const { activeViewerGroupId, groupVibesMap, activeVibeIndex } = get();
    if (!activeViewerGroupId) return false;
    const vibes = groupVibesMap[activeViewerGroupId] || [];
    if (activeVibeIndex < vibes.length - 1) {
      get().setActiveVibeIndex(activeVibeIndex + 1);
      return true;
    } else {
      get().setViewerOpen(false);
      return false;
    }
  },

  prevVibe: () => {
    const { activeViewerGroupId, groupVibesMap, activeVibeIndex } = get();
    if (!activeViewerGroupId) return false;
    if (activeVibeIndex > 0) {
      get().setActiveVibeIndex(activeVibeIndex - 1);
      return true;
    }
    return false;
  },

  // Fetch summaries for all groups (ring indicators)
  fetchGroupVibesSummary: async () => {
    try {
      const data = await getAllGroupVibesSummaryApi();
      set({ summaries: data.summaries || {} });
    } catch (e) {
      console.warn("fetchGroupVibesSummary:", e.message);
    }
  },

  // Fetch active vibes for a group
  fetchGroupVibes: async (groupId) => {
    if (!groupId) return;
    set({ loadingGroupId: groupId });
    try {
      const data = await getGroupVibesApi(groupId);
      const vibes = data.vibes || [];
      set((state) => ({
        groupVibesMap: { ...state.groupVibesMap, [groupId]: vibes },
        loadingGroupId: null,
      }));
      if (vibes.length > 0) {
        groupVibePreloader.preloadNeighbors(vibes, 0);
      }
      return vibes;
    } catch (e) {
      console.error("fetchGroupVibes:", e);
      set({ loadingGroupId: null });
      return [];
    }
  },

  // Create Group Vibe (Instant UI / Optimistic)
  createGroupVibe: async (groupId, formData, tempPreviewPayload) => {
    const authUser = useAuthStore.getState().authUser;
    const tempId = `temp_${Date.now()}`;

    const tempVibe = {
      _id: tempId,
      groupId,
      creator: {
        _id: authUser?._id,
        fullName: authUser?.fullName || "Me",
        profilePic: authUser?.profilePic || "",
      },
      mediaType: tempPreviewPayload.mediaType || "photo",
      mediaUrl: tempPreviewPayload.mediaUrl || "",
      thumbnailUrl: tempPreviewPayload.thumbnailUrl || tempPreviewPayload.mediaUrl || "",
      text: tempPreviewPayload.text || "",
      duration: tempPreviewPayload.duration || 5,
      music: tempPreviewPayload.music || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      viewCount: 1,
      viewedByMe: true,
      myReaction: null,
      reactionsSummary: {},
      isUploading: true,
    };

    // Optimistic insert into groupVibesMap & update summary
    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const updatedList = [...currentList, tempVibe];
      const summary = state.summaries[groupId] || { totalCount: 0, unseenCount: 0, hasUnseen: false, latestAt: new Date() };

      return {
        groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList },
        summaries: {
          ...state.summaries,
          [groupId]: {
            ...summary,
            totalCount: summary.totalCount + 1,
            latestAt: tempVibe.createdAt,
          },
        },
        isSubmitting: true,
        isCreatorOpen: false,
      };
    });

      try {
        const data = await createGroupVibeApi(groupId, formData);
        const serverVibe = data.vibe;

        // Replace temp vibe with server vibe & deduplicate
        set((state) => {
          const currentList = state.groupVibesMap[groupId] || [];
          const alreadyHasServerVibe = currentList.some((v) => String(v._id) === String(serverVibe._id));

          let newList;
          if (alreadyHasServerVibe) {
            newList = currentList.filter((v) => v._id !== tempId);
          } else {
            newList = currentList.map((v) => (v._id === tempId ? serverVibe : v));
          }

          // Deduplicate by _id
          const seenIds = new Set();
          const dedupedList = newList.filter((v) => {
            const idStr = String(v._id);
            if (seenIds.has(idStr)) return false;
            seenIds.add(idStr);
            return true;
          });

          return {
            groupVibesMap: { ...state.groupVibesMap, [groupId]: dedupedList },
            isSubmitting: false,
          };
        });

        toast.success("Group Vibe posted! 🚀");
        return serverVibe;
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to post Group Vibe");

      // Rollback optimistic insert
      set((state) => {
        const currentList = state.groupVibesMap[groupId] || [];
        const filteredList = currentList.filter((v) => v._id !== tempId);
        return {
          groupVibesMap: { ...state.groupVibesMap, [groupId]: filteredList },
          isSubmitting: false,
        };
      });
      throw e;
    }
  },

  // Record View
  viewVibe: async (groupId, vibeId) => {
    if (!groupId || !vibeId || String(vibeId).startsWith("temp_")) return;

    // Optimistic mark viewed by me
    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const updatedList = currentList.map((v) => {
        if (v._id === vibeId && !v.viewedByMe) {
          return { ...v, viewedByMe: true };
        }
        return v;
      });

      // Update unseen count in summary if needed
      const summary = state.summaries[groupId];
      let newSummary = summary;
      if (summary && summary.unseenCount > 0) {
        const remainingUnseen = updatedList.filter(
          (v) => !v.viewedByMe && String(v.creator._id) !== String(useAuthStore.getState().authUser?._id)
        ).length;

        newSummary = {
          ...summary,
          unseenCount: remainingUnseen,
          hasUnseen: remainingUnseen > 0,
        };
      }

      return {
        groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList },
        summaries: { ...state.summaries, [groupId]: newSummary },
      };
    });

    try {
      await viewGroupVibeApi(groupId, vibeId);
    } catch (e) {
      console.warn("viewVibe:", e.message);
    }
  },

  // React to Vibe (Instant UI Optimistic Update)
  reactToVibe: async (groupId, vibeId, reactionEmoji) => {
    const authUser = useAuthStore.getState().authUser;
    if (!groupId || !vibeId) return;

    let previousMyReaction = null;

    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const updatedList = currentList.map((v) => {
        if (v._id === vibeId) {
          previousMyReaction = v.myReaction;
          const isTogglingOff = v.myReaction === reactionEmoji;
          const nextReaction = isTogglingOff ? null : reactionEmoji;

          const updatedSummary = { ...(v.reactionsSummary || {}) };
          if (previousMyReaction && updatedSummary[previousMyReaction]) {
            updatedSummary[previousMyReaction] = Math.max(0, updatedSummary[previousMyReaction] - 1);
            if (updatedSummary[previousMyReaction] === 0) delete updatedSummary[previousMyReaction];
          }
          if (nextReaction) {
            updatedSummary[nextReaction] = (updatedSummary[nextReaction] || 0) + 1;
          }

          return { ...v, myReaction: nextReaction, reactionsSummary: updatedSummary };
        }
        return v;
      });

      return { groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList } };
    });

    // Add floating reaction particle
    if (reactionEmoji) {
      const particle = { id: `react_${Date.now()}_${Math.random()}`, emoji: reactionEmoji, x: 20 + Math.random() * 60 };
      set((state) => ({ floatingReactions: [...state.floatingReactions, particle] }));
      setTimeout(() => {
        set((state) => ({
          floatingReactions: state.floatingReactions.filter((p) => p.id !== particle.id),
        }));
      }, 1800);
    }

    try {
      await reactToGroupVibeApi(groupId, vibeId, reactionEmoji);
    } catch (e) {
      // Rollback on failure
      set((state) => {
        const currentList = state.groupVibesMap[groupId] || [];
        const rolledBackList = currentList.map((v) =>
          v._id === vibeId ? { ...v, myReaction: previousMyReaction } : v
        );
        return { groupVibesMap: { ...state.groupVibesMap, [groupId]: rolledBackList } };
      });
      toast.error("Failed to react to Vibe");
    }
  },

  // Reply to Vibe in Group Chat
  replyToVibe: async (groupId, vibeId, text) => {
    try {
      const data = await replyToGroupVibeApi(groupId, vibeId, text);
      toast.success("Replied in group chat! 💬");
      return data;
    } catch (e) {
      toast.error("Failed to send reply");
      throw e;
    }
  },

  // Delete Vibe (Optimistic)
  deleteVibe: async (groupId, vibeId) => {
    if (!groupId || !vibeId) return;

    let deletedVibe = null;

    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      deletedVibe = currentList.find((v) => String(v._id) === String(vibeId));
      const updatedList = currentList.filter((v) => String(v._id) !== String(vibeId));

      const summary = state.summaries[groupId];
      const remainingCount = updatedList.length;
      const newSummary = summary
        ? {
            ...summary,
            totalCount: remainingCount,
            hasUnseen: remainingCount > 0 ? summary.hasUnseen : false,
            unseenCount: remainingCount > 0 ? summary.unseenCount : 0,
          }
        : { totalCount: remainingCount, unseenCount: 0, hasUnseen: false };

      return {
        groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList },
        summaries: { ...state.summaries, [groupId]: newSummary },
      };
    });

    try {
      await deleteGroupVibeApi(groupId, vibeId);
      toast.success("Group Vibe deleted");

      const { activeViewerGroupId, groupVibesMap, activeVibeIndex } = get();
      if (activeViewerGroupId === groupId) {
        const remaining = groupVibesMap[groupId] || [];
        if (remaining.length === 0) {
          get().setViewerOpen(false);
        } else if (activeVibeIndex >= remaining.length) {
          get().setActiveVibeIndex(Math.max(0, remaining.length - 1));
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to delete Group Vibe");
      // Rollback
      if (deletedVibe) {
        set((state) => {
          const currentList = state.groupVibesMap[groupId] || [];
          return {
            groupVibesMap: { ...state.groupVibesMap, [groupId]: [...currentList, deletedVibe] },
          };
        });
      }
    }
  },

  // Viewers list modal/drawer
  fetchVibeViewers: async (groupId, vibeId) => {
    set({ viewersLoading: true, viewersDrawerOpen: true });
    try {
      const data = await getGroupVibeViewersApi(groupId, vibeId);
      set({ viewersList: data.viewers || [], viewersLoading: false });
    } catch (e) {
      set({ viewersLoading: false });
      toast.error("Failed to load viewers");
    }
  },

  closeViewersDrawer: () => set({ viewersDrawerOpen: false, viewersList: [] }),

  // Archive modal
  fetchCreatorArchive: async (groupId) => {
    set({ archiveLoading: true, archiveOpen: true });
    try {
      const data = await getCreatorVibeArchiveApi(groupId);
      set({ archiveList: data.archive || [], archiveLoading: false });
    } catch (e) {
      set({ archiveLoading: false });
      toast.error("Failed to load vibe archive");
    }
  },

  closeArchiveModal: () => set({ archiveOpen: false, archiveList: [] }),

  // Socket event listeners integration
  handleSocketVibeCreated: ({ groupId, vibe }) => {
    if (!groupId || !vibe) return;

    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const authUser = useAuthStore.getState().authUser;
      const isMine = String(vibe.creator?._id || vibe.creatorId?._id || vibe.creatorId) === String(authUser?._id);

      // Filter out any temp vibes if this is created by us
      let list = currentList;
      if (isMine) {
        list = list.filter((v) => !String(v._id).startsWith("temp_"));
      }

      // Check if real vibe is already present
      if (list.some((v) => String(v._id) === String(vibe._id))) return state;

      const updatedList = [...list, vibe];

      // Deduplicate list by _id
      const seenIds = new Set();
      const dedupedList = updatedList.filter((v) => {
        const idStr = String(v._id);
        if (seenIds.has(idStr)) return false;
        seenIds.add(idStr);
        return true;
      });

      const summary = state.summaries[groupId] || { totalCount: 0, unseenCount: 0, hasUnseen: false, latestAt: vibe.createdAt };
      const newUnseenCount = isMine ? summary.unseenCount : summary.unseenCount + 1;

      return {
        groupVibesMap: { ...state.groupVibesMap, [groupId]: dedupedList },
        summaries: {
          ...state.summaries,
          [groupId]: {
            ...summary,
            totalCount: dedupedList.length,
            unseenCount: newUnseenCount,
            hasUnseen: newUnseenCount > 0,
            latestAt: vibe.createdAt,
          },
        },
      };
    });
  },

  handleSocketVibeDeleted: ({ groupId, vibeId }) => {
    if (!groupId || !vibeId) return;

    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const updatedList = currentList.filter((v) => String(v._id) !== String(vibeId));

      const summary = state.summaries[groupId];
      const remainingCount = updatedList.length;
      const newSummary = summary
        ? {
            ...summary,
            totalCount: remainingCount,
            hasUnseen: remainingCount > 0 ? summary.hasUnseen : false,
            unseenCount: remainingCount > 0 ? summary.unseenCount : 0,
          }
        : { totalCount: remainingCount, unseenCount: 0, hasUnseen: false };

      return {
        groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList },
        summaries: { ...state.summaries, [groupId]: newSummary },
      };
    });

    const { activeViewerGroupId, groupVibesMap, activeVibeIndex } = get();
    if (activeViewerGroupId === groupId) {
      const remaining = groupVibesMap[groupId] || [];
      if (remaining.length === 0) {
        get().setViewerOpen(false);
      } else if (activeVibeIndex >= remaining.length) {
        get().setActiveVibeIndex(remaining.length - 1);
      }
    }
  },

  handleSocketVibeViewed: ({ groupId, vibeId, totalViews }) => {
    if (!groupId || !vibeId) return;

    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const updatedList = currentList.map((v) =>
        v._id === vibeId ? { ...v, viewCount: totalViews } : v
      );
      return { groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList } };
    });
  },

  handleSocketVibeReaction: ({ groupId, vibeId, userId, reaction, reactionsSummary }) => {
    if (!groupId || !vibeId) return;

    set((state) => {
      const currentList = state.groupVibesMap[groupId] || [];
      const authUser = useAuthStore.getState().authUser;
      const isMine = String(userId) === String(authUser?._id);

      const updatedList = currentList.map((v) => {
        if (v._id === vibeId) {
          return {
            ...v,
            reactionsSummary,
            ...(isMine ? { myReaction: reaction } : {}),
          };
        }
        return v;
      });

      return { groupVibesMap: { ...state.groupVibesMap, [groupId]: updatedList } };
    });

    if (reaction) {
      const particle = { id: `react_${Date.now()}_${Math.random()}`, emoji: reaction, x: 20 + Math.random() * 60 };
      set((state) => ({ floatingReactions: [...state.floatingReactions, particle] }));
      setTimeout(() => {
        set((state) => ({
          floatingReactions: state.floatingReactions.filter((p) => p.id !== particle.id),
        }));
      }, 1800);
    }
  },
}));
