import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, deleteForAllMessage, forwardMessage, markMessagesAsRead } from "../controllers/message.controllers.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage)

router.put("/:messageId", protectRoute, deleteForAllMessage);

router.post("/forward/:messageId", protectRoute, forwardMessage);

router.put("/read/:id", protectRoute, markMessagesAsRead);

export default router;
