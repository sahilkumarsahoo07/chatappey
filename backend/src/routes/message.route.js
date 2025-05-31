import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, deleteForAllMessage,forwardMessage } from "../controllers/message.controllers.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage)

router.put("/:messageId", protectRoute, deleteForAllMessage);

router.post("/forward/:messageId", protectRoute, forwardMessage);

export default router;
