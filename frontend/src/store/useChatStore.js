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
      senderId: authUser._id,
      receiverId: selectedUser._id,
      createdAt: new Date().toISOString(),
      status: 'sending', // Temporary status
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
      set({
        messages: messages.map(msg =>
          msg._id === optimisticMessage._id ? newMessage : msg
        ).concat(newMessage._id === optimisticMessage._id ? [] : [newMessage])
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

      // Clear reply state after sending
      set({ replyingToMessage: null });
    } catch (error) {
      // Remove optimistic message on error
      set({ messages: messages.filter(msg => msg._id !== optimisticMessage._id) });
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

      // Add message if it's part of the conversation with the selected user
      // (either sent by them to me, or sent by me to them)
      const isMessageForCurrentChat =
        (newMessage.senderId === currentSelectedUser?._id && newMessage.receiverId === authUser._id) ||
        (newMessage.senderId === authUser._id && newMessage.receiverId === currentSelectedUser?._id);

      if (isMessageForCurrentChat) {
        set({
          messages: [...get().messages, newMessage],
        });

        // If this is a message from the other user, mark it as read immediately
        if (newMessage.senderId === currentSelectedUser?._id) {
          get().markMessagesAsRead(currentSelectedUser._id);
        }
      } else if (newMessage.receiverId === authUser._id) {
        // Message is for me but from a different chat OR browser is not visible
        // Show notification
        const sender = users.find(u => u._id === newMessage.senderId);

        if (sender) {
          // Play notification sound
          playNotificationSound();

          console.log('Document visible:', isDocumentVisible());
          console.log('Notification permission:', Notification.permission);

          // ALWAYS show browser notification when tab is not visible
          // Document visibility check handles both minimized and background tabs
          if (!isDocumentVisible() || document.hidden) {
            // Browser is not focused/visible - show browser notification
            console.log('Showing browser notification for:', sender.fullName);
            showBrowserNotification(sender.fullName, {
              body: newMessage.text || "📷 Photo",
              icon: sender.profilePic || "/avatar.png",
              tag: newMessage.senderId, // Prevent duplicate notifications
              requireInteraction: false,
            });
          } else if (currentSelectedUser?._id !== newMessage.senderId) {
            // Browser is focused but viewing different chat - show in-app notification
            showInAppNotification(newMessage, sender, () => {
              // When notification is clicked, open that chat
              get().setSelectedUser(sender);
            });
          }
        }
      }

      // Always refresh user list to update last message preview
      get().refreshUsers();
    });

    // Listen for deleted messages
    socket.on("deleteMessageForAll", (updatedMessage) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        ),
      });
    });

    // Listen for message delivered event (single message)
    socket.on("messageDelivered", ({ messageId, status }) => {
      const { messages } = get();
      set({
        messages: messages.map((msg) =>
          msg._id === messageId ? { ...msg, status } : msg
        ),
      });
    });

    // Listen for multiple messages delivered event
    socket.on("messagesDelivered", ({ receiverId, senderId }) => {
      const { messages } = get();
      const authUser = useAuthStore.getState().authUser;

      // Update all sent messages to this receiver to "delivered"
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

    // Listen for messages read event
    socket.on("messagesRead", ({ readBy, chatWith, messageIds }) => {
      const { selectedUser, messages } = get();
      const authUser = useAuthStore.getState().authUser;

      // Update status of my messages when they're read
      if (selectedUser && readBy === selectedUser._id && chatWith === authUser._id) {
        set({
          messages: messages.map((msg) =>
            msg.senderId === authUser._id && msg.status !== "read"
              ? { ...msg, status: "read" }
              : msg
          ),
        });
      }
    });

    // Listen for when user comes online
    socket.on("userOnline", ({ userId }) => {
      const authUser = useAuthStore.getState().authUser;
      const { messages, selectedUser } = get();

      // If the selected user comes online, update pending messages
      if (selectedUser && userId === selectedUser._id) {
        // Notify server to update pending messages
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
  },

  deleteForAllMessage: async (messageId) => {
    try {
      const socket = useAuthStore.getState().socket;
      const { messages } = get();

      // Optimistic update - change text immediately
      set({
        messages: messages.map((msg) =>
          msg._id === messageId
            ? { ...msg, text: "This message was deleted", image: null }
            : msg
        ),
      });

      // Emit to server
      socket?.emit("deleteMessageForAll", messageId);

      await axiosInstance.put(`/messages/${messageId}`);
      toast.success("Message deleted for everyone");
    } catch (error) {
      // Revert on error
      get().getMessages(get().selectedUser?._id);
      toast.error("Delete failed");
    }
  },

  forwardMessage: async (messageId, receiverId) => {
    try {
      const res = await axiosInstance.post(`/messages/forward/${messageId}`, {
        receiverId,
      });

      // If the message is being forwarded to the currently selected user,
      // add it to the local messages for immediate display
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
      // Refresh user list to update unread count and remove highlights
      get().refreshUsers();
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
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
    }
  },

  // Friend Request Actions
  sendFriendRequest: async (userId, message = "") => {
    try {
      const endpoint = message ? `/friends/request-message/${userId}` : `/friends/request/${userId}`;
      const res = await axiosInstance.post(endpoint, { message });

      toast.success("Friend request sent");

      // Refresh users to update friend status
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

      // Refresh friend requests and users
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

      // Refresh friend requests
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

  setSelectedUser: (selectedUser) => set({ selectedUser }),

  setReplyingToMessage: (message) => set({ replyingToMessage: message }),

  clearReplyingToMessage: () => set({ replyingToMessage: null }),
}));
