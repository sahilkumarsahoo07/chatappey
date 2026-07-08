import multer from "multer";

const MAX_VIDEO_MB = Number(process.env.MESSAGE_MAX_VIDEO_MB || 50);
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const messageVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    if (!VIDEO_MIMES.has(mime)) {
      return cb(new Error("Only MP4, MOV, and WebM videos are allowed"));
    }
    cb(null, true);
  },
});

export { MAX_VIDEO_BYTES, MAX_VIDEO_MB };
