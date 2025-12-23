import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
    createGroup,
    getMyGroups,
    getGroupDetails,
    updateGroup,
    deleteGroup,
    addMembers,
    removeMember,
    leaveGroup,
    getGroupMessages,
    sendGroupMessage,
    markGroupMessagesAsRead,
    deleteGroupMessageForAll,
    deleteGroupMessageForMe,
    updateMemberRole,
    pinMessage,
    unpinMessage
} from "../controllers/group.controllers.js";

const router = express.Router();

// Group CRUD
router.post("/create", protectRoute, createGroup);
router.get("/", protectRoute, getMyGroups);
router.get("/:groupId", protectRoute, getGroupDetails);
router.put("/:groupId", protectRoute, updateGroup);
router.delete("/:groupId", protectRoute, deleteGroup);

// Member management
router.post("/:groupId/members", protectRoute, addMembers);
router.delete("/:groupId/members/:userId", protectRoute, removeMember);
router.post("/:groupId/leave", protectRoute, leaveGroup);
router.put("/:groupId/members/:userId/role", protectRoute, updateMemberRole);
router.post("/:groupId/pin/:messageId", protectRoute, pinMessage);
router.post("/:groupId/unpin", protectRoute, unpinMessage);

// Messages
router.get("/:groupId/messages", protectRoute, getGroupMessages);
router.post("/:groupId/messages", protectRoute, sendGroupMessage);
router.put("/:groupId/messages/read", protectRoute, markGroupMessagesAsRead);
router.delete("/:groupId/messages/:messageId/all", protectRoute, deleteGroupMessageForAll);
router.delete("/:groupId/messages/:messageId/me", protectRoute, deleteGroupMessageForMe);

export default router;


