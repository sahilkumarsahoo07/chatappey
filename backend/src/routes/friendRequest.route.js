import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriendRequests,
    getSentRequests,
    sendRequestMessage,
} from "../controllers/friendRequest.controllers.js";

const router = express.Router();

// Send a friend request
router.post("/request/:id", protectRoute, sendFriendRequest);

// Accept a friend request
router.put("/accept/:requestId", protectRoute, acceptFriendRequest);

// Reject a friend request
router.put("/reject/:requestId", protectRoute, rejectFriendRequest);

// Get received friend requests
router.get("/requests", protectRoute, getFriendRequests);

// Get sent friend requests
router.get("/sent", protectRoute, getSentRequests);

// Send request message
router.post("/request-message/:id", protectRoute, sendRequestMessage);

export default router;
