import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  searchMusic,
  parseMusic,
  resolveMusic,
  getTrendingMusic,
  streamMusicProxy,
} from "../controllers/music.controllers.js";

const router = express.Router();

router.get("/search", protectRoute, searchMusic);
router.get("/trending", protectRoute, getTrendingMusic);
router.get("/stream", streamMusicProxy);
router.post("/parse", protectRoute, parseMusic);
router.post("/resolve", protectRoute, resolveMusic);

export default router;
