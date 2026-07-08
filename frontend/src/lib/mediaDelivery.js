/**
 * Adaptive media quality + CDN URL helpers (Cloudinary-compatible transforms).
 */

import { detectNetwork, recommendedQuality, NetworkTier } from "./network";

const QUALITY_KEY = "chatappey_video_quality";
const CDN_CACHE_KEY = "chatappey_cdn_endpoint";

export const VIDEO_QUALITIES = [240, 360, 480, 720, 1080];

export function getManualQuality() {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (!v || v === "auto") return "auto";
    const n = Number(v);
    return VIDEO_QUALITIES.includes(n) ? n : "auto";
  } catch {
    return "auto";
  }
}

export function setManualQuality(value) {
  try {
    localStorage.setItem(QUALITY_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function resolveVideoQuality() {
  const manual = getManualQuality();
  if (manual !== "auto") return manual;
  const { tier } = detectNetwork();
  return recommendedQuality(tier);
}

/**
 * Build Cloudinary (or compatible) transformed URL for image/video.
 * Videos: keep original URL — inserting image-oriented transforms often breaks playback.
 */
export function buildQualityUrl(url, quality = resolveVideoQuality(), options = {}) {
  if (!url || typeof url !== "string") return url;
  const { isVideo = false } = options;
  if (isVideo) return url;

  const height = quality === "auto" ? resolveVideoQuality() : quality;

  // Cloudinary delivery: .../upload/v123/... → insert transform
  if (url.includes("/upload/") && (url.includes("cloudinary.com") || url.includes("res.cloudinary"))) {
    const transform = `c_limit,h_${height},q_auto:eco,f_auto`;
    if (url.includes("/upload/c_") || url.includes("/upload/w_") || url.includes("/upload/h_")) {
      return url; // already transformed
    }
    return url.replace("/upload/", `/upload/${transform}/`);
  }

  return url;
}

/**
 * CDN endpoint selection with cache + fallback list.
 * Configure via VITE_CDN_ENDPOINTS comma-separated, optional.
 */
function getConfiguredEndpoints() {
  const env = import.meta.env?.VITE_CDN_ENDPOINTS || "";
  const list = env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [];
}

export function getCachedCdnEndpoint() {
  try {
    const raw = sessionStorage.getItem(CDN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt > Date.now()) return parsed.endpoint;
  } catch {
    /* ignore */
  }
  return null;
}

export function cacheCdnEndpoint(endpoint, ttlMs = 30 * 60 * 1000) {
  try {
    sessionStorage.setItem(
      CDN_CACHE_KEY,
      JSON.stringify({ endpoint, expiresAt: Date.now() + ttlMs })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Pick nearest/fastest CDN by racing HEAD/GET of a tiny probe path.
 * Returns original mediaUrl rewritten to winning origin, or unchanged.
 */
export async function selectFastestMediaUrl(mediaUrl) {
  if (!mediaUrl) return mediaUrl;
  const endpoints = getConfiguredEndpoints();
  if (!endpoints.length) return mediaUrl;

  const cached = getCachedCdnEndpoint();
  if (cached) return rewriteOrigin(mediaUrl, cached);

  const probe = async (origin) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const start = performance.now();
    try {
      await fetch(`${origin.replace(/\/$/, "")}/favicon.ico`, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
        cache: "no-store",
      });
      return { origin, ms: performance.now() - start };
    } catch {
      return { origin, ms: Infinity };
    } finally {
      clearTimeout(t);
    }
  };

  const results = await Promise.all(endpoints.map(probe));
  results.sort((a, b) => a.ms - b.ms);
  const best = results[0];
  if (!best || !Number.isFinite(best.ms)) return mediaUrl;

  cacheCdnEndpoint(best.origin);
  return rewriteOrigin(mediaUrl, best.origin);
}

function rewriteOrigin(url, newOrigin) {
  try {
    const u = new URL(url);
    const o = new URL(newOrigin);
    u.protocol = o.protocol;
    u.host = o.host;
    return u.toString();
  } catch {
    return url;
  }
}

/** Fallback chain: try primary, then originals */
export function mediaFallbackUrls(primaryUrl) {
  const urls = [primaryUrl].filter(Boolean);
  if (primaryUrl && primaryUrl !== buildQualityUrl(primaryUrl, 480)) {
    urls.push(buildQualityUrl(primaryUrl, 480));
  }
  if (primaryUrl && primaryUrl !== buildQualityUrl(primaryUrl, 240)) {
    urls.push(buildQualityUrl(primaryUrl, 240));
  }
  return [...new Set(urls)];
}

export function isSlowNetwork() {
  const { tier } = detectNetwork();
  return (
    tier === NetworkTier.OFFLINE ||
    tier === NetworkTier.SLOW_2G ||
    tier === NetworkTier.TWO_G ||
    tier === NetworkTier.THREE_G
  );
}
