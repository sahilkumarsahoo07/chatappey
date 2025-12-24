import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import {
  showBrowserNotification,
  showInAppNotification,
  playNotificationSound,
  isDocumentVisible,
  requestNotificationPermission
} from "../lib/notifications";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  friendRequests: [],
  sentRequests: [],
  isFriendRequestsLoading: false,
  replyingToMessage: null,
  isTyping: false, // New state

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Refresh users silently without loading state (for real-time updates)
  refreshUsers: async () => {
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      // Silently fail, don't show error toast for background refresh
      console.error("Error refreshing users:", error);
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });

      // Mark messages as read when opening a chat
      get().markMessagesAsRead(userId);
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users, replyingToMessage } = get();
    const authUser = useAuthStore.getState().authUser;

    // Create optimistic message to show instantly
    const optimisticMessage = {
      _id: `temp-${Date.now()}`, // Temporary ID
      text: messageData.text,
      image: messageData.image,
      audio: messageData.audio,
      file: messageData.file,
      poll: messageData.poll || null,
      scheduledFor: messageData.scheduledFor,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      createdAt: messageData.scheduledFor ? new Date(messageData.scheduledFor).toISOString() : new Date().toISOString(),
      status: messageData.scheduledFor ? 'scheduled' : 'sending',
      replyTo: replyingToMessage?._id || null,
      replyToMessage: replyingToMessage ? {
        text: replyingToMessage.text,
        image: replyingToMessage.image,
        senderId: replyingToMessage.senderId,
        senderName: replyingToMessage.senderId === authUser._id ? authUser.fullName : selectedUser.fullName
      } : null
    };

    // Add message to UI INSTANTLY
    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        {
          ...messageData,
          replyTo: replyingToMessage?._id || null
        }
      );
      const newMessage = res.data;

      // Replace optimistic message with real one from server
      const currentMessages = get().messages;
      set({
        messages: currentMessages.map(msg => {
          if (msg._id === optimisticMessage._id) {
            return {
              ...newMessage,
              image: optimisticMessage.image || newMessage.image,
              audio: optimisticMessage.audio || newMessage.audio,
              file: optimisticMessage.file || newMessage.file,
              createdAt: optimisticMessage.createdAt
            };
          }
          return msg;
        })
      });

      // Instantly update sidebar by modifying users list locally
      const updatedUsers = users.map(user => {
        if (user._id === selectedUser._id) {
          return {
            ...user,
            lastMessage: {
              text: newMessage.text,
              image: newMessage.image,
              createdAt: newMessage.createdAt,
              senderId: newMessage.senderId,
              status: newMessage.status
            }
          };
        }
        return user;
      });

      // Sort users to move the current chat to the top
      const sortedUsers = [...updatedUsers].sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      set({ users: sortedUsers });
      set({ replyingToMessage: null });
    } catch (error) {
      const currentMessages = get().messages;
      set({ messages: currentMessages.filter(msg => msg._id !== optimisticMessage._id) });
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.error("Socket not available");
      return;
    }

    // Listen for new messages
    socket.on("newMessage", (newMessage) => {
      const currentSelectedUser = get().selectedUser;
      const authUser = useAuthStore.getState().authUser;
      const users = get().users;

      // Skip scheduled messages - they should never arrive via socket
      if (newMessage.status === 'scheduled') {
        console.warn("Received scheduled message via socket - ignoring:", newMessage._id);
        return;
      }

      const isMessageForCurrentChat =
        (newMessage.senderId === currentSelectedUser?._id && newMessage.receiverId === authUser._id) ||
        (newMessage.senderId === authUser._id && newMessage.receiverId === currentSelectedUser?._id);

      if (isMessageForCurrentChat && newMessage.senderId !== authUser._id) {
        set({
          messages: [...get().messages, newMessage],
        });
      }

      // Notification Logic
      const isWindowFocused = document.hasFocus() && !document.hidden;
      const isSenderActiveCurrentChat = currentSelectedUser?._id === newMessage.senderId;
      let shouldMarkRead = false;

      if (newMessage.receiverId === authUser._id) {
        playNotificationSound();

        const senderForNotify = users.find(u => u._id === newMessage.senderId) || {
          _id: newMessage.senderId,
          fullName: newMessage.senderName || "New Message",
          profilePic: newMessage.senderProfilePic || "/avatar.png"
        };

        if (!isWindowFocused) {
          showBrowserNotification(senderForNotify.fullName, {
            body: newMessage.text || "📷 Photo",
            icon: senderForNotify.profilePic || "/avatar.png",
            tag: newMessage._id,
            requireInteraction: false,
            silent: false
          });
        } else if (!isSenderActiveCurrentChat) {
          showInAppNotification(newMessage, senderForNotify, () => {
            get().setSelectedUser(senderForNotify);
          });
        }

        if (isWindowFocused && isSenderActiveCurrentChat) {
          shouldMarkRead = true;
        }
      }

      const senderId = newMessage.senderId === authUser._id ? newMessage.receiverId : newMessage.senderId;
      const senderIndex = users.findIndex((u) => u._id === senderId);

      if (senderIndex !== -1) {
        const updatedUsers = [...users];
        const sender = updatedUsers[senderIndex];

        const updatedSender = {
          ...sender,
          lastMessage: {
            text: newMessage.text,
            image: newMessage.image,
            createdAt: newMessage.createdAt,
            senderId: newMessage.senderId,
            status: (shouldMarkRead || (isWindowFocused && isSenderActiveCurrentChat)) ? 'read' : 'delivered'
          },
          unreadCount: (shouldMarkRead || isSenderActiveCurrentChat)
            ? 0
            : (newMessage.receiverId === authUser._id ? (sender.unreadCount || 0) + 1 : sender.unreadCount)
        };

        updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(updatedSender);
        set({ users: updatedUsers });
      } else {
        get().refreshUsers();
      }

      const isVisible = !document.hidden;
      if (isVisible && isMessageForCurrentChat && newMessage.receiverId === authUser._id) {
        if (newMessage.senderId === currentSelectedUser?._id) {
          get().markMessagesAsRead(currentSelectedUser._id);
        }
      }
    });

    const handleActiveState = () => {
      const { selectedUser } = get();
      if (!document.hidden && selectedUser) {
        get().markMessagesAsRead(selectedUser._id);
      }
    };
    window.addEventListener("focus", handleActiveState);
    document.addEventListener("visibilitychange", handleActiveState);
    get()._cleanupVisibility = () => {
      window.removeEventListener("focus", handleActiveState);
      document.removeEventListener("visibilitychange", handleActiveState);
    };

    socket.on("deleteMessageForAll", (updatedMessage) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        ),
      });
    });

    socket.on("messageDelivered", ({ messageId, status }) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === messageId ? { ...msg, status } : msg
        ),
      });
    });

    socket.on("messagesDelivered", ({ receiverId, senderId }) => {
      const { messages } = get();
      const authUser = useAuthStore.getState().authUser;
      if (senderId === authUser._id) {
        set({
          messages: messages.map((msg) =>
            msg.senderId === authUser._id &&
              msg.receiverId === receiverId &&
              msg.status === "sent"
              ? { ...msg, status: "delivered" }
              : msg
          ),
        });
      }
    });

    socket.on("messagesRead", ({ readBy, chatWith, messageIds }) => {
      const { selectedUser, messages, users } = get();
      const authUser = useAuthStore.getState().authUser;
      if (selectedUser && readBy === selectedUser._id && chatWith === authUser._id) {
        set({
          messages: messages.map((msg) =>
            msg.senderId === authUser._id && msg.status !== "read"
              ? { ...msg, status: "read" }
              : msg
          ),
          users: users.map(user =>
            user._id === readBy
              ? { ...user, lastMessage: user.lastMessage ? { ...user.lastMessage, status: 'read' } : null }
              : user
          )
        });
      }
    });

    socket.on("userOnline", ({ userId }) => {
      const authUser = useAuthStore.getState().authUser;
      const { messages, selectedUser } = get();
      if (selectedUser && userId === selectedUser._id) {
        const pendingMessages = messages.filter(
          msg => msg.senderId === authUser._id &&
            msg.receiverId === userId &&
            msg.status === "sent"
        );

        if (pendingMessages.length > 0) {
          socket.emit("updatePendingMessages", {
            senderId: authUser._id,
            receiverId: userId
          });
        }
      }
    });

    // === NEW EVENTS ===
    socket.on("messageReaction", ({ messageId, reactions }) => {
      set({
        messages: get().messages.map(msg => msg._id === messageId ? { ...msg, reactions } : msg)
      });
    });

    socket.on("messageUpdated", (updatedMessage) => {
      set({
        messages: get().messages.map(msg => msg._id === updatedMessage._id ? { ...msg, ...updatedMessage } : msg)
      });
    });

    socket.on("messagePinned", ({ messageId, isPinned }) => {
      set({
        messages: get().messages.map(msg => msg._id === messageId ? { ...msg, isPinned } : msg)
      });
    });

    socket.on("pollUpdated", ({ messageId, poll }) => {
      set({
        messages: get().messages.map(msg => msg._id === messageId ? { ...msg, poll } : msg)
      });
    });

    socket.on("typing", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) {
        set({ isTyping: true });

        // Clear any existing timeout
        if (get()._typingTimeout) {
          clearTimeout(get()._typingTimeout);
        }

        // Auto-clear typing indicator after 2 seconds if no stopTyping event
        const timeout = setTimeout(() => {
          if (get().selectedUser?._id === senderId) {
            set({ isTyping: false, _typingTimeout: null });
          }
        }, 2000);

        set({ _typingTimeout: timeout });
      }
    });

    socket.on("stopTyping", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) {
        // Clear timeout if it exists
        if (get()._typingTimeout) {
          clearTimeout(get()._typingTimeout);
          set({ _typingTimeout: null });
        }
        set({ isTyping: false });
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("deleteMessageForAll");
      socket.off("messageDelivered");
      socket.off("messagesDelivered");
      socket.off("messagesRead");
      socket.off("userOnline");
      socket.off("messageReaction");
      socket.off("messageUpdated");
      socket.off("messagePinned");
      socket.off("pollUpdated");
      socket.off("typing");
      socket.off("stopTyping");
    }
    if (get()._cleanupVisibility) {
      get()._cleanupVisibility();
      set({ _cleanupVisibility: null });
    }
  },

  deleteForAllMessage: async (messageId) => {
    try {
      const socket = useAuthStore.getState().socket;
      const { messages } = get();

      set({
        messages: messages.map((msg) =>
          msg._id === messageId
            ? { ...msg, text: "This message was deleted", image: null }
            : msg
        ),
      });

      socket?.emit("deleteMessageForAll", messageId);
      await axiosInstance.put(`/messages/${messageId}`);
      toast.success("Message deleted for everyone");
    } catch (error) {
      get().getMessages(get().selectedUser?._id);
      toast.error("Delete failed");
    }
  },

  forwardMessage: async (messageId, receiverId) => {
    try {
      const res = await axiosInstance.post(`/messages/forward/${messageId}`, {
        receiverId,
      });

      const { selectedUser, messages } = get();
      if (selectedUser._id === receiverId) {
        set({ messages: [...messages, res.data] });
      }

      toast.success("Message forwarded successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward message");
      throw error;
    }
  },

  markMessagesAsRead: async (userId) => {
    try {
      await axiosInstance.put(`/messages/read/${userId}`);
      get().refreshUsers();
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  },

  sendFriendRequest: async (userId, message = "") => {
    try {
      const endpoint = message ? `/friends/request-message/${userId}` : `/friends/request/${userId}`;
      const res = await axiosInstance.post(endpoint, { message });
      toast.success("Friend request sent");
      get().refreshUsers();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to send friend request");
      throw error;
    }
  },

  acceptFriendRequest: async (requestId) => {
    try {
      const res = await axiosInstance.put(`/friends/accept/${requestId}`);
      toast.success("Friend request accepted");
      get().fetchFriendRequests();
      get().refreshUsers();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to accept friend request");
      throw error;
    }
  },

  rejectFriendRequest: async (requestId) => {
    try {
      const res = await axiosInstance.put(`/friends/reject/${requestId}`);
      toast.success("Friend request rejected");
      get().fetchFriendRequests();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject friend request");
      throw error;
    }
  },

  fetchFriendRequests: async () => {
    set({ isFriendRequestsLoading: true });
    try {
      const res = await axiosInstance.get("/friends/requests");
      set({ friendRequests: res.data });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to fetch friend requests");
    } finally {
      set({ isFriendRequestsLoading: false });
    }
  },

  fetchSentRequests: async () => {
    try {
      const res = await axiosInstance.get("/friends/sent");
      set({ sentRequests: res.data });
    } catch (error) {
      console.error("Failed to fetch sent requests:", error);
    }
  },

  setSelectedUser: (selectedUser) => {
    const currentUser = get().selectedUser;
    if (selectedUser && (!currentUser || currentUser._id !== selectedUser._id)) {
      set({ selectedUser, messages: [] });
    } else {
      set({ selectedUser });
    }
  },

  setReplyingToMessage: (message) => set({ replyingToMessage: message }),

  clearReplyingToMessage: () => set({ replyingToMessage: null }),

  // NEW ACTIONS
  sendReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/reaction`, { emoji });
      // Optimistic local update
      set({
        messages: get().messages.map(msg => msg._id === messageId ? res.data : msg)
      });
    } catch (error) {
      toast.error("Failed to react");
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}/edit`, { text });
      set({ messages: get().messages.map(m => m._id === messageId ? res.data : m) });
      toast.success("Message edited");
    } catch (error) {
      toast.error("Failed to edit message");
    }
  },

  togglePinMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/pin`);
      set({ messages: get().messages.map(m => m._id === messageId ? res.data : m) });
      toast.success(res.data.isPinned ? "Message pinned" : "Message unpinned");
    } catch (error) {
      toast.error("Failed to pin message");
    }
  },

  votePoll: async (messageId, optionIndex) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/vote`, { optionIndex });
      set({ messages: get().messages.map(m => m._id === messageId ? res.data : m) });
    } catch (error) {
      toast.error("Failed to vote");
    }
  },

  setTyping: (isTyping) => {
    const socket = useAuthStore.getState().socket;
    const { selectedUser } = get();
    if (!socket || !selectedUser) return;

    if (isTyping) {
      socket.emit("typing", { receiverId: selectedUser._id });
    } else {
      socket.emit("stopTyping", { receiverId: selectedUser._id });
    }
  }
}));
