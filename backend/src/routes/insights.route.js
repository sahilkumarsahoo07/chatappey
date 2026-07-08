import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getRelationshipScore, getTopFriends } from "../controllers/insights.controllers.js";

const router = express.Router();

router.get("/top-friends", protectRoute, getTopFriends);
router.get("/relationship/:userId", protectRoute, getRelationshipScore);

export default router;
