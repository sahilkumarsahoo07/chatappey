import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import {
  showBrowserNotification,
  playNotificationSound,
  showInAppNotification,
  shouldShowSystemNotification,
  isActivelyViewingConversation,
} from "../lib/notifications";
import {
  hydrateThread,
  writeThread,
  writeMemoryThread,
  readMemoryThread,
  mergeMessages,
  removeThread,
} from "../lib/messageCache";
import { upsertMessage, applyServerAck, nextClientSeq, withServerOrdering } from "../lib/messageSync";
import {
  applyOptimisticDeleteForEveryone,
  deletedSidebarPreview,
  DELETED_TEXT_EVERYONE,
} from "../lib/messageDelete";
import { makeClientMessageId, messageMatchesIds } from "../lib/messageStatus";

const PAGE_SIZE = 40;

const sameGroupId = (a, b) => a != null && b != null && String(a) === String(b);

const persistGroupThread = (groupId, messages, meta = {}) => {
  if (!groupId || !messages?.length) return;
  const payload = {
    messages,
    hasMoreOlder: meta.hasMoreOlder ?? false,
    oldestCachedAt: messages[0]?.createdAt,
    newestAt: messages[messages.length - 1]?.createdAt,
    syncedAt: Date.now(),
  };
  writeMemoryThread("group", groupId, payload);
  writeThread("group", groupId, payload).catch(() => {});
};

const parseMessagesResponse = (data) => {
  if (Array.isArray(data)) {
    return {
      messages: data,
      hasMore: false,
      oldestCursor: data[0]?.createdAt || null,
      newestCursor: data[data.length - 1]?.createdAt || null,
    };
  }
  return {
    messages: data?.messages || [],
    hasMore: Boolean(data?.hasMore),
    oldestCursor: data?.oldestCursor || null,
    newestCursor: data?.newestCursor || null,
  };
};

export const useGroupStore = create((set, get) => ({
    groups: [],
    selectedGroup: null,
    groupMessages: [],
    groupMessagesMeta: { hasMoreOlder: false, isSyncing: false, oldestCursor: null, newestCursor: null },
    isLoadingOlderGroup: false,
    isGroupsLoading: false,
    isGroupMessagesLoading: false,
    typingUsers: [], // Array of {userId, userName} objects for group typing
    _isSubscribedToGroupEvents: false,

    // Get all groups for current user
    getGroups: async () => {
        set({ isGroupsLoading: true });
        try {
            const res = await axiosInstance.get("/groups");
            set({ groups: res.data });
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to load groups");
        } finally {
            set({ isGroupsLoading: false });
        }
    },

    // Create a new group
    createGroup: async (groupData) => {
        try {
            const res = await axiosInstance.post("/groups/create", groupData);
            const newGroup = res.data;
            set({ groups: [newGroup, ...get().groups] });
            toast.success("Group created successfully!");
            return newGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to create group");
            throw error;
        }
    },

    // Get group details
    getGroupDetails: async (groupId) => {
        try {
            const res = await axiosInstance.get(`/groups/${groupId}`);
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to load group details");
            throw error;
        }
    },

    // Update group
    updateGroup: async (groupId, updateData) => {
        try {
            const res = await axiosInstance.put(`/groups/${groupId}`, updateData);
            const updatedGroup = res.data;
            set({
                groups: get().groups.map(g => g._id === groupId ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === groupId ? updatedGroup : get().selectedGroup
            });
            toast.success("Group updated successfully!");
            return updatedGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to update group");
            throw error;
        }
    },

    // Delete group
    deleteGroup: async (groupId) => {
        try {
            await axiosInstance.delete(`/groups/${groupId}`);
            set({
                groups: get().groups.filter(g => g._id !== groupId),
                selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup
            });
            toast.success("Group deleted successfully!");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to delete group");
            throw error;
        }
    },

    // Add members to group
    addMembers: async (groupId, memberIds) => {
        try {
            const res = await axiosInstance.post(`/groups/${groupId}/members`, { memberIds });
            const updatedGroup = res.data;
            set({
                groups: get().groups.map(g => g._id === groupId ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === groupId ? updatedGroup : get().selectedGroup
            });
            toast.success("Members added successfully!");
            return updatedGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to add members");
            throw error;
        }
    },

    // Remove member from group
    removeMember: async (groupId, userId) => {
        try {
            const res = await axiosInstance.delete(`/groups/${groupId}/members/${userId}`);
            const updatedGroup = res.data;
            set({
                groups: get().groups.map(g => g._id === groupId ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === groupId ? updatedGroup : get().selectedGroup
            });
            toast.success("Member removed successfully!");
            return updatedGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to remove member");
            throw error;
        }
    },

    // Leave group
    leaveGroup: async (groupId) => {
        try {
            await axiosInstance.post(`/groups/${groupId}/leave`);
            set({
                groups: get().groups.filter(g => g._id !== groupId),
                selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup
            });
            toast.success("Left group successfully!");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to leave group");
            throw error;
        }
    },

    // Update member role (admin only)
    updateMemberRole: async (groupId, userId, role) => {
        try {
            const res = await axiosInstance.put(`/groups/${groupId}/members/${userId}/role`, { role });
            const updatedGroup = res.data;
            set({
                groups: get().groups.map(g => g._id === groupId ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === groupId ? updatedGroup : get().selectedGroup
            });
            toast.success(`Member role updated to ${role}!`);
            return updatedGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to update member role");
            throw error;
        }
    },

    // Pin a message
    pinMessage: async (groupId, messageId) => {
        try {
            const res = await axiosInstance.post(`/groups/${groupId}/pin/${messageId}`);
            const updatedGroup = res.data;
            set({
                groups: get().groups.map(g => g._id === groupId ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === groupId ? updatedGroup : get().selectedGroup
            });
            toast.success("Message pinned!");
            return updatedGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to pin message");
            throw error;
        }
    },

    // Unpin message
    unpinMessage: async (groupId) => {
        try {
            const res = await axiosInstance.post(`/groups/${groupId}/unpin`);
            const updatedGroup = res.data;
            set({
                groups: get().groups.map(g => g._id === groupId ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === groupId ? updatedGroup : get().selectedGroup
            });
            toast.success("Message unpinned!");
            return updatedGroup;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to unpin message");
            throw error;
        }
    },

    // Get group messages
    getGroupMessages: async (groupId, options = {}) => {
        if (!groupId) return;

        const { before, after, background = false } = options;
        const isInitial = !before && !after;
        const isOlder = Boolean(before);
        const isDelta = Boolean(after);
        const requestGroupId = String(groupId);

        if (isInitial && !background) {
            const hydrated = await hydrateThread("group", groupId);
            if (hydrated?.messages?.length) {
                // Ignore if user switched groups while hydrating
                if (!sameGroupId(get().selectedGroup?._id, requestGroupId)) return;
                set({
                    groupMessages: hydrated.messages,
                    groupMessagesMeta: {
                        hasMoreOlder: hydrated.hasMoreOlder ?? true,
                        isSyncing: true,
                        oldestCursor: hydrated.oldestCachedAt || hydrated.messages[0]?.createdAt,
                        newestCursor: hydrated.newestAt || hydrated.messages[hydrated.messages.length - 1]?.createdAt,
                    },
                    isGroupMessagesLoading: false,
                });
                const newest =
                    hydrated.newestAt ||
                    hydrated.messages[hydrated.messages.length - 1]?.createdAt;
                if (newest) {
                    await get().getGroupMessages(groupId, { after: newest, background: true });
                }
                get().markGroupMessagesAsRead(groupId);
                return;
            }
            if (!get().groupMessages.length) {
                set({ isGroupMessagesLoading: true });
            }
        }

        if (isOlder) set({ isLoadingOlderGroup: true });

        try {
            const params = { limit: PAGE_SIZE };
            if (before) params.before = before;
            if (after) params.after = after;

            const res = await axiosInstance.get(`/groups/${groupId}/messages`, { params });

            // Stale response — user already opened another group
            if (!sameGroupId(get().selectedGroup?._id, requestGroupId)) {
                set({ isGroupMessagesLoading: false, isLoadingOlderGroup: false });
                return;
            }

            const { messages: incoming, hasMore, oldestCursor, newestCursor } =
                parseMessagesResponse(res.data);

            let nextMessages;
            if (isOlder || isDelta) {
                nextMessages = mergeMessages(get().groupMessages, incoming);
            } else {
                nextMessages = incoming;
            }

            const prevMeta = get().groupMessagesMeta || {};
            let hasMoreOlder = prevMeta.hasMoreOlder ?? true;
            if (isOlder || isInitial) {
                hasMoreOlder = Boolean(hasMore);
            }

            const meta = {
                hasMoreOlder,
                isSyncing: false,
                oldestCursor:
                    nextMessages[0]?.createdAt || oldestCursor || prevMeta.oldestCursor || null,
                newestCursor:
                    nextMessages[nextMessages.length - 1]?.createdAt ||
                    newestCursor ||
                    prevMeta.newestCursor ||
                    null,
            };

            set({
                groupMessages: nextMessages,
                groupMessagesMeta: meta,
                isGroupMessagesLoading: false,
                isLoadingOlderGroup: false,
            });

            persistGroupThread(groupId, nextMessages, { hasMoreOlder });

            // Delta sync can return only one page — keep fetching until caught up
            if (isDelta && hasMore && incoming.length > 0) {
                const newest =
                    nextMessages[nextMessages.length - 1]?.createdAt || newestCursor;
                if (newest) {
                    await get().getGroupMessages(groupId, { after: newest, background: true });
                    return;
                }
            }

            if (isInitial && !background) {
                get().markGroupMessagesAsRead(groupId);
            }
        } catch (error) {
            if (!sameGroupId(get().selectedGroup?._id, requestGroupId)) {
                set({ isGroupMessagesLoading: false, isLoadingOlderGroup: false });
                return;
            }
            set({
                isGroupMessagesLoading: false,
                isLoadingOlderGroup: false,
                groupMessagesMeta: { ...get().groupMessagesMeta, isSyncing: false },
            });
            if (!background && get().groupMessages.length === 0) {
                toast.error(error.response?.data?.error || "Failed to load messages");
            }
        }
    },

    loadOlderGroupMessages: async () => {
        const { selectedGroup, groupMessages, groupMessagesMeta, isLoadingOlderGroup } = get();
        if (!selectedGroup || isLoadingOlderGroup || !groupMessagesMeta?.hasMoreOlder) return;
        // Use chronological oldest (store may be unsorted after appends)
        const oldest =
            [...groupMessages].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )[0]?.createdAt || groupMessagesMeta.oldestCursor;
        if (!oldest) return;
        await get().getGroupMessages(selectedGroup._id, { before: oldest, background: true });
    },

    // Send message to group (optionally to a different group for forwarding)
    sendGroupMessage: async (messageData, targetGroupId = null) => {
        const { selectedGroup, groups } = get();
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;

        const groupId = targetGroupId || selectedGroup?._id;
        if (!groupId) return;

        // Only add optimistic message if sending to currently selected group
        const isForwarding = targetGroupId && !sameGroupId(targetGroupId, selectedGroup?._id);
        const clientMessageId = makeClientMessageId();
        const clientSeq = nextClientSeq();
        const clientCreatedAt = new Date().toISOString();

        // Create optimistic message — pending sorts after all confirmed
        const optimisticMessage = {
            _id: clientMessageId,
            optimisticId: clientMessageId,
            clientMessageId,
            clientSeq,
            clientCreatedAt,
            groupId: groupId,
            senderId: {
                _id: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic
            },
            text: messageData.text,
            image: messageData.image,
            audio: messageData.audio,
            video: messageData.video,
            videoThumbnail: messageData.videoThumbnail,
            videoDuration: messageData.videoDuration,
            file: messageData.file,
            fileName: messageData.fileName,
            replyTo: messageData.replyTo || null,
            replyToMessage: messageData.replyToMessage || null,
            mentions: messageData.mentions || [],
            poll: messageData.poll,
            createdAt: clientCreatedAt,
            serverCreatedAt: null,
            readBy: [authUser._id],
            isForwarded: messageData.isForwarded || false,
            isOptimistic: true,
            pending: true,
        };

        const applyOptimistic = () => {
            if (isForwarding) return;
            const next = upsertMessage(get().groupMessages, optimisticMessage);
            set({ groupMessages: next });
            persistGroupThread(groupId, next, get().groupMessagesMeta);
        };

        const replaceWithServerMessage = (newMessage) => {
            if (isForwarding) return;
            if (!sameGroupId(get().selectedGroup?._id, groupId)) return;
            const next = applyServerAck(
                get().groupMessages,
                clientMessageId,
                newMessage
            );
            set({ groupMessages: next });
            persistGroupThread(groupId, next, get().groupMessagesMeta);
        };

        const removeOptimistic = () => {
            if (isForwarding) return;
            set({
                groupMessages: get().groupMessages.filter(
                    (msg) => !messageMatchesIds(msg, { clientMessageId })
                ),
            });
        };

        const updateSidebar = (newMessage) => {
            set({
                groups: get()
                    .groups.map((g) => {
                        if (!sameGroupId(g._id, groupId)) return g;
                        return {
                            ...g,
                            lastMessage: {
                                text:
                                    newMessage.text ||
                                    (newMessage.image
                                        ? "📷 Photo"
                                        : newMessage.video
                                          ? "🎬 Video"
                                          : "📷 Photo"),
                                senderId: authUser._id,
                                senderName: authUser.fullName,
                                createdAt: newMessage.createdAt,
                            },
                            updatedAt: newMessage.createdAt,
                        };
                    })
                    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
            });
        };

        applyOptimistic();

        const sendViaHttp = async () => {
            const res = await axiosInstance.post(`/groups/${groupId}/messages`, {
                ...messageData,
                clientMessageId,
            });
            replaceWithServerMessage(res.data);
            updateSidebar(res.data);
            return res.data;
        };

        // Prefer socket; fall back to HTTP if disconnected
        if (socket?.connected) {
            try {
                socket.emit(
                    "sendGroupMessage",
                    {
                        groupId,
                        ...messageData,
                        clientMessageId,
                    },
                    async (response) => {
                        if (response?.error) {
                            try {
                                await sendViaHttp();
                            } catch (err) {
                                removeOptimistic();
                                toast.error(response.error || "Failed to send message");
                            }
                            return;
                        }
                        if (response?.message) {
                            replaceWithServerMessage(response.message);
                            updateSidebar(response.message);
                        }
                    }
                );
                return;
            } catch (error) {
                /* fall through to HTTP */
            }
        }

        try {
            await sendViaHttp();
        } catch (error) {
            removeOptimistic();
            toast.error(error.response?.data?.error || error.message || "Failed to send message");
            throw error;
        }
    },

    // Mark group messages as read
    markGroupMessagesAsRead: async (groupId) => {
        try {
            await axiosInstance.put(`/groups/${groupId}/messages/read`);

            const authUser = useAuthStore.getState().authUser;
            // Optimistically stamp me into readBy so Message Info is accurate on this device
            if (authUser && sameGroupId(get().selectedGroup?._id, groupId)) {
                const myId = String(authUser._id);
                set({
                    groupMessages: get().groupMessages.map((msg) => {
                        const senderId = msg.senderId?._id || msg.senderId;
                        if (String(senderId) === myId) return msg;
                        const readers = msg.readBy || [];
                        const already = readers.some(
                            (r) => String(r?._id || r) === myId
                        );
                        if (already) return msg;
                        return {
                            ...msg,
                            readBy: [
                                ...readers,
                                {
                                    _id: authUser._id,
                                    fullName: authUser.fullName,
                                    profilePic: authUser.profilePic,
                                },
                            ],
                        };
                    }),
                });
            }

            // Clear unread count locally for immediate UI feedback
            set({
                groups: get().groups.map(g =>
                    sameGroupId(g._id, groupId) ? { ...g, unreadCount: 0 } : g
                )
            });
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    },

    // Delete group message for everyone
    deleteGroupMessageForAll: async (groupId, messageId) => {
        const authUser = useAuthStore.getState().authUser;
        const { groupMessages, groups } = get();
        const prevMessages = groupMessages;
        const prevGroups = groups;
        const target = groupMessages.find((m) => String(m._id) === String(messageId));
        const optimistic = applyOptimisticDeleteForEveryone(target || { _id: messageId }, authUser?._id);
        const isLatest =
            groupMessages.length > 0 &&
            String(groupMessages[groupMessages.length - 1]._id) === String(messageId);

        set({
            groupMessages: groupMessages.map((msg) =>
                String(msg._id) === String(messageId) ? { ...msg, ...optimistic } : msg
            ),
            groups: groups.map((g) => {
                if (String(g._id) !== String(groupId)) return g;
                const lm = g.lastMessage;
                if (!lm) return g;
                const matches = (lm._id && String(lm._id) === String(messageId)) || isLatest;
                if (!matches) return g;
                return {
                    ...g,
                    lastMessage: {
                        ...lm,
                        _id: messageId,
                        ...deletedSidebarPreview,
                    },
                };
            }),
        });

        try {
            await axiosInstance.delete(`/groups/${groupId}/messages/${messageId}/all`);
            toast.success("Message deleted for everyone");
        } catch (error) {
            set({ groupMessages: prevMessages, groups: prevGroups });
            toast.error(error.response?.data?.error || "Failed to delete message");
            throw error;
        }
    },

    // Delete group message for me only
    deleteGroupMessageForMe: async (groupId, messageId) => {
        const { groupMessages, groups } = get();
        const prevMessages = groupMessages;
        const prevGroups = groups;
        const remaining = groupMessages.filter((msg) => String(msg._id) !== String(messageId));
        const last = remaining[remaining.length - 1];

        set({
            groupMessages: remaining,
            groups: groups.map((g) => {
                if (String(g._id) !== String(groupId)) return g;
                const lm = g.lastMessage;
                if (!lm) return g;
                if (lm._id && String(lm._id) !== String(messageId)) return g;
                return {
                    ...g,
                    lastMessage: last
                        ? {
                            _id: last._id,
                            text: last.deletedForEveryone ? DELETED_TEXT_EVERYONE : last.text,
                            senderId: last.senderId,
                            senderName: last.senderId?.fullName,
                            createdAt: last.createdAt,
                        }
                        : null,
                };
            }),
        });

        try {
            await axiosInstance.delete(`/groups/${groupId}/messages/${messageId}/me`);
            toast.success("Message deleted for you");
        } catch (error) {
            set({ groupMessages: prevMessages, groups: prevGroups });
            toast.error(error.response?.data?.error || "Failed to delete message");
            throw error;
        }
    },

    // Subscribe to group socket events
    subscribeToGroupEvents: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        if (get()._isSubscribedToGroupEvents) return;
        set({ _isSubscribedToGroupEvents: true });

        // New group created (for other members when they're added)
        socket.on("group:created", (newGroup) => {
            const { groups } = get();
            const authUser = useAuthStore.getState().authUser;
            if (!authUser) return;

            // Only add if not already in the list
            const exists = groups.some(g => g._id === newGroup._id);
            if (!exists) {
                // Find joinedAt for current user
                const memberInfo = newGroup.members.find(m =>
                    (m.user?._id || m.user || m).toString() === authUser._id.toString()
                );
                const joinedAt = memberInfo?.joinedAt ? new Date(memberInfo.joinedAt) : new Date(0);

                const filteredGroup = {
                    ...newGroup,
                    lastMessage: (newGroup.lastMessage?.createdAt && new Date(newGroup.lastMessage.createdAt) >= joinedAt)
                        ? newGroup.lastMessage
                        : null,
                    unreadCount: 0
                };
                set({ groups: [filteredGroup, ...groups] });
            }
        });

        // Group updated
        socket.on("group:updated", (updatedGroup) => {
            set({
                groups: get().groups.map(g => g._id === updatedGroup._id ? updatedGroup : g),
                selectedGroup: get().selectedGroup?._id === updatedGroup._id ? updatedGroup : get().selectedGroup
            });
        });

        // Group deleted
        socket.on("group:deleted", ({ groupId }) => {
            set({
                groups: get().groups.filter(g => g._id !== groupId),
                selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup
            });
        });

        // New member added
        socket.on("group:memberAdded", ({ group }) => {
            const { groups, selectedGroup } = get();
            const authUser = useAuthStore.getState().authUser;
            if (!authUser) return;

            const exists = groups.some(g => g._id === group._id);

            // Check if WE are the one who was added, or if we were already there
            const memberInfo = group.members.find(m =>
                (m.user?._id || m.user || m).toString() === authUser._id.toString()
            );

            // If we are not in the group, ignore (shouldn't happen as we receive the event)
            if (!memberInfo) return;

            // Apply joinedAt filtering to lastMessage for real-time consistency
            const joinedAt = memberInfo?.joinedAt ? new Date(memberInfo.joinedAt) : new Date(0);
            const filteredGroup = {
                ...group,
                lastMessage: (group.lastMessage?.createdAt && new Date(group.lastMessage.createdAt) >= joinedAt)
                    ? group.lastMessage
                    : null,
                unreadCount: exists ? (groups.find(g => g._id === group._id).unreadCount || 0) : 0
            };

            if (exists) {
                set({
                    groups: groups.map(g => g._id === group._id ? filteredGroup : g),
                    selectedGroup: selectedGroup?._id === group._id ? filteredGroup : selectedGroup
                });
            } else {
                // If the user was just added, they need the group in their list
                set({
                    groups: [filteredGroup, ...groups]
                });
            }
        });

        // Member removed
        socket.on("group:memberRemoved", ({ group }) => {
            set({
                groups: get().groups.map(g => g._id === group._id ? group : g),
                selectedGroup: get().selectedGroup?._id === group._id ? group : get().selectedGroup
            });
        });

        // Removed from group
        socket.on("group:removed", ({ groupId }) => {
            set({
                groups: get().groups.filter(g => g._id !== groupId),
                selectedGroup: get().selectedGroup?._id === groupId ? null : get().selectedGroup,
                groupMessages: get().selectedGroup?._id === groupId ? [] : get().groupMessages
            });
            toast.info("You have been removed from a group");
        });

        // Member left
        socket.on("group:memberLeft", ({ group }) => {
            set({
                groups: get().groups.map(g => g._id === group._id ? group : g),
                selectedGroup: get().selectedGroup?._id === group._id ? group : get().selectedGroup
            });
        });

        // New message in group
        socket.on("group:newMessage", ({ groupId, message }) => {
            const authUser = useAuthStore.getState().authUser;
            const { selectedGroup, groupMessages, groups } = get();

            // Check if this is a message from another user
            const senderIdStr =
              typeof message.senderId === "object"
                ? message.senderId?._id
                : message.senderId;
            const isFromOther =
              senderIdStr && String(senderIdStr) !== String(authUser._id);
            const isSystem = message.messageType === "system";

            // If this is in the currently selected group, upsert (identity-aware — no dups / flicker)
            if (sameGroupId(selectedGroup?._id, groupId)) {
                const next = upsertMessage(
                    groupMessages,
                    withServerOrdering(message)
                );
                set({ groupMessages: next });
                persistGroupThread(groupId, next, get().groupMessagesMeta);
            }

            // WhatsApp: notify only when NOT actively viewing this group
            const viewingThisGroup = isActivelyViewingConversation(
              groupId,
              selectedGroup?._id
            );

            if (isFromOther && !isSystem) {
                if (viewingThisGroup) {
                    get().markGroupMessagesAsRead(groupId);
                } else {
                    const group = groups.find((g) => String(g._id) === String(groupId)) || selectedGroup;
                    if (!group?.isMuted) {
                        playNotificationSound();

                        const body = `${message.senderId?.fullName || "Someone"}: ${message.text || "📷 Photo"}`;
                        const g = group || { name: "New Group Message" };

                        if (shouldShowSystemNotification()) {
                            showBrowserNotification(g.name || "New Group Message", {
                                body,
                                icon: "/avatar.png",
                                tag: `group-${groupId}`,
                                requireInteraction: false,
                                silent: false,
                                url: `/?group=${groupId}`,
                                groupId: String(groupId),
                                group: {
                                    _id: String(g._id || groupId),
                                    name: g.name,
                                    image: g.image,
                                    members: g.members,
                                },
                            });
                        } else {
                            showInAppNotification(
                                { text: body },
                                { fullName: g.name, profilePic: g.image || "/avatar.png" },
                                () => {
                                    import("../lib/openFromNotification.js").then(({ openConversationFromNotification }) => {
                                        openConversationFromNotification({
                                            groupId: String(groupId),
                                            group: {
                                                _id: String(g._id || groupId),
                                                name: g.name,
                                                image: g.image,
                                                members: g.members,
                                            },
                                        });
                                    });
                                }
                            );
                        }
                    }
                }
            }

            // Update group's lastMessage and unread count in the list
            set({
                groups: groups.map((g) => {
                    if (String(g._id) !== String(groupId)) return g;

                    const shouldIncrementUnread =
                        isFromOther && !isSystem && !viewingThisGroup;

                    return {
                        ...g,
                        lastMessage: {
                            text: message.text || "📷 Photo",
                            senderId: message.senderId?._id || null,
                            senderName:
                                message.senderId?.fullName ||
                                (isSystem ? "System" : "Unknown"),
                            createdAt: message.createdAt,
                        },
                        updatedAt: message.createdAt,
                        unreadCount: viewingThisGroup
                            ? 0
                            : shouldIncrementUnread
                              ? (g.unreadCount || 0) + 1
                              : g.unreadCount,
                    };
                }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
            });
        });

        // Message deleted in group
        socket.on("group:messageDeleted", ({ groupId, messageId, deletedForAll, updatedMessage }) => {
            const { selectedGroup, groupMessages, groups } = get();
            const open = selectedGroup && String(selectedGroup._id) === String(groupId);

            if (deletedForAll) {
                const patch = updatedMessage || {
                    ...applyOptimisticDeleteForEveryone({ _id: messageId }, null),
                    text: DELETED_TEXT_EVERYONE,
                };
                const isLatest =
                    open &&
                    groupMessages.length > 0 &&
                    String(groupMessages[groupMessages.length - 1]._id) === String(messageId);

                set({
                    groupMessages: open
                        ? groupMessages.map((msg) =>
                            String(msg._id) === String(messageId) ? { ...msg, ...patch } : msg
                          )
                        : groupMessages,
                    groups: groups.map((g) => {
                        if (String(g._id) !== String(groupId)) return g;
                        const lm = g.lastMessage;
                        if (!lm) return g;
                        const matches =
                            (lm._id && String(lm._id) === String(messageId)) || isLatest;
                        if (!matches) return g;
                        return {
                            ...g,
                            lastMessage: {
                                ...lm,
                                _id: messageId,
                                ...deletedSidebarPreview,
                            },
                        };
                    }),
                });
                return;
            }

            // Delete for me (this device / multi-device sync)
            if (open) {
                set({
                    groupMessages: groupMessages.filter(
                        (msg) => String(msg._id) !== String(messageId)
                    ),
                });
            }
        });

        // Someone read group messages — update Message Info live
        socket.on("group:messagesRead", ({ groupId, messageIds, readBy, readAt }) => {
            if (!sameGroupId(get().selectedGroup?._id, groupId) || !readBy) return;
            const readerId = String(readBy._id || readBy);
            const idSet = messageIds?.length
                ? new Set(messageIds.map(String))
                : null;

            set({
                groupMessages: get().groupMessages.map((msg) => {
                    if (idSet && !idSet.has(String(msg._id)) && !idSet.has(String(msg.realId))) {
                        return msg;
                    }
                    const senderId = String(msg.senderId?._id || msg.senderId || "");
                    if (senderId === readerId) return msg;

                    const readers = msg.readBy || [];
                    const already = readers.some((r) => String(r?._id || r) === readerId);
                    if (already) {
                        // Upgrade bare ids to populated reader objects
                        return {
                            ...msg,
                            readBy: readers.map((r) =>
                                String(r?._id || r) === readerId
                                    ? {
                                        _id: readBy._id || readBy,
                                        fullName: readBy.fullName,
                                        profilePic: readBy.profilePic,
                                        readAt: readAt || r.readAt,
                                      }
                                    : r
                            ),
                        };
                    }
                    return {
                        ...msg,
                        readBy: [
                            ...readers,
                            {
                                _id: readBy._id || readBy,
                                fullName: readBy.fullName,
                                profilePic: readBy.profilePic,
                                readAt,
                            },
                        ],
                    };
                }),
            });
        });

        // Poll updated in group
        socket.on("group:pollUpdated", ({ groupId, messageId, poll }) => {
            const { selectedGroup, groupMessages } = get();

            if (selectedGroup?._id === groupId) {
                set({
                    groupMessages: groupMessages.map(msg =>
                        msg._id === messageId ? { ...msg, poll } : msg
                    )
                });
            }
        });

        // Group typing indicators
        socket.on("group:typing", ({ groupId, userId, userName }) => {
            const { selectedGroup, typingUsers } = get();
            if (selectedGroup?._id === groupId) {
                // Add user to typing list if not already there
                if (!typingUsers.find(u => u.userId === userId)) {
                    const newTypingUsers = [...typingUsers, { userId, userName }];
                    set({ typingUsers: newTypingUsers });

                    // Auto-clear after 2 seconds
                    setTimeout(() => {
                        set({ typingUsers: get().typingUsers.filter(u => u.userId !== userId) });
                    }, 2000);
                }
            }
        });

        socket.on("group:stopTyping", ({ groupId, userId }) => {
            const { selectedGroup } = get();
            if (selectedGroup?._id === groupId) {
                set({ typingUsers: get().typingUsers.filter(u => u.userId !== userId) });
            }
        });
    },

    // Unsubscribe from group socket events
    unsubscribeFromGroupEvents: () => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
            socket.off("group:created");
            socket.off("group:updated");
            socket.off("group:deleted");
            socket.off("group:memberAdded");
            socket.off("group:memberRemoved");
            socket.off("group:removed");
            socket.off("group:memberLeft");
            socket.off("group:newMessage");
            socket.off("group:messageDeleted");
            socket.off("group:messagesRead");
            socket.off("group:pollUpdated");
            socket.off("group:typing");
            socket.off("group:stopTyping");
        }
        set({ _isSubscribedToGroupEvents: false });
    },

    // Set selected group
    setSelectedGroup: (group) => {
        const current = get().selectedGroup;
        const { groupMessages, groupMessagesMeta } = get();

        if (current?._id && groupMessages.length) {
            writeMemoryThread("group", current._id, {
                messages: groupMessages,
                hasMoreOlder: groupMessagesMeta?.hasMoreOlder,
                oldestCachedAt: groupMessages[0]?.createdAt,
                newestAt: groupMessages[groupMessages.length - 1]?.createdAt,
            });
        }

        if (!group) {
            set({
                selectedGroup: null,
                groupMessages: [],
                typingUsers: [],
                isGroupMessagesLoading: false,
                groupMessagesMeta: {
                    hasMoreOlder: true,
                    isSyncing: false,
                    oldestCursor: null,
                    newestCursor: null,
                },
            });
            return;
        }

        const sameGroup = current && String(current._id) === String(group._id);

        if (sameGroup) {
            set({ selectedGroup: group });
            return;
        }

        const mem = readMemoryThread("group", group._id);
        set({
            selectedGroup: group,
            typingUsers: [],
            groupMessages: mem?.messages || [],
            groupMessagesMeta: mem
                ? {
                      hasMoreOlder: mem.hasMoreOlder ?? true,
                      isSyncing: false,
                      oldestCursor: mem.oldestCachedAt,
                      newestCursor: mem.newestAt,
                  }
                : { hasMoreOlder: true, isSyncing: false, oldestCursor: null, newestCursor: null },
            isGroupMessagesLoading: !mem?.messages?.length,
        });
    },

    // Clear selected group
    clearSelectedGroup: () => {
        set({ selectedGroup: null, groupMessages: [] });
    },

    // Vote on a poll option in group message
    votePoll: async (messageId, optionIndex) => {
        try {
            const { selectedGroup } = get();
            const res = await axiosInstance.post(`/groups/${selectedGroup._id}/messages/${messageId}/vote`, { optionIndex });
            set({ groupMessages: get().groupMessages.map(m => m._id === messageId ? res.data : m) });
        } catch (error) {
            toast.error("Failed to vote");
        }
    }
}));
