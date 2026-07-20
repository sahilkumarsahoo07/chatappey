import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, deleteForAllMessage, deleteForMeMessage, getMessageDeleteOptions, deleteChatForMe, forwardMessage, markMessagesAsRead, deleteAllMessages, addReaction, editMessage, togglePinMessage, votePoll } from "../controllers/message.controllers.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage)

// Delete entire conversation for me only (must be before /:messageId)
router.delete("/chat/:id", protectRoute, deleteChatForMe);

// Per-message delete (WhatsApp-style)
router.get("/:messageId/delete-options", protectRoute, getMessageDeleteOptions);
router.delete("/:messageId/me", protectRoute, deleteForMeMessage);
router.put("/:messageId", protectRoute, deleteForAllMessage);
router.delete("/:messageId/everyone", protectRoute, deleteForAllMessage);

router.post("/forward/:messageId", protectRoute, forwardMessage);

router.put("/read/:id", protectRoute, markMessagesAsRead);
router.post("/read/:id", protectRoute, markMessagesAsRead);
router.post("/mark-read/:id", protectRoute, markMessagesAsRead);

// New Features
router.post("/:messageId/reaction", protectRoute, addReaction);
router.put("/:messageId/edit", protectRoute, editMessage);
router.post("/:messageId/pin", protectRoute, togglePinMessage);
router.post("/:messageId/vote", protectRoute, votePoll);

// DANGER ZONE: Delete all messages
router.delete("/delete-all", deleteAllMessages);

export default router;

