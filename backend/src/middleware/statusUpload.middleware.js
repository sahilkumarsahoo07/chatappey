import multer from "multer";
import path from "path";

/**
 * Upload limits — override with env:
 * STATUS_MAX_IMAGE_MB, STATUS_MAX_VIDEO_MB
 */
const MAX_IMAGE_BYTES =
  Number(process.env.STATUS_MAX_IMAGE_MB || 8) * 1024 * 1024;
const MAX_VIDEO_BYTES =
  Number(process.env.STATUS_MAX_VIDEO_MB || 40) * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime", // mov
]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return cb(
      new Error("Only JPG, PNG, WebP images or MP4, MOV, WebM videos are allowed")
    );
  }
  cb(null, true);
};

export const statusUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_BYTES,
    files: 2, // media + optional thumbnail
  },
});

export function sanitizeFilename(name = "media") {
  const base = path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 80) || "media";
}

export function assertMediaSize(file) {
  if (!file) return;
  const isImage = file.mimetype.startsWith("image/");
  const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    throw new Error(`${isImage ? "Image" : "Video"} must be under ${mb}MB`);
  }
}

export { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, ALLOWED_MIME };
