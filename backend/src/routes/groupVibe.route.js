import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { statusUpload } from "../middleware/statusUpload.middleware.js";
import {
  createGroupVibe,
  getGroupVibes,
  getAllGroupVibesSummary,
  viewGroupVibe,
  reactToGroupVibe,
  getGroupVibeViewers,
  replyToGroupVibe,
  deleteGroupVibe,
  getCreatorVibeArchive,
  updateGroupVibePermissions,
} from "../controllers/groupVibe.controllers.js";

const router = express.Router();
router.use(protectRoute);

const uploadFields = statusUpload.fields([
  { name: "media", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

function handleMulter(req, res, next) {
  uploadFields(req, res, (err) => {
    if (!err) return next();
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "File size limit exceeded"
        : err.message || "Upload error";
    return res.status(400).json({ error: msg });
  });
}

// Global summaries across all user groups
router.get("/summary", getAllGroupVibesSummary);

// Group-specific routes
router.post("/:groupId/vibes", handleMulter, createGroupVibe);
router.get("/:groupId/vibes", getGroupVibes);
router.get("/:groupId/vibes/archive", getCreatorVibeArchive);
router.post("/:groupId/vibes/:vibeId/view", viewGroupVibe);
router.post("/:groupId/vibes/:vibeId/react", reactToGroupVibe);
router.get("/:groupId/vibes/:vibeId/viewers", getGroupVibeViewers);
router.post("/:groupId/vibes/:vibeId/reply", replyToGroupVibe);
router.delete("/:groupId/vibes/:vibeId", deleteGroupVibe);
router.put("/:groupId/vibe-permissions", updateGroupVibePermissions);

export default router;
