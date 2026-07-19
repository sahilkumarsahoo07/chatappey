import Notification from "../models/notification.model.js";

// Get all notifications for the logged-in user
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        const notifications = await Notification.find({ userId })
            .populate("fromUserId", "fullName profilePic email")
            .populate({
                path: "friendRequestId",
                select: "status requestMessage createdAt"
            })
            .sort({ createdAt: -1 });

        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error in getNotifications:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Mark a specific notification as read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId },
            { isRead: true },
            { new: true }
        ).populate("fromUserId", "fullName profilePic email");

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.status(200).json(notification);
    } catch (error) {
        console.error("Error in markAsRead:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;

        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error in markAllAsRead:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete a specific notification
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const notification = await Notification.findOneAndDelete({ _id: id, userId });

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.status(200).json({ message: "Notification deleted successfully" });
    } catch (error) {
        console.error("Error in deleteNotification:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get unread notification count
export const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;

        const count = await Notification.countDocuments({ userId, isRead: false });

        res.status(200).json({ count });
    } catch (error) {
        console.error("Error in getUnreadCount:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Return VAPID Public Key for Push Subscriptions
export const getVapidPublicKey = async (req, res) => {
    try {
        const { VAPID_PUBLIC_KEY } = await import("../lib/webpush.js");
        res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
    } catch (error) {
        console.error("Error in getVapidPublicKey:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Save User Web Push Subscription
export const subscribeToPush = async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: "Invalid subscription payload" });
        }

        const user = req.user;
        const exists = user.pushSubscriptions?.some(sub => sub.endpoint === subscription.endpoint);

        if (!exists) {
            user.pushSubscriptions = user.pushSubscriptions || [];
            user.pushSubscriptions.push({
                endpoint: subscription.endpoint,
                expirationTime: subscription.expirationTime || null,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                },
            });
            await user.save();
        }

        res.status(200).json({ success: true, message: "Push subscription saved" });
    } catch (error) {
        console.error("Error in subscribeToPush:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
