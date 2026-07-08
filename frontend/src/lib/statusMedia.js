/**
 * Client-side status media helpers (multipart File upload — never Base64 in Mongo).
 * Limits are configurable via env overrides where Vite allows.
 */

const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;
export const MAX_VIDEO_SECONDS = 30;

/** Configurable upload caps (bytes) */
export const MAX_IMAGE_BYTES =
  Number(import.meta.env.VITE_STATUS_MAX_IMAGE_MB || 8) * 1024 * 1024;
export const MAX_VIDEO_BYTES =
  Number(import.meta.env.VITE_STATUS_MAX_VIDEO_MB || 40) * 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
]);

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

export function isImageFile(file) {
  if (!file) return false;
  if (ALLOWED_IMAGE_MIME.has((file.type || "").toLowerCase())) return true;
  return !file.type && IMAGE_EXT.test(file.name || "");
}

export function isVideoFile(file) {
  if (!file) return false;
  if (ALLOWED_VIDEO_MIME.has((file.type || "").toLowerCase())) return true;
  return !file.type && VIDEO_EXT.test(file.name || "");
}

function formatBytes(n) {
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)}MB` : `${Math.round(n / 1024)}KB`;
}

/**
 * Validate file type + size before preview/upload.
 * Throws Error with a user-friendly message.
 */
export function validateStatusFile(file) {
  if (!file) throw new Error("Please choose a photo or video");

  const mime = (file.type || "").toLowerCase();
  const name = file.name || "";

  const okImage =
    ALLOWED_IMAGE_MIME.has(mime) || (!mime && IMAGE_EXT.test(name));
  const okVideo =
    ALLOWED_VIDEO_MIME.has(mime) || (!mime && VIDEO_EXT.test(name));

  if (!okImage && !okVideo) {
    throw new Error(
      "Unsupported file. Use JPG, PNG, WebP images or MP4, MOV, WebM videos."
    );
  }

  if (okImage && file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image must be under ${formatBytes(MAX_IMAGE_BYTES)}`);
  }
  if (okVideo && file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video must be under ${formatBytes(MAX_VIDEO_BYTES)}`);
  }

  return okVideo ? "video" : "image";
}

export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      const d = video.duration;
      cleanup();
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error("Could not read video duration"));
      } else resolve(d);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("This video file looks invalid or corrupted"));
    };
    video.src = url;
  });
}

/** Compress image via canvas → Blob File for multipart upload */
export async function compressImageFile(
  file,
  { maxEdge = MAX_IMAGE_EDGE, quality = IMAGE_QUALITY } = {}
) {
  if (!isImageFile(file)) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime, quality)
  );
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, mime === "image/png" ? ".png" : ".jpg");
  return new File([blob], name, { type: mime, lastModified: Date.now() });
}

/** Capture a JPEG thumbnail frame from a video File */
export async function captureVideoThumbnail(file, atSeconds = 0.1) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    await new Promise((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () =>
        reject(new Error("Could not load video for thumbnail"));
      video.src = url;
    });

    const seekTo = Math.min(
      atSeconds,
      Math.max(0, (video.duration || 1) * 0.05)
    );
    await new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      try {
        video.currentTime = seekTo;
      } catch {
        resolve();
      }
    });

    const w = Math.min(480, video.videoWidth || 480);
    const h = Math.round(
      ((video.videoHeight || 480) / (video.videoWidth || 480)) * w
    );
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.75)
    );
    if (!blob) throw new Error("Could not create video thumbnail");
    return new File([blob], "thumb.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Validate (+ optional duration check), compress image, or generate video thumb.
 */
export async function prepareStatusMedia(file) {
  const kind = validateStatusFile(file);

  if (kind === "image") {
    const media = await compressImageFile(file);
    return { media, thumbnail: null, duration: 5, mediaType: "image" };
  }

  const duration = await getVideoDuration(file);
  if (duration > MAX_VIDEO_SECONDS + 0.35) {
    throw new Error(
      `Video is too long (${Math.ceil(duration)}s). Max is ${MAX_VIDEO_SECONDS} seconds.`
    );
  }

  let thumbnail = null;
  try {
    thumbnail = await captureVideoThumbnail(file);
  } catch {
    // Backend can still derive a Cloudinary frame if thumb fails
    thumbnail = null;
  }

  return {
    media: file,
    thumbnail,
    duration: Math.min(MAX_VIDEO_SECONDS, Math.ceil(duration * 10) / 10),
    mediaType: "video",
  };
}
