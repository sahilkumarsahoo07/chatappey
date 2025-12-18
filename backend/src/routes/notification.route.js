import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,
} from "../controllers/notification.controllers.js";

const router = express.Router();

// Get all notifications
router.get("/", protectRoute, getNotifications);

// Get unread count
router.get("/unread-count", protectRoute, getUnreadCount);

// Mark notification as read
router.put("/:id/read", protectRoute, markAsRead);

// Mark all notifications as read
router.put("/read-all", protectRoute, markAllAsRead);

// Delete notification
router.delete("/:id", protectRoute, deleteNotification);

export default router;
