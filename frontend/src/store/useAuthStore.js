
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

const getBaseUrl = () => {
    if (import.meta.env.MODE === "development") {
        return `http://${window.location.hostname}:5001`;
    }
    return "https://chatappey.onrender.com";
};
const BASE_URL = getBaseUrl();

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    isVerifyingOTP: false,
    onlineUsers: [],
    socket: null,

    // Admin State
    adminStats: null,
    adminUsers: [],
    adminMessages: [],
    isAdminLoading: false,

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

    signupOTP: async (data) => {
        set({ isSigningUp: true });
        try {
            const res = await axiosInstance.post("/auth/signup-otp", data);
            toast.success(res.data.message || "OTP sent to your email");
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong");
            return false;
        } finally {
            set({ isSigningUp: false });
        }
    },

    verifySignup: async (data) => {
        set({ isVerifyingOTP: true });
        try {
            const res = await axiosInstance.post("/auth/verify-signup", data);
            set({ authUser: res.data });

            if (res.data.token) {
                localStorage.setItem("token", res.data.token);
            }

            toast.success("Account verified successfully");
            get().connectSocket();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Invalid OTP");
            return false;
        } finally {
            set({ isVerifyingOTP: false });
        }
    },

    loginWithGoogle: () => {
        window.location.href = `${BASE_URL}/api/auth/google`;
    },

    setAuthUserFromToken: async (token) => {
        set({ isCheckingAuth: true });
        try {
            localStorage.setItem("token", token);
            await get().checkAuth();
        } catch (error) {
            console.log("Error in setAuthUserFromToken:", error);
        } finally {
            set({ isCheckingAuth: false });
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

            import("../lib/messageCache").then(({ clearAllThreads, clearMemoryThreads }) => {
                clearAllThreads();
                clearMemoryThreads();
            });

            toast.success("Logged out successfully");
            get().disconnectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        }
    },

    logoutGlobal: async () => {
        try {
            await axiosInstance.post("/auth/logout-global");
            set({ authUser: null });

            // Remove token from localStorage
            localStorage.removeItem("token");

            import("../lib/messageCache").then(({ clearAllThreads, clearMemoryThreads }) => {
                clearAllThreads();
                clearMemoryThreads();
            });

            toast.success("Logged out from all devices");
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

    changePassword: async (passwordData) => {
        try {
            const res = await axiosInstance.put("/auth/change-password", passwordData);
            toast.success(res.data.message || "Password updated successfully");
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update password");
            return false;
        }
    },

    updatePrivacySettings: async (privacyData) => {
        try {
            const res = await axiosInstance.put("/auth/update-privacy", privacyData);
            set({ authUser: res.data });
            toast.success("Privacy settings updated");
        } catch (error) {
            console.error("Error updating privacy settings:", error);
            toast.error(error.response?.data?.message || "Failed to update privacy settings");
        }
    },

    updateAppearanceSettings: async (appearanceData) => {
        console.log("🎨 updateAppearanceSettings called with:", appearanceData);
        try {
            console.log("📡 Sending PUT request to /auth/update-appearance");
            const res = await axiosInstance.put("/auth/update-appearance", appearanceData);
            console.log("✅ Response received:", res.data);
            set({ authUser: res.data });
            toast.success("Appearance updated");
        } catch (error) {
            console.error("❌ Error updating appearance:", error);
            console.error("Error details:", error.response?.data);
            toast.error(error.response?.data?.message || "Failed to update appearance");
        }
    },

    updateIncognito: async () => {
        try {
            const res = await axiosInstance.put("/auth/update-incognito");
            // Update local user state
            const updatedUser = { ...get().authUser, isIncognito: res.data.isIncognito };
            set({ authUser: updatedUser });
            toast.success(res.data.message);
            return true;
        } catch (error) {
            console.error("Error updating incognito:", error);
            toast.error(error.response?.data?.message || "Failed to update incognito mode");
            return false;
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
        const { authUser, socket: existing } = get();
        if (!authUser) return;
        if (existing?.connected) return;

        if (existing) {
            existing.removeAllListeners();
            existing.disconnect();
        }

        const socket = io(BASE_URL, {
            query: {
                userId: authUser._id,
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
            transports: ["websocket", "polling"],
        });
        socket.connect();

        set({ socket: socket });

        socket.on("connect", () => {
            console.log("Socket connected successfully");
            get().syncLiveConversations?.();
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected");
        });

        socket.on("reconnect", (attemptNumber) => {
            console.log("Socket reconnected after", attemptNumber, "attempts");
            toast.success("Connection restored");
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().unsubscribeFromMessages();
                useChatStore.getState().subscribeToMessages();
            });
            import("./useGroupStore").then(({ useGroupStore }) => {
                useGroupStore.getState().unsubscribeFromGroupEvents();
                useGroupStore.getState().subscribeToGroupEvents();
            });
            get().syncLiveConversations?.();
            import("./useStatusStore").then(({ useStatusStore }) => {
                useStatusStore.getState().subscribeToStatusEvents();
                useStatusStore.getState().loadFeed(true);
            });
        });

        socket.on("reconnect_error", (error) => {
            console.error("Socket reconnection error:", error);
        });

        // Handle being blocked by another user
        socket.on("userBlocked", ({ blockerId }) => {
            console.log("You have been blocked by:", blockerId);

            // Refresh users list to update block status and UI
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();

                // If currently chatting with the blocker, clear selected user
                const selectedUser = useChatStore.getState().selectedUser;
                if (selectedUser?._id === blockerId) {
                    useChatStore.getState().setSelectedUser(null);
                    toast.info("This user is no longer available");
                }
            });
        });

        // Handle being unblocked by another user
        socket.on("userUnblocked", ({ unblockerId }) => {
            console.log("You have been unblocked by:", unblockerId);

            // Refresh users list to update block status and UI
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();
            });
        });

        // Call event listeners
        socket.on("call:incoming", ({ from, fromData, callType, roomID }) => {
            console.log('=== INCOMING CALL RECEIVED ===');
            console.log('From User:', fromData?.fullName, '(', from, ')');
            console.log('Call Type:', callType);
            console.log('Room ID:', roomID);
            console.log('Current auth user:', get().authUser?.fullName);

            // Show browser notification for incoming call
            playNotificationSound();

            const callTypeText = callType === 'video' ? 'Video Call' : 'Voice Call';

            if (!isDocumentVisible()) {
                showBrowserNotification(`Incoming ${callTypeText}`, {
                    body: `${fromData?.fullName || 'Someone'} is calling you...`,
                    icon: fromData?.profilePic || '/avatar.png',
                    tag: 'incoming-call',
                    requireInteraction: true,
                    url: from ? `/?chat=${from}` : "/",
                    chatId: from || null,
                    peer: fromData
                      ? {
                          _id: fromData._id || from,
                          fullName: fromData.fullName,
                          profilePic: fromData.profilePic,
                          isFriend: true,
                        }
                      : null,
                });
            }

            import("./useCallStore").then(({ useCallStore }) => {
                const callStore = useCallStore.getState();
                console.log('Setting incoming call in store...');

                callStore.setIncomingCall({
                    from,
                    fromData,
                    callType,
                    roomID
                });

                console.log('✅ Incoming call set in store');
                console.log('Incoming call state:', useCallStore.getState().incomingCall);
            });
        });

        socket.on("call:rejected", () => {
            console.log("Call was rejected");
            toast.error("Call was rejected");
            import("./useCallStore").then(({ useCallStore }) => {
                useCallStore.getState().endCall();
            });
        });

        socket.on("call:ended", () => {
            console.log("Call ended by other user");
            toast("Call ended", { icon: "📞" });
            import("./useCallStore").then(({ useCallStore }) => {
                useCallStore.getState().endCall();
            });
        });

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });
        socket.on("user-logged-out", ({ userId, lastLogout }) => {
            // Import useChatStore to update the users list and selectedUser
            import("./useChatStore").then(({ useChatStore }) => {
                const chatStore = useChatStore.getState();

                // Update selectedUser if it's the one who logged out
                if (chatStore.selectedUser?._id === userId) {
                    useChatStore.setState((state) => ({
                        selectedUser: {
                            ...state.selectedUser,
                            lastLogout,
                        },
                    }));
                }

                // Update the users list with the new lastLogout time
                useChatStore.setState((state) => ({
                    users: state.users.map((user) =>
                        user._id === userId ? { ...user, lastLogout } : user
                    ),
                }));
                set((state) => ({
                    onlineUsers: state.onlineUsers.filter((id) => id !== userId),
                }));
            });
        });

        socket.on("global-logout", ({ userId }) => {
            const currentUserId = get().authUser?._id;
            if (currentUserId === userId) {
                set({ authUser: null });
                localStorage.removeItem("token");
                get().disconnectSocket();
                // toast.error("Security: All sessions invalidated. Please re-login.", { id: "global-logout-toast" });
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
                        url: "/notifications",
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
                        url: data.notification.fromUserId?._id
                            ? `/?chat=${data.notification.fromUserId._id}`
                            : "/",
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
                        url: "/notifications",
                    });
                }
            });

            // Refresh users list
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().refreshUsers();
            });
        });

    },

    syncLiveConversations: async () => {
        try {
            const [{ useChatStore }, { useGroupStore }, cache] = await Promise.all([
                import("./useChatStore"),
                import("./useGroupStore"),
                import("../lib/messageCache"),
            ]);
            const chat = useChatStore.getState();
            const group = useGroupStore.getState();

            await Promise.all([chat.refreshUsers(), group.getGroups()]);

            // Open DM — delta only (never full replace when we have a cursor)
            const selectedUser = chat.selectedUser;
            if (selectedUser) {
                const newest =
                    chat.messages[chat.messages.length - 1]?.createdAt ||
                    chat.messagesMeta?.newestCursor;
                if (newest) {
                    await chat.getMessages(selectedUser._id, { after: newest, background: true });
                } else {
                    await chat.getMessages(selectedUser._id, { background: true });
                }
            }

            // Open group — delta only
            const selectedGroup = group.selectedGroup;
            if (selectedGroup) {
                const newest =
                    group.groupMessages[group.groupMessages.length - 1]?.createdAt ||
                    group.groupMessagesMeta?.newestCursor;
                if (newest) {
                    await group.getGroupMessages(selectedGroup._id, {
                        after: newest,
                        background: true,
                    });
                } else {
                    await group.getGroupMessages(selectedGroup._id, { background: true });
                }
            }

            // Catch up recent cached threads in background (WhatsApp-like, no UI replace)
            const cursors = cache.listMemoryThreadCursors?.(12) || [];
            await Promise.allSettled(
                cursors.map(async (row) => {
                    if (!row?.peerId || !row?.newestAt) return;
                    if (row.type === "dm") {
                        if (selectedUser && String(selectedUser._id) === String(row.peerId)) return;
                        // Prefetch into cache only — don't touch open UI
                        try {
                            const params = { limit: 40, after: row.newestAt };
                            const res = await (
                                await import("../lib/axios")
                            ).axiosInstance.get(`/messages/${row.peerId}`, { params });
                            const incoming = Array.isArray(res.data)
                                ? res.data
                                : res.data?.messages || [];
                            if (!incoming.length) return;
                            const mem = cache.readMemoryThread("dm", row.peerId);
                            const merged = cache.mergeMessages(mem?.messages || [], incoming);
                            cache.writeMemoryThread("dm", row.peerId, {
                                messages: merged,
                                hasMoreOlder: mem?.hasMoreOlder ?? true,
                                newestAt: merged[merged.length - 1]?.createdAt,
                                oldestCachedAt: merged[0]?.createdAt,
                            });
                            cache.writeThread("dm", row.peerId, {
                                messages: merged,
                                hasMoreOlder: mem?.hasMoreOlder ?? true,
                            }).catch(() => {});
                        } catch {
                            /* silent background */
                        }
                    } else if (row.type === "group") {
                        if (selectedGroup && String(selectedGroup._id) === String(row.peerId)) return;
                        try {
                            const params = { limit: 40, after: row.newestAt };
                            const res = await (
                                await import("../lib/axios")
                            ).axiosInstance.get(`/groups/${row.peerId}/messages`, { params });
                            const incoming = Array.isArray(res.data)
                                ? res.data
                                : res.data?.messages || [];
                            if (!incoming.length) return;
                            const mem = cache.readMemoryThread("group", row.peerId);
                            const merged = cache.mergeMessages(mem?.messages || [], incoming);
                            cache.writeMemoryThread("group", row.peerId, {
                                messages: merged,
                                hasMoreOlder: mem?.hasMoreOlder ?? true,
                                newestAt: merged[merged.length - 1]?.createdAt,
                                oldestCachedAt: merged[0]?.createdAt,
                            });
                            cache.writeThread("group", row.peerId, {
                                messages: merged,
                                hasMoreOlder: mem?.hasMoreOlder ?? true,
                            }).catch(() => {});
                        } catch {
                            /* silent background */
                        }
                    }
                })
            );
        } catch (err) {
            console.warn("syncLiveConversations failed:", err);
        }
    },

    disconnectSocket: () => {
        const socket = get().socket;
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            set({ socket: null });
        }
    },

    // Admin Actions
    fetchAdminStats: async () => {
        try {
            const res = await axiosInstance.get("/admin/stats");
            set({ adminStats: res.data });
        } catch (error) {
            console.error("Error in fetchAdminStats:", error);
        }
    },

    fetchAdminUsers: async () => {
        set({ isAdminLoading: true });
        try {
            const res = await axiosInstance.get("/users", { baseURL: `${BASE_URL}/api/admin` }); // Testing if /admin/users works better
            // Wait, let's use the full relative path
            const res2 = await axiosInstance.get("/admin/users");
            set({ adminUsers: res2.data });
        } catch (error) {
            console.error("Error in fetchAdminUsers:", error);
        } finally {
            set({ isAdminLoading: false });
        }
    },

    fetchAdminMessages: async () => {
        set({ isAdminLoading: true });
        try {
            const res = await axiosInstance.get("/admin/messages");
            set({ adminMessages: res.data });
        } catch (error) {
            console.error("Error in fetchAdminMessages:", error);
        } finally {
            set({ isAdminLoading: false });
        }
    },

    updateUserStatus: async (userId, statusData) => {
        try {
            const res = await axiosInstance.put(`/admin/users/${userId}/status`, statusData);
            toast.success("User status updated");
            get().fetchAdminUsers(); // Refresh list
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update status");
            return false;
        }
    },

    adminUpdatePassword: async (userId, newPassword) => {
        try {
            const res = await axiosInstance.put(`/admin/users/${userId}/password`, { newPassword });
            toast.success("Password updated by admin");
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update password");
            return false;
        }
    },

    promoteUserToAdmin: async (userId) => {
        try {
            const res = await axiosInstance.put(`/admin/users/${userId}/promote`);
            toast.success("User promoted to Admin");
            get().fetchAdminUsers();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Promotion failed");
            return false;
        }
    },

    selectiveDeleteUserContent: async (userId, deleteFlags) => {
        try {
            const res = await axiosInstance.post(`/admin/users/${userId}/selective-delete`, deleteFlags);
            toast.success("Selective deletion successful");
            get().fetchAdminUsers();
            get().fetchAdminStats();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Selective deletion failed");
            return false;
        }
    },

    deleteUserByAdmin: async (userId) => {
        try {
            const res = await axiosInstance.delete(`/admin/users/${userId}`);
            toast.success("User and data deleted permanently");
            get().fetchAdminUsers(); // Refresh list
            get().fetchAdminStats(); // Refresh stats
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Deletion failed");
            return false;
        }
    },

    nuclearWipe: async () => {
        try {
            const res = await axiosInstance.delete("/admin/nuclear-wipe");
            toast.success("Nuclear wipe successful");
            get().fetchAdminStats();
            get().fetchAdminUsers();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Nuclear wipe failed");
            return false;
        }
    },

    deleteMessageByAdmin: async (messageId) => {
        try {
            const res = await axiosInstance.delete(`/admin/messages/${messageId}`);
            toast.success("Message deleted successfully");
            get().fetchAdminMessages();
            get().fetchAdminStats();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete message");
            return false;
        }
    },
}));
