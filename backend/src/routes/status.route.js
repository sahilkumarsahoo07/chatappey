import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { statusUpload } from "../middleware/statusUpload.middleware.js";
import {
  uploadStatus,
  getStatusFeed,
  getUserStatuses,
  deleteStatus,
  viewStatus,
  getStatusViewers,
  toggleStatusLike,
  reactToStatus,
  commentOnStatus,
  deleteStatusComment,
  getStatusComments,
  getStatusEngagement,
} from "../controllers/status.controllers.js";

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
        ? "File too large"
        : err.message || "Upload error";
    return res.status(400).json({ error: msg });
  });
}

router.post("/upload", handleMulter, uploadStatus);
router.get("/", getStatusFeed);
router.get("/viewers/:id", getStatusViewers);
router.get("/engagement/:id", getStatusEngagement);
router.get("/comments/:id", getStatusComments);
router.post("/view/:id", viewStatus);
router.post("/:id/like", toggleStatusLike);
router.post("/:id/react", reactToStatus);
router.post("/:id/comment", commentOnStatus);
router.delete("/:id/comment/:commentId", deleteStatusComment);
router.get("/:userId", getUserStatuses);
router.delete("/:id", deleteStatus);

export default router;
