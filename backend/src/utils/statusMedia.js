import { Readable } from "stream";
import cloudinary from "../lib/cloudinary.js";
import { sanitizeFilename } from "../middleware/statusUpload.middleware.js";

/**
 * Upload a Buffer to Cloudinary via stream (never stores Base64 in MongoDB).
 */
export function uploadBufferToCloudinary(buffer, { folder, resourceType, publicIdHint, mime }) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: folder || "chatappey_status",
      resource_type: resourceType || "auto",
      overwrite: false,
      unique_filename: true,
      use_filename: true,
      filename_override: sanitizeFilename(publicIdHint),
    };

    // Prefer quality-optimized delivery for images
    if (resourceType === "image" || (mime && mime.startsWith("image/"))) {
      opts.transformation = [{ quality: "auto:good", fetch_format: "auto" }];
    }

    if (resourceType === "video" || (mime && mime.startsWith("video/"))) {
      opts.resource_type = "video";
      // Cap encoding length; client also enforces 30s
      opts.eager = [{ format: "jpg", transformation: [{ start_offset: "0" }, { width: 400, crop: "scale", quality: "auto" }] }];
      opts.eager_async = false;
    }

    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    Readable.from(buffer).pipe(stream);
  });
}

export function videoThumbnailFromResult(result) {
  if (!result) return "";
  // Eager transformation JPG if present
  if (result.eager?.[0]?.secure_url) return result.eager[0].secure_url;
  // Fallback Cloudinary frame URL
  if (result.public_id && result.secure_url) {
    return result.secure_url
      .replace("/upload/", "/upload/so_0,w_400,c_scale,q_auto,f_jpg/")
      .replace(/\.(mp4|webm|mov)(\?.*)?$/i, ".jpg");
  }
  return "";
}

export async function destroyCloudinaryAsset(publicId, resourceType = "image") {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === "video" ? "video" : "image",
    });
  } catch (err) {
    console.error("Cloudinary destroy failed:", err.message);
  }
}
