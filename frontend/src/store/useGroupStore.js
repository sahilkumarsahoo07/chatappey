import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useGroupStore = create((set, get) => ({
    groups: [],
    selectedGroup: null,
    groupMessages: [],
    isGroupsLoading: false,
    isGroupMessagesLoading: false,

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

    // Get group messages
    getGroupMessages: async (groupId) => {
        set({ isGroupMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/groups/${groupId}/messages`);
            set({ groupMessages: res.data });

            // Mark messages as read
            get().markGroupMessagesAsRead(groupId);
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to load messages");
        } finally {
            set({ isGroupMessagesLoading: false });
        }
    },

    // Send message to group (optionally to a different group for forwarding)
    sendGroupMessage: async (messageData, targetGroupId = null) => {
        const { selectedGroup, groupMessages, groups } = get();
        const authUser = useAuthStore.getState().authUser;

        const groupId = targetGroupId || selectedGroup?._id;
        if (!groupId) return;

        // Only add optimistic message if sending to currently selected group
        const isForwarding = targetGroupId && targetGroupId !== selectedGroup?._id;

        // Create optimistic message
        const optimisticMessage = {
            _id: `temp-${Date.now()}`,
            groupId: groupId,
            senderId: {
                _id: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic
            },
            text: messageData.text,
            image: messageData.image,
            createdAt: new Date().toISOString(),
            readBy: [authUser._id],
            isForwarded: messageData.isForwarded || false
        };

        // Add message to UI instantly (only if not forwarding to another group)
        if (!isForwarding) {
            set({ groupMessages: [...groupMessages, optimisticMessage] });
        }

        try {
            const res = await axiosInstance.post(
                `/groups/${groupId}/messages`,
                messageData
            );
            const newMessage = res.data;

            // Replace optimistic message with real one (only if not forwarding)
            if (!isForwarding) {
                set({
                    groupMessages: get().groupMessages.map(msg =>
                        msg._id === optimisticMessage._id ? newMessage : msg
                    )
                });
            }

            // Update group's lastMessage in the list
            set({
                groups: groups.map(g => {
                    if (g._id === groupId) {
                        return {
                            ...g,
                            lastMessage: {
                                text: newMessage.text || "📷 Photo",
                                senderId: authUser._id,
                                senderName: authUser.fullName,
                                createdAt: newMessage.createdAt
                            },
                            updatedAt: newMessage.createdAt
                        };
                    }
                    return g;
                }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            });

            return newMessage;
        } catch (error) {
            // Remove optimistic message on error (only if not forwarding)
            if (!isForwarding) {
                set({
                    groupMessages: get().groupMessages.filter(msg => msg._id !== optimisticMessage._id)
                });
            }
            toast.error(error.response?.data?.error || "Failed to send message");
            throw error;
        }
    },

    // Mark group messages as read
    markGroupMessagesAsRead: async (groupId) => {
        try {
            await axiosInstance.put(`/groups/${groupId}/messages/read`);

            // Clear unread count locally for immediate UI feedback
            set({
                groups: get().groups.map(g =>
                    g._id === groupId ? { ...g, unreadCount: 0 } : g
                )
            });
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    },

    // Delete group message for everyone
    deleteGroupMessageForAll: async (groupId, messageId) => {
        try {
            await axiosInstance.delete(`/groups/${groupId}/messages/${messageId}/all`);

            // Update message in local state immediately
            set({
                groupMessages: get().groupMessages.map(msg =>
                    msg._id === messageId
                        ? { ...msg, text: "This message was deleted", image: null }
                        : msg
                )
            });

            toast.success("Message deleted for everyone");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to delete message");
        }
    },

    // Delete group message for me only
    deleteGroupMessageForMe: async (groupId, messageId) => {
        try {
            await axiosInstance.delete(`/groups/${groupId}/messages/${messageId}/me`);

            // Remove message from local state immediately
            set({
                groupMessages: get().groupMessages.filter(msg => msg._id !== messageId)
            });

            toast.success("Message deleted for you");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to delete message");
        }
    },

    // Subscribe to group socket events
    subscribeToGroupEvents: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        // New group created (for other members when they're added)
        socket.on("group:created", (newGroup) => {
            // Only add if not already in the list (creator already has it from API response)
            const exists = get().groups.some(g => g._id === newGroup._id);
            if (!exists) {
                set({ groups: [newGroup, ...get().groups] });
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
            set({
                groups: get().groups.map(g => g._id === group._id ? group : g),
                selectedGroup: get().selectedGroup?._id === group._id ? group : get().selectedGroup
            });
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
            const isFromOther = message.senderId._id !== authUser._id;

            // If this is in the currently selected group, add the message
            if (selectedGroup?._id === groupId) {
                // Don't add if we already have this message (from our own send)
                if (!groupMessages.some(m => m._id === message._id)) {
                    set({ groupMessages: [...groupMessages, message] });
                }
            }

            // Update group's lastMessage and unread count in the list
            set({
                groups: groups.map(g => {
                    if (g._id === groupId) {
                        // Only increment unread if message is from another user AND group is not selected
                        const shouldIncrementUnread = isFromOther && selectedGroup?._id !== groupId;

                        return {
                            ...g,
                            lastMessage: {
                                text: message.text || "📷 Photo",
                                senderId: message.senderId._id,
                                senderName: message.senderId.fullName,
                                createdAt: message.createdAt
                            },
                            updatedAt: message.createdAt,
                            unreadCount: shouldIncrementUnread ? (g.unreadCount || 0) + 1 : g.unreadCount
                        };
                    }
                    return g;
                }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            });
        });

        // Message deleted in group
        socket.on("group:messageDeleted", ({ groupId, messageId, deletedForAll }) => {
            const { selectedGroup, groupMessages } = get();

            if (selectedGroup?._id === groupId && deletedForAll) {
                set({
                    groupMessages: groupMessages.map(msg =>
                        msg._id === messageId
                            ? { ...msg, text: "This message was deleted", image: null }
                            : msg
                    )
                });
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
        }
    },

    // Set selected group
    setSelectedGroup: (group) => {
        if (group && (!get().selectedGroup || get().selectedGroup._id !== group._id)) {
            set({ selectedGroup: group, groupMessages: [] });
        } else {
            set({ selectedGroup: group });
        }
    },

    // Clear selected group
    clearSelectedGroup: () => {
        set({ selectedGroup: null, groupMessages: [] });
    }
}));
