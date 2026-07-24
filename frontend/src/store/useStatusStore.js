import { create } from "zustand";
import toast from "react-hot-toast";
import {
  uploadStatusApi,
  fetchStatusFeed,
  deleteStatusApi,
  viewStatusApi,
  fetchStatusViewers,
  toggleStatusLikeApi,
  reactToStatusApi,
  commentOnStatusApi,
  deleteStatusCommentApi,
  fetchStatusCommentsApi,
  fetchStatusEngagementApi,
} from "../lib/statusApi";
import { prepareStatusMedia } from "../lib/statusMedia";
import { useAuthStore } from "./useAuthStore";
import { haptic } from "../lib/haptics";
import { emitStoryReactionFx } from "../lib/storyReactionFx";
import { parseStoryMusicApi } from "../lib/storyMusicApi";

function isAudioUrlExpired(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    const expire = u.searchParams.get("expire");
    if (expire) {
      const expireTimeMs = Number(expire) * 1000;
      return Date.now() >= (expireTimeMs - 30000);
    }
  } catch (e) {}
  return false;
}

function sortFeed(feed) {
  return [...feed].sort((a, b) => {
    if (a.isOwn && !b.isOwn) return -1;
    if (!a.isOwn && b.isOwn) return 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return new Date(b.latestAt) - new Date(a.latestAt);
  });
}

function recomputeGroup(group, myId) {
  const isOwn = group.isOwn || group.user?._id === myId;
  return {
    ...group,
    isOwn,
    hasUnseen: !isOwn && group.statuses.some((s) => !s.viewed),
    latestAt:
      group.statuses.reduce((max, s) => {
        const t = new Date(s.createdAt).getTime();
        return t > max ? t : max;
      }, 0) || group.latestAt,
  };
}

let boundSocketId = null;

function ownerViewingStatusId(state) {
  if (!state.isViewerOpen) return null;
  const myId = String(useAuthStore.getState().authUser?._id || "");
  const group = state.viewerGroups[state.viewerGroupIndex];
  if (!group) return null;
  const isOwn = group.isOwn || String(group.user?._id) === myId;
  if (!isOwn) return null;
  const current = group.statuses?.[state.viewerStatusIndex];
  return current?._id ? String(current._id) : null;
}

export const useStatusStore = create((set, get) => ({
  feed: [],
  myStatus: null,
  isFeedLoading: false,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,

  isViewerOpen: false,
  viewerGroups: [],
  viewerGroupIndex: 0,
  viewerStatusIndex: 0,
  viewersList: [],
  likesList: [],
  reactionsList: [],
  commentsList: [],
  isViewersLoading: false,
  showViewersPanel: false,
  insightsTab: "overview", // overview | views | likes | reactions | comments

  isCreateOpen: false,
  reStoryData: null,

  openCreate: () => set({ isCreateOpen: true, reStoryData: null, uploadError: null, uploadProgress: 0 }),
  openReStory: (status) =>
    set({
      isCreateOpen: true,
      reStoryData: {
        originalStatusId: status._id,
        originalUserId: status.userId?._id || status.userId,
        originalUsername: status.userId?.username || status.userId?.fullName || "User",
        originalDisplayName: status.userId?.fullName || "User",
        originalMediaUrl: status.mediaUrl,
        originalMediaType: status.mediaType,
        originalThumbnailUrl: status.thumbnailUrl || status.mediaUrl,
      },
      uploadError: null,
      uploadProgress: 0,
    }),
  closeCreate: () =>
    set({ isCreateOpen: false, reStoryData: null, isUploading: false, uploadProgress: 0, uploadError: null }),

  loadFeed: async (silent = false) => {
    if (!silent) set({ isFeedLoading: true });
    try {
      const data = await fetchStatusFeed();
      set({
        feed: data.feed || [],
        myStatus: data.myStatus || null,
      });
      get().preloadStatusMusic();
    } catch (error) {
      console.error(error);
      if (!silent) toast.error(error.response?.data?.error || "Failed to load statuses");
    } finally {
      if (!silent) set({ isFeedLoading: false });
    }
  },

  preloadStatusMusic: async () => {
    const feed = get().feed || [];
    const myStatus = get().myStatus;
    const all = [];
    if (myStatus?.statuses) all.push(...myStatus.statuses);
    for (const g of feed) {
      if (g.statuses) all.push(...g.statuses);
    }
    const targets = all.filter(s => s?.music?.sourceUrl && (!s.music.audioUrl || isAudioUrlExpired(s.music.audioUrl)));
    if (!targets.length) return;

    for (const status of targets) {
      (async () => {
        try {
          const data = await parseStoryMusicApi(status.music.sourceUrl);
          if (data?.song?.audioUrl) {
            get().patchStatusInFeed(status._id, {
              music: {
                ...status.music,
                audioUrl: data.song.audioUrl,
              },
            });
          }
        } catch (e) {
          console.warn("Failed preloading status music:", e);
        }
      })();
    }
  },

  /** Merge a newly created status into the feed without full refresh */
  applyStatusCreated: ({ status, user, ownerId }) => {
    if (!status?._id) return;
    const myId = useAuthStore.getState().authUser?._id?.toString();
    const oid = (ownerId || user?._id || status.userId?._id || status.userId)?.toString();
    if (!oid) return;

    const isOwn = oid === myId;
    const entry = {
      ...status,
      viewed: isOwn ? true : false,
    };

    set((state) => {
      let feed = [...state.feed];
      const idx = feed.findIndex((g) => g.user?._id?.toString() === oid);

      if (idx === -1) {
        feed.push(
          recomputeGroup(
            {
              user: user || {
                _id: oid,
                fullName: status.userId?.fullName || "User",
                profilePic: status.userId?.profilePic || "",
              },
              isOwn,
              statuses: [entry],
              hasUnseen: !isOwn,
              latestAt: status.createdAt,
            },
            myId
          )
        );
      } else {
        const g = feed[idx];
        if (g.statuses.some((s) => s._id === status._id)) return state;
        feed[idx] = recomputeGroup(
          {
            ...g,
            statuses: [...g.statuses, entry],
          },
          myId
        );
      }

      feed = sortFeed(feed);
      const myStatus = feed.find((g) => g.isOwn) || null;
      return { feed, myStatus };
    });
  },

  applyStatusDeleted: ({ status, ownerId }) => {
    const statusId = status?._id || status;
    const oid = (ownerId || status?.userId?._id || status?.userId)?.toString();
    if (!statusId) return;
    const myId = useAuthStore.getState().authUser?._id?.toString();

    set((state) => {
      let feed = state.feed
        .map((g) => {
          if (oid && g.user?._id?.toString() !== oid) return g;
          return recomputeGroup(
            {
              ...g,
              statuses: g.statuses.filter((s) => s._id !== statusId),
            },
            myId
          );
        })
        .filter((g) => g.statuses.length > 0);

      feed = sortFeed(feed);

      let viewerGroups = state.viewerGroups
        .map((g) => ({
          ...g,
          statuses: g.statuses.filter((s) => s._id !== statusId),
        }))
        .filter((g) => g.statuses.length > 0);

      const closeViewer = viewerGroups.length === 0 && state.isViewerOpen;

      return {
        feed,
        myStatus: feed.find((g) => g.isOwn) || null,
        viewerGroups,
        ...(closeViewer
          ? {
              isViewerOpen: false,
              viewerGroupIndex: 0,
              viewerStatusIndex: 0,
            }
          : {}),
      };
    });
  },

  applyStatusViewed: ({ statusId, viewerCount, viewer }) => {
    if (!statusId) return;
    set((state) => {
      const feed = state.feed.map((g) => ({
        ...g,
        statuses: g.statuses.map((s) =>
          s._id === statusId
            ? { ...s, viewerCount: viewerCount ?? s.viewerCount }
            : s
        ),
      }));

      const viewerGroups = state.viewerGroups.map((g) => ({
        ...g,
        statuses: g.statuses.map((s) =>
          s._id === statusId
            ? { ...s, viewerCount: viewerCount ?? s.viewerCount }
            : s
        ),
      }));

      let viewersList = state.viewersList;
      if (
        state.showViewersPanel &&
        viewer?.user &&
        !viewersList.some((v) => v.user?._id === viewer.user._id)
      ) {
        viewersList = [viewer, ...viewersList];
      }

      return { feed, viewerGroups, viewersList };
    });
  },

  uploadStatus: async ({ file, caption = "", privacy = "contacts", excludedUserIds, includedUserIds, music, mentions, restory }) => {
    if (get().isUploading) {
      toast.error("An upload is already in progress");
      return;
    }
    set({ isUploading: true, uploadProgress: 0, uploadError: null });
    try {
      const prepared = file
        ? await prepareStatusMedia(file)
        : { media: null, thumbnail: null, duration: music?.clipDuration || 15, mediaType: "music" };
      set({ uploadProgress: 5 });

      const data = await uploadStatusApi(
        {
          media: prepared.media,
          thumbnail: prepared.thumbnail,
          duration: prepared.duration,
          caption,
          privacy,
          excludedUserIds,
          includedUserIds,
          music: (music?.audioUrl || music?.title) ? music : undefined,
          mentions,
          restory,
        },
        (p) => set({ uploadProgress: Math.max(5, Math.min(99, p)) })
      );

      // Optimistic local merge (socket will also fire for peers)
      if (data.status) {
        const authUser = useAuthStore.getState().authUser;
        get().applyStatusCreated({
          status: data.status,
          user: {
            _id: authUser._id,
            fullName: authUser.fullName,
            profilePic: authUser.profilePic || "",
          },
          ownerId: authUser._id,
        });
      }

      set({ uploadProgress: 100, isCreateOpen: false });
      haptic("upload");
      toast.success("Status posted");
      return data.status;
    } catch (error) {
      const msg = error.response?.data?.error || error.message || "Upload failed";
      set({ uploadError: msg });
      toast.error(msg);
      throw error;
    } finally {
      set({ isUploading: false });
    }
  },

  deleteStatus: async (statusId) => {
    try {
      await deleteStatusApi(statusId);
      get().applyStatusDeleted({ status: { _id: statusId } });
      toast.success("Status deleted");
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed");
    }
  },

  markViewed: async (statusId) => {
    try {
      await viewStatusApi(statusId);
      set({
        feed: get().feed.map((group) => ({
          ...group,
          statuses: group.statuses.map((s) =>
            s._id === statusId ? { ...s, viewed: true } : s
          ),
          hasUnseen: group.statuses.some(
            (s) => s._id !== statusId && !s.viewed && !group.isOwn
          ),
        })),
        viewerGroups: get().viewerGroups.map((group) => ({
          ...group,
          statuses: group.statuses.map((s) =>
            s._id === statusId ? { ...s, viewed: true } : s
          ),
        })),
      });
      // Recompute hasUnseen cleanly
      const myId = useAuthStore.getState().authUser?._id?.toString();
      set({
        feed: sortFeed(
          get().feed.map((g) => recomputeGroup(g, myId))
        ),
      });
    } catch (error) {
      console.error("markViewed", error);
    }
  },

  openViewer: (groups, groupIndex = 0, statusIndex = 0) => {
    const clean = (groups || []).filter((g) => g.statuses?.length);
    if (!clean.length) return;
    set({
      isViewerOpen: true,
      viewerGroups: clean,
      viewerGroupIndex: Math.min(groupIndex, clean.length - 1),
      viewerStatusIndex: statusIndex,
      showViewersPanel: false,
      viewersList: [],
      likesList: [],
      reactionsList: [],
      commentsList: [],
      insightsTab: "overview",
    });
  },

  openViewerForStatusId: async (statusId) => {
    let feed = get().feed;
    if (!feed || feed.length === 0) {
      await get().loadFeed(true);
      feed = get().feed;
    }
    for (let gIdx = 0; gIdx < feed.length; gIdx++) {
      const g = feed[gIdx];
      const sIdx = g.statuses.findIndex((s) => String(s._id) === String(statusId));
      if (sIdx !== -1) {
        get().openViewer(feed, gIdx, sIdx);
        return;
      }
    }
    toast.error("Story expired or unavailable");
  },

  closeViewer: () =>
    set({
      isViewerOpen: false,
      viewerGroups: [],
      viewerGroupIndex: 0,
      viewerStatusIndex: 0,
      showViewersPanel: false,
      viewersList: [],
      likesList: [],
      reactionsList: [],
      commentsList: [],
      insightsTab: "overview",
    }),

  setViewerIndices: (groupIndex, statusIndex) =>
    set({ viewerGroupIndex: groupIndex, viewerStatusIndex: statusIndex }),

  openViewersPanel: async (statusId, tab = "overview") => {
    set({ isViewersLoading: true, showViewersPanel: true, insightsTab: tab });
    try {
      const [viewersRes, engagementRes, commentsRes] = await Promise.all([
        fetchStatusViewers(statusId),
        fetchStatusEngagementApi(statusId).catch(() => ({
          likes: [],
          reactions: [],
        })),
        fetchStatusCommentsApi(statusId).catch(() => ({ comments: [] })),
      ]);
      set({
        viewersList: viewersRes.viewers || [],
        likesList: (engagementRes.likes || []).sort(
          (a, b) => new Date(b.likedAt) - new Date(a.likedAt)
        ),
        reactionsList: (engagementRes.reactions || []).sort(
          (a, b) => new Date(b.reactedAt) - new Date(a.reactedAt)
        ),
        commentsList: (commentsRes.comments || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        ),
      });
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not load insights");
      set({ showViewersPanel: false });
    } finally {
      set({ isViewersLoading: false });
    }
  },

  closeViewersPanel: () =>
    set({
      showViewersPanel: false,
      viewersList: [],
      likesList: [],
      reactionsList: [],
      commentsList: [],
      insightsTab: "overview",
    }),

  setInsightsTab: (tab) => set({ insightsTab: tab }),

  patchStatusInFeed: (statusId, patch) => {
    const id = String(statusId);
    const mapStatuses = (statuses) =>
      statuses.map((s) => {
        if (String(s._id) !== id) return s;
        const { status: nested, ...rest } = patch || {};
        return { ...s, ...rest, ...(nested && typeof nested === "object" ? nested : {}) };
      });
    set((state) => ({
      feed: state.feed.map((g) => ({ ...g, statuses: mapStatuses(g.statuses) })),
      viewerGroups: state.viewerGroups.map((g) => ({
        ...g,
        statuses: mapStatuses(g.statuses),
      })),
    }));
  },

  toggleLike: async (statusId) => {
    const id = String(statusId);
    // Optimistic update so the UI feels instant
    const current = get()
      .viewerGroups.flatMap((g) => g.statuses)
      .find((s) => String(s._id) === id);
    const nextLiked = !(current?.likedByMe);
    const prevCount = current?.likeCount || 0;
    get().patchStatusInFeed(id, {
      likedByMe: nextLiked,
      likeCount: Math.max(0, prevCount + (nextLiked ? 1 : -1)),
    });

    try {
      haptic("storyLike");
      const data = await toggleStatusLikeApi(id);
      get().patchStatusInFeed(id, {
        likedByMe: data.liked,
        likeCount: data.likeCount,
        ...(data.status || {}),
      });
      return data;
    } catch (error) {
      // Roll back optimistic change
      get().patchStatusInFeed(id, {
        likedByMe: current?.likedByMe || false,
        likeCount: prevCount,
      });
      toast.error(error.response?.data?.error || "Could not like");
    }
  },

  reactToStatus: async (statusId, emoji) => {
    const id = String(statusId);
    try {
      haptic("react");
      const data = await reactToStatusApi(id, emoji);
      get().patchStatusInFeed(id, {
        myReaction: data.myReaction,
        ...(data.status || {}),
      });
      return data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not react");
    }
  },

  loadComments: async (statusId) => {
    try {
      const data = await fetchStatusCommentsApi(statusId);
      return data.comments || [];
    } catch {
      return [];
    }
  },

  addComment: async (statusId, text, replyTo) => {
    try {
      haptic("send");
      const data = await commentOnStatusApi(statusId, { text, replyTo });
      get().patchStatusInFeed(statusId, {
        commentCount: data.commentCount,
      });
      return data.comment;
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not comment");
      return null;
    }
  },

  removeComment: async (statusId, commentId) => {
    try {
      haptic("delete");
      const data = await deleteStatusCommentApi(statusId, commentId);
      get().patchStatusInFeed(statusId, { commentCount: data.commentCount });
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not delete comment");
      return false;
    }
  },

  /** Bind socket listeners once per socket instance for live status updates */
  subscribeToStatusEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    if (boundSocketId === socket.id && socket.connected) return;

    if (boundSocketId && socket.id !== boundSocketId) {
      socket.off("status:created");
      socket.off("status:deleted");
      socket.off("status:viewed");
      socket.off("status:liked");
      socket.off("status:reacted");
      socket.off("status:commented");
      socket.off("status:commentDeleted");
    }

    const onCreated = (payload) => get().applyStatusCreated(payload);
    const onDeleted = (payload) => get().applyStatusDeleted(payload);
    const onViewed = (payload) => get().applyStatusViewed(payload);
    const onLiked = (payload) => {
      const id = payload?.statusId || payload?.status?._id;
      if (!id) return;
      const myId = String(useAuthStore.getState().authUser?._id || "");
      const sid = String(id);
      get().patchStatusInFeed(sid, {
        likeCount: payload.likeCount ?? payload.status?.likeCount,
        ...(String(payload.userId) === myId ? { likedByMe: !!payload.liked } : {}),
        ...(payload.status || {}),
      });

      const viewingId = ownerViewingStatusId(get());
      if (viewingId === sid) {
        if (payload.liked) {
          emitStoryReactionFx({ statusId: sid, type: "like", userId: payload.userId });
        }
        if (get().showViewersPanel) {
          const uid = String(payload.userId || "");
          set((state) => {
            let likesList = state.likesList;
            if (payload.liked && payload.liker?.user) {
              likesList = [
                { user: payload.liker.user, likedAt: payload.liker.likedAt || new Date() },
                ...likesList.filter((l) => String(l.user._id) !== uid),
              ];
            } else if (!payload.liked) {
              likesList = likesList.filter((l) => String(l.user._id) !== uid);
            }
            return { likesList };
          });
        }
      }
    };
    const onReacted = (payload) => {
      const id = payload.status?._id || payload.statusId;
      if (!id) return;
      const myId = String(useAuthStore.getState().authUser?._id || "");
      const sid = String(id);
      get().patchStatusInFeed(sid, {
        ...(payload.status || {}),
        ...(String(payload.userId) === myId ? { myReaction: payload.myReaction } : {}),
      });

      const viewingId = ownerViewingStatusId(get());
      if (viewingId === sid && payload.myReaction) {
        emitStoryReactionFx({
          statusId: sid,
          type: "react",
          emoji: payload.myReaction,
          userId: payload.userId,
        });
      }
      if (viewingId === sid && get().showViewersPanel && payload.reactor?.user) {
        const uid = String(payload.userId || "");
        set((state) => {
          let reactionsList = state.reactionsList.filter(
            (r) => String(r.user._id) !== uid
          );
          if (payload.myReaction) {
            reactionsList = [
              {
                user: payload.reactor.user,
                emoji: payload.myReaction,
                reactedAt: payload.reactor.reactedAt || new Date(),
              },
              ...reactionsList,
            ].sort((a, b) => new Date(b.reactedAt) - new Date(a.reactedAt));
          }
          return { reactionsList };
        });
      }
    };
    const onCommented = (payload) => {
      if (payload?.statusId) {
        get().patchStatusInFeed(payload.statusId, {
          commentCount: payload.commentCount,
        });
      }
    };

    socket.off("status:created");
    socket.off("status:deleted");
    socket.off("status:viewed");
    socket.off("status:liked");
    socket.off("status:reacted");
    socket.off("status:commented");
    socket.on("status:created", onCreated);
    socket.on("status:deleted", onDeleted);
    socket.on("status:viewed", onViewed);
    socket.on("status:liked", onLiked);
    socket.on("status:reacted", onReacted);
    socket.on("status:commented", onCommented);
    boundSocketId = socket.id || "pending";

    socket.once?.("connect", () => {
      boundSocketId = socket.id;
    });
  },

  unsubscribeFromStatusEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("status:created");
    socket.off("status:deleted");
    socket.off("status:viewed");
    socket.off("status:liked");
    socket.off("status:reacted");
    socket.off("status:commented");
    socket.off("status:commentDeleted");
    boundSocketId = null;
  },

  reset: () => {
    get().unsubscribeFromStatusEvents();
    set({
      feed: [],
      myStatus: null,
      isFeedLoading: false,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      isViewerOpen: false,
      viewerGroups: [],
      viewerGroupIndex: 0,
      viewerStatusIndex: 0,
      viewersList: [],
      likesList: [],
      reactionsList: [],
      commentsList: [],
      isViewersLoading: false,
      showViewersPanel: false,
      insightsTab: "overview",
      isCreateOpen: false,
    });
  },
}));
