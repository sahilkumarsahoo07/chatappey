
import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import {
    showBrowserNotification,
    showInAppNotification,
    playNotificationSound,
    isDocumentVisible
} from "../lib/notifications";

// const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";
const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "https://chatappey.onrender.com";

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");

            set({ authUser: res.data });
            get().connectSocket();
        } catch (error) {
            console.log("Error in checkAuth:", error);
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    signup: async (data) => {
        set({ isSigningUp: true });
        try {
            const res = await axiosInstance.post("/auth/signup", data);
            set({ authUser: res.data });

            // Store token in localStorage
            if (res.data.token) {
                localStorage.setItem("token", res.data.token);
            }

            toast.success("Account created successfully");
            get().connectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isSigningUp: false });
        }
    },

    login: async (data) => {
        set({ isLoggingIn: true });
        try {
            const res = await axiosInstance.post("/auth/login", data);
            set({ authUser: res.data });

            // Store token in localStorage
            if (res.data.token) {
                localStorage.setItem("token", res.data.token);
            }

            toast.success("Logged in successfully");

            get().connectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isLoggingIn: false });
        }
    },

    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout");
            set({ authUser: null });

            // Remove token from localStorage
            localStorage.removeItem("token");

            toast.success("Logged out successfully");
            get().disconnectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        }
    },

    updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
            const res = await axiosInstance.put("/auth/update-profile", data);
            set({ authUser: res.data });
            toast.success("Profile updated successfully");
        } catch (error) {
            console.log("error in update profile:", error);
            toast.error(error.response.data.message);
        } finally {
            set({ isUpdatingProfile: false });
        }
    },

    updateName: async (fullName) => {
        try {
            const res = await axiosInstance.put("/auth/update-name", { fullName });
            set({ authUser: res.data.user });
            toast.success("Name updated successfully");
        } catch (error) {
            console.log("Error updating name:", error);
            toast.error(error.response?.data?.message || "Failed to update name");
        }
    },

    updateAbout: async (about) => {
        try {
            const res = await axiosInstance.put("/auth/update-about", { about });
            set({ authUser: res.data.user });
            toast.success("About updated successfully");
        } catch (error) {
            console.log("Error updating name:", error);
            toast.error(error.response?.data?.message || "Failed to update name");
        }
    },

    // Add to your useAuthStore
    sendOtp: async (email) => {
        try {
            const res = await axiosInstance.post("/auth/send-otp", { email });
            return res.data;
        } catch (error) {
            console.error("Error sending OTP:", error);
            throw error;
        }
    },
    verifyOtp: async (email, otp) => {
        try {
            const res = await axiosInstance.post("/auth/verify-otp", { email, otp });
            return res.data;
        } catch (error) {
            console.error("Error verifying OTP:", error);
            throw error;
        }
    },
    resetPassword: async (data) => {
        try {
            const res = await axiosInstance.put("/auth/reset-password", data);
            toast.success(res.data.message);
            return res.data;
        } catch (error) {
            console.error("Error in resetPassword:", error);
            toast.error(error.response?.data?.message || "Failed to reset password");
            throw error;
        }
    },
    blockUser: async (userId) => {
        try {
            const res = await axiosInstance.post("/auth/block", { userId }, {
                withCredentials: true,
            });

            toast.success(res.data.message);

            // Optional: Emit via socket (if you want local handling too)
            const socket = get().socket;
            if (socket?.connected) {
                socket.emit("user-blocked", {
                    blockerId: get().authUser._id,
                    blockedId: userId,
                });
            }

            return res.data;
        } catch (error) {
            console.error("Error blocking user:", error);
            toast.error(error.response?.data?.message || "Failed to block user");
            throw error;
        }
    },
    unblockUser: async (userId) => {
        try {
            const res = await axiosInstance.post("/auth/unblock", { userId }, {
                withCredentials: true,
            });

            toast.success(res.data.message);

            // Optional: Emit via socket (if you want local handling too)
            const socket = get().socket;
            if (socket?.connected) {
                socket.emit("user-unblocked", {
                    unblockerId: get().authUser._id,
                    unblockedId: userId,
                });
            }

            return res.data;
        } catch (error) {
            console.error("Error unblocking user:", error);
            toast.error(error.response?.data?.message || "Failed to unblock user");
            throw error;
        }
    },
    getOneBlockedUser: async () => {
        try {
            const res = await axiosInstance.get(`/auth/blocked-users`, {
                withCredentials: true, // if using JWT in cookies
            });
            return res.data;
        } catch (error) {
            console.error("Error in getOneBlockedUser:", error);
            toast.error(error.response?.data?.message || "Failed to fetch blocked status");
            throw error;
        }
    },

    // Add to your useAuthStore
    subscribeToBlockEvents: (callback) => {
        const { socket } = get();
        if (!socket) return;

        const handleBlocked = (data) => callback(data);
        socket.on("user-blocked", handleBlocked);
        socket.on("user-unblocked", handleBlocked);

        return () => {
            socket.off("user-blocked", handleBlocked);
            socket.off("user-unblocked", handleBlocked);
        };
    },
    checkBlockedStatus: async (userId) => {
        try {
            const data = await get().getOneBlockedUser();
            return data.blockedUsers.some(user => user._id === userId);
        } catch (error) {
            console.error("Error checking blocked status:", error);
            return false;
        }
    },

    connectSocket: () => {
        const { authUser } = get();
        if (!authUser || get().socket?.connected) return;

        const socket = io(BASE_URL, {
            query: {
                userId: authUser._id,
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });
        socket.connect();

        set({ socket: socket });

        // Handle reconnection
        socket.on("connect", () => {
            console.log("Socket connected successfully");
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected");
        });

        socket.on("reconnect", (attemptNumber) => {
            console.log("Socket reconnected after", attemptNumber, "attempts");
            toast.success("Connection restored");
        });

        socket.on("reconnect_error", (error) => {
            console.error("Socket reconnection error:", error);
        });

        socket.on("blocked", ({ blockerId, blockedId }) => {
            if (authUser._id === blockerId || authUser._id === blockedId) {
                // Force recheck of blocked status
                get().checkBlockedStatus();
            }
        });

        socket.on("unblocked", ({ unblockerId, unblockedId }) => {
            if (authUser._id === unblockerId || authUser._id === unblockedId) {
                // Force recheck of blocked status
                get().checkBlockedStatus();
            }
        });

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });
        socket.on("user-logged-out", ({ userId, lastLogout }) => {
            // If the selected user is the one who logged out, update their lastLogout
            if (get().selectedUser?._id === userId) {
                set((state) => ({
                    selectedUser: {
                        ...state.selectedUser,
                        lastLogout,
                    },
                }));
            }

            // Update online users
            set((state) => ({
                onlineUsers: state.onlineUsers.filter((id) => id !== userId),
            }));
        });

        // Global notification listener for when no chat is selected
        socket.on("newMessage", (newMessage) => {
            const { authUser } = get();

            // Only show notification if message is for me and I'm not in a chat
            if (newMessage.receiverId === authUser._id) {
                // Import useChatStore to check selected user
                import("./useChatStore").then(({ useChatStore }) => {
                    const selectedUser = useChatStore.getState().selectedUser;
                    const users = useChatStore.getState().users;

                    // Only show notification if not viewing this sender's chat
                    if (selectedUser?._id !== newMessage.senderId) {
                        const sender = users.find(u => u._id === newMessage.senderId);

                        if (sender) {
                            playNotificationSound();

                            if (!isDocumentVisible()) {
                                showBrowserNotification(sender.fullName, {
                                    body: newMessage.text || "📷 Photo",
                                    icon: sender.profilePic || "/avatar.png",
                                    tag: newMessage.senderId,
                                });
                            } else {
                                showInAppNotification(newMessage, sender, () => {
                                    useChatStore.getState().setSelectedUser(sender);
                                });
                            }
                        }
                    }
                });
            }
        });

        // Friend request socket events
        socket.on("friendRequestSent", (data) => {
            // Import notification store dynamically
            import("./useNotificationStore").then(({ useNotificationStore }) => {
                useNotificationStore.getState().addNotification(data.notification);
                useNotificationStore.getState().fetchUnreadCount();

                // Show notification
                playNotificationSound();
                if (!isDocumentVisible()) {
                    showBrowserNotification(data.notification.fromUserId.fullName, {
                        body: data.notification.message || "Sent you a friend request",
                        icon: data.notification.fromUserId.profilePic || "/avatar.png",
                        tag: "friend-request",
                    });
                }
            });

            // Refresh users list to update friend status
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();
            });
        });

        socket.on("friendRequestAccepted", (data) => {
            import("./useNotificationStore").then(({ useNotificationStore }) => {
                useNotificationStore.getState().addNotification(data.notification);
                useNotificationStore.getState().fetchUnreadCount();

                // Show notification
                playNotificationSound();
                if (!isDocumentVisible()) {
                    showBrowserNotification(data.notification.fromUserId.fullName, {
                        body: "Accepted your friend request",
                        icon: data.notification.fromUserId.profilePic || "/avatar.png",
                        tag: "friend-request-accepted",
                    });
                }
            });

            // Refresh users list
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();
            });
        });

        socket.on("friendRequestRejected", (data) => {
            import("./useNotificationStore").then(({ useNotificationStore }) => {
                useNotificationStore.getState().addNotification(data.notification);
                useNotificationStore.getState().fetchUnreadCount();
            });

            // Refresh users list
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();
            });
        });

        socket.on("newRequestMessage", (data) => {
            import("./useNotificationStore").then(({ useNotificationStore }) => {
                useNotificationStore.getState().addNotification(data.notification);
                useNotificationStore.getState().fetchUnreadCount();

                // Show notification
                playNotificationSound();
                if (!isDocumentVisible()) {
                    showBrowserNotification(data.notification.fromUserId.fullName, {
                        body: data.notification.message || "Sent you a message with friend request",
                        icon: data.notification.fromUserId.profilePic || "/avatar.png",
                        tag: "request-message",
                    });
                }
            });

            // Refresh users list
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();
            });
        });

    },
    disconnectSocket: () => {
        if (get().socket?.connected) get().socket.disconnect();
    },
}));
