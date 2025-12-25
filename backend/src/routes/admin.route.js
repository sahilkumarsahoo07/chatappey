import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { protectAdmin } from "../middleware/admin.middleware.js";
import {
    getAdminStats,
    getAllUsers,
    getAllMessages,
    updateUserStatus,
    adminUpdatePassword,
    deleteUser,
    nuclearDelete,
    promoteUser,
    selectiveDelete,
    deleteSingleMessage
} from "../controllers/admin.controller.js";

const router = express.Router();

// All routes here require the user to be logged in AND be an admin
router.use(protectRoute);
router.use(protectAdmin);

router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.get("/messages", getAllMessages);
router.put("/users/:userId/status", updateUserStatus);
router.put("/users/:userId/password", adminUpdatePassword);
router.put("/users/:userId/promote", promoteUser);
router.post("/users/:userId/selective-delete", selectiveDelete);
router.delete("/users/:userId", deleteUser);
router.delete("/messages/:messageId", deleteSingleMessage);
router.delete("/nuclear-wipe", nuclearDelete);

export default router;
