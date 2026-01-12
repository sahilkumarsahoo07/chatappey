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
    const socket = useAuthStore.getState().socket;
    const onlineUsers = useAuthStore.getState().onlineUsers || [];

    if (!socket) {
      toast.error("Connection error. Please refresh the page.");
      return;
    }

    // Check if receiver is online
    const isReceiverOnline = onlineUsers.includes(selectedUser._id);
    
    // Create optimistic message to show instantly
    // Start with 'sent' (single tick), will upgrade to 'delivered' if receiver is online
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
      status: messageData.scheduledFor ? 'scheduled' : 'sent', // Start with 'sent' (single tick)
      replyTo: replyingToMessage?._id || null,
      replyToMessage: replyingToMessage ? {
        text: replyingToMessage.text,
        image: replyingToMessage.image,
        senderId: replyingToMessage.senderId,
        senderName: replyingToMessage.senderId === authUser._id ? authUser.fullName : selectedUser.fullName
      } : null
    };

    // Add message to UI INSTANTLY (synchronous state update)
    // Determine initial status based on receiver online status
    const initialStatus = (isReceiverOnline && !messageData.scheduledFor) ? 'delivered' : optimisticMessage.status;
    const messageToAdd = { ...optimisticMessage, status: initialStatus };
    
    // Add message to state immediately - no delays
    set({ messages: [...messages, messageToAdd] });

    // Send via WebSocket (non-blocking, fire-and-forget)
    socket.emit("sendMessage", {
      receiverId: selectedUser._id,
      ...messageData,
      replyTo: replyingToMessage?._id || null
    }, (response) => {
      // Process response immediately (no setTimeout delay)
      if (response.error) {
        // Handle error
        const currentMessages = get().messages;
        set({ messages: currentMessages.filter(msg => msg._id !== optimisticMessage._id) });
        toast.error(response.error);
        return;
      }

      const newMessage = response.message;

      // Batch all updates together to minimize re-renders
      const currentMessages = get().messages;
      const updatedMessages = currentMessages.map(msg => {
        if (msg._id === optimisticMessage._id) {
          // Preserve the status from optimistic update (sent or delivered)
          // Server might return different status, but we keep our optimistic one
          const preservedStatus = msg.status === 'delivered' ? 'delivered' : 
                                 (newMessage.status === 'delivered' || newMessage.status === 'read') ? newMessage.status : 
                                 msg.status; // Keep 'sent' if not upgraded yet
          
          return {
            ...msg, // Keep optimistic message as base (preserves temp ID)
            ...newMessage, // Overlay real data from server
            _id: optimisticMessage._id, // CRITICAL: Keep temp ID to prevent shake
            status: preservedStatus, // Use preserved status
            image: optimisticMessage.image || newMessage.image,
            audio: optimisticMessage.audio || newMessage.audio,
            file: optimisticMessage.file || newMessage.file,
            createdAt: optimisticMessage.createdAt,
            // Preserve reply data from server response
            replyTo: newMessage.replyTo,
            replyToMessage: newMessage.replyToMessage,
            realId: newMessage._id // Store real ID for reference if needed
          };
        }
        return msg;
      });

      // Update users list (defer sorting to prevent blocking)
      const currentUsers = get().users;
      const updatedUsers = currentUsers.map(user => {
        if (user._id === selectedUser._id) {
          return {
            ...user,
            lastMessage: {
              text: newMessage.text,
              image: newMessage.image,
              createdAt: newMessage.createdAt,
              senderId: newMessage.senderId,
              status: updatedMessages.find(m => m._id === optimisticMessage._id)?.status || newMessage.status
            }
          };
        }
        return user;
      });

      // Sort users and update state IMMEDIATELY (no requestAnimationFrame delay)
      const sortedUsers = [...updatedUsers].sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      // Batch all state updates together - update immediately
      set({ 
        messages: updatedMessages,
        users: sortedUsers,
        replyingToMessage: null 
      });
    });
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

      console.log('[Socket Debug] newMessage received:', {
        messageId: newMessage._id,
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        authUserId: authUser._id,
        currentSelectedUserId: currentSelectedUser?._id,
        isMessageForCurrentChat,
        isFromAuthUser: newMessage.senderId === authUser._id
      });

      if (isMessageForCurrentChat && newMessage.senderId !== authUser._id) {
        // CRITICAL FIX: Check for duplicate by ID first
        const messages = get().messages;
        const alreadyExists = messages.some(m => m._id === newMessage._id);

        console.log('[Socket Debug] Message for current chat:', {
          alreadyExists,
          messagesCount: messages.length
        });

        if (!alreadyExists) {
          // Check if chat is active (window focused + sender is current chat)
          const isWindowFocused = document.hasFocus() && !document.hidden;
          const isChatActive = isWindowFocused && currentSelectedUser?._id === newMessage.senderId;

          console.log('[Socket Debug] Adding message to UI with status:', isChatActive ? 'read' : newMessage.status);

          set({
            messages: [...messages, {
              ...newMessage,
              status: isChatActive ? 'read' : newMessage.status // INSTANT blue ticks if chat is active!
            }],
          });
        } else {
          console.log('[Socket Debug] Message already exists, skipping');
        }
      } else {
        console.log('[Socket Debug] Message NOT for current chat or from self, skipping UI update');
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

      // CRITICAL: Check if chat is already open - if so, don't increment unreadCount
      const isChatAlreadyOpen = currentSelectedUser?._id === senderId && isWindowFocused;
      
      if (senderIndex !== -1) {
        const updatedUsers = [...users];
        const sender = updatedUsers[senderIndex];

        // If chat is already open, unreadCount should be 0
        // If message is for me and chat is NOT open, increment unreadCount
        const shouldIncrementUnread = newMessage.receiverId === authUser._id && 
                                       !isChatAlreadyOpen && 
                                       !shouldMarkRead;

        const updatedSender = {
          ...sender,
          lastMessage: {
            text: newMessage.text,
            image: newMessage.image,
            createdAt: newMessage.createdAt,
            senderId: newMessage.senderId,
            status: (shouldMarkRead || isChatAlreadyOpen) ? 'read' : 'delivered'
          },
          unreadCount: (shouldMarkRead || isChatAlreadyOpen)
            ? 0  // Chat is open, no unread
            : (shouldIncrementUnread ? (sender.unreadCount || 0) + 1 : sender.unreadCount)
        };

        updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(updatedSender);
        set({ users: updatedUsers });
      } else {
        get().refreshUsers();
      }

      // Mark messages as read immediately if chat is open and visible
      const isVisible = !document.hidden;
      if (isVisible && isMessageForCurrentChat && newMessage.receiverId === authUser._id) {
        if (newMessage.senderId === currentSelectedUser?._id) {
          // Mark as read immediately - this will also update unreadCount to 0
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
        // Update messages status to 'read'
        const updatedMessages = messages.map((msg) =>
          msg.senderId === authUser._id && msg.status !== "read"
            ? { ...msg, status: "read" }
            : msg
        );
        
        // Update users list: set unreadCount to 0 and update lastMessage status
        const updatedUsers = users.map(user =>
          user._id === readBy
            ? { 
                ...user, 
                unreadCount: 0,  // INSTANTLY remove unread badge when messages are read
                lastMessage: user.lastMessage ? { ...user.lastMessage, status: 'read' } : null 
              }
            : user
        );
        
        set({
          messages: updatedMessages,
          users: updatedUsers
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
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.error("Socket not available for marking messages as read");
      return;
    }

    // INSTANTLY update unreadCount to 0 before sending to server (optimistic update)
    const { users } = get();
    const updatedUsers = users.map(user =>
      user._id === userId
        ? { ...user, unreadCount: 0 }  // Remove badge immediately
        : user
    );
    set({ users: updatedUsers });

    try {
      // Emit via WebSocket - server will confirm and update message statuses
      socket.emit("markMessagesAsRead", { userId });
      // No need to refreshUsers() - WebSocket will handle message status updates
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
