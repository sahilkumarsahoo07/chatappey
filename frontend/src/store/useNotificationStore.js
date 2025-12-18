import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,

    // Fetch all notifications
    fetchNotifications: async () => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get("/notifications");
            set({ notifications: res.data });

            // Update unread count
            const unreadCount = res.data.filter(n => !n.isRead).length;
            set({ unreadCount });
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to fetch notifications");
        } finally {
            set({ isLoading: false });
        }
    },

    // Fetch unread count
    fetchUnreadCount: async () => {
        try {
            const res = await axiosInstance.get("/notifications/unread-count");
            set({ unreadCount: res.data.count });
        } catch (error) {
            console.error("Failed to fetch unread count:", error);
        }
    },

    // Mark notification as read
    markAsRead: async (notificationId) => {
        try {
            await axiosInstance.put(`/notifications/${notificationId}/read`);

            set((state) => ({
                notifications: state.notifications.map(n =>
                    n._id === notificationId ? { ...n, isRead: true } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1)
            }));
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to mark as read");
        }
    },

    // Mark all notifications as read
    markAllAsRead: async () => {
        try {
            await axiosInstance.put("/notifications/read-all");

            set((state) => ({
                notifications: state.notifications.map(n => ({ ...n, isRead: true })),
                unreadCount: 0
            }));

            toast.success("All notifications marked as read");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to mark all as read");
        }
    },

    // Delete notification
    deleteNotification: async (notificationId) => {
        try {
            await axiosInstance.delete(`/notifications/${notificationId}`);

            set((state) => {
                const notification = state.notifications.find(n => n._id === notificationId);
                const wasUnread = notification && !notification.isRead;

                return {
                    notifications: state.notifications.filter(n => n._id !== notificationId),
                    unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
                };
            });

            toast.success("Notification deleted");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to delete notification");
        }
    },

    // Add new notification (from socket)
    addNotification: (notification) => {
        set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1
        }));
    },

    // Update existing notification
    updateNotification: (updatedNotification) => {
        set((state) => ({
            notifications: state.notifications.map(n =>
                n._id === updatedNotification._id ? updatedNotification : n
            )
        }));
    },
}));
