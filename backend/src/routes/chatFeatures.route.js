import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { messageVideoUpload } from "../middleware/messageUpload.middleware.js";
import {
  getChatPreference,
  updateChatPreference,
  setArchive,
  getArchivedChats,
  setMute,
  clearMute,
  getStarredMessages,
  starMessage,
  unstarMessage,
  getStarredIds,
  getSharedMedia,
  uploadChatVideo,
} from "../controllers/chatFeatures.controllers.js";

const router = express.Router();

router.get("/preferences/:chatType/:targetId", protectRoute, getChatPreference);
router.put("/preferences", protectRoute, updateChatPreference);

router.post("/archive", protectRoute, setArchive);
router.get("/archived", protectRoute, getArchivedChats);

router.post("/mute", protectRoute, setMute);
router.delete("/mute/:chatType/:targetId", protectRoute, clearMute);

router.get("/starred", protectRoute, getStarredMessages);
router.get("/starred/ids", protectRoute, getStarredIds);
router.post("/starred", protectRoute, starMessage);
router.delete("/starred/:messageId", protectRoute, unstarMessage);

router.get("/shared-media/:chatType/:targetId", protectRoute, getSharedMedia);

router.post(
  "/upload-video",
  protectRoute,
  (req, res, next) => {
    messageVideoUpload.single("video")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  uploadChatVideo
);

export default router;
