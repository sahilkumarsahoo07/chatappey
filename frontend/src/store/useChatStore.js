import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

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

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
      });
    });

    // socket.on("messageUpdated", (updatedMessage) => {
    //     set({
    //         messages: get().messages.map(msg =>
    //             msg._id === updatedMessage._id ? updatedMessage : msg
    //         )
    //     });
    // });

    socket.on("deleteMessageForAll", (updatedMessage) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        ),
      });
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

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("deleteMessageForAll");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
