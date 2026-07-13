/**
 * Story music proxy — geethle HTML → YouTube Music URL → vidssave audio.
 *
 * Geethle example (search "Tere Bina"):
 *   <title>Tere Hoke Rehengay</title>
 *   <meta name="description" content="Album • Artist">
 *   window.location.replace("https://music.youtube.com/watch?v=...")
 *
 * Vidssave response shape:
 *   { data: { id, title, thumbnail, duration, resources: [{ type, format, quality, download_url }] }, status: 1 }
 *
 * Auth credentials must not change.
 */

const VIDSSAVE_AUTH = "20250901majwlqo";
const VIDSSAVE_ORIGIN = "source";
const VIDSSAVE_DOMAIN = "api-ak.vidssave.com";
const VIDSSAVE_URL = "https://api.vidssave.com/api/contentsite_api/media/parse";

const YT_MUSIC_RE =
  /window\.location\.replace\(\s*["'](https:\/\/music\.youtube\.com\/watch\?v=[^"']+)["']\s*\)/i;
const YT_ID_RE = /[?&]v=([a-zA-Z0-9_-]{6,})/;

/** Prefer streaming-friendly audio only — never video. */
const AUDIO_PRIORITY = [
  { format: "MP3", quality: "128KBPS" },
  { format: "MP3", quality: "256KBPS" },
  { format: "M4A", quality: "128KBPS" },
  { format: "OPUS", quality: "256KBPS" },
  { format: "M4A", quality: "48KBPS" },
  { format: "WEBM", quality: "LOW" },
  { format: "OPUS", quality: "128KBPS" },
];

function normalizeQuality(q = "") {
  return String(q).toUpperCase().replace(/\s+/g, "");
}

function normalizeFormat(f = "") {
  return String(f).toUpperCase().replace(/\s+/g, "");
}

function audioUrlOf(resource) {
  return (
    resource?.download_url ||
    resource?.media_url ||
    resource?.url ||
    ""
  );
}

function pickBestAudio(resources = []) {
  const audioOnly = resources.filter(
    (m) => String(m?.type || "").toLowerCase() === "audio" && audioUrlOf(m)
  );
  if (!audioOnly.length) return null;

  for (const pref of AUDIO_PRIORITY) {
    const hit = audioOnly.find(
      (m) =>
        normalizeFormat(m.format) === pref.format &&
        normalizeQuality(m.quality) === pref.quality
    );
    if (hit) return hit;
  }

  // Any MP3, then any remaining audio
  return (
    audioOnly.find((m) => normalizeFormat(m.format) === "MP3") ||
    audioOnly[0]
  );
}

function extractVideoId(url) {
  const m = String(url).match(YT_ID_RE);
  return m?.[1] || null;
}

function parseDurationSeconds(raw) {
  if (raw == null) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function metaContent(html, nameOrProp) {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${nameOrProp}["']`,
    "i"
  );
  return html.match(re)?.[1] || html.match(re2)?.[1] || "";
}

function decodeHtml(str = "") {
  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Parse song title / artist / cover from geethle HTML. */
export function parseGeethleHtml(html) {
  const sourceUrl = html.match(YT_MUSIC_RE)?.[1] || "";
  const title =
    decodeHtml(metaContent(html, "og:title") || metaContent(html, "twitter:title") || "") ||
    decodeHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").trim();

  const description = decodeHtml(
    metaContent(html, "description") ||
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      ""
  );

  // "Album • Artist" or "Artist"
  let artist = "";
  let album = "";
  if (description.includes("•")) {
    const parts = description.split("•").map((p) => p.trim());
    album = parts[0] || "";
    artist = parts[parts.length - 1] || "";
  } else {
    artist = description;
  }

  const thumbnail = decodeHtml(
    metaContent(html, "og:image") || metaContent(html, "twitter:image") || ""
  );

  return {
    title: title || "Unknown track",
    artist: artist || "Unknown artist",
    album,
    thumbnail,
    sourceUrl,
    id: extractVideoId(sourceUrl) || "",
  };
}

async function fetchText(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Search geethle with the user's query (path = song name).
 * Returns YouTube Music URL + display metadata from HTML.
 */
export async function resolveFromGeethle(query) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Search query is required");

  const url = `https://geethle.tech/${encodeURIComponent(q).replace(/%20/g, "+")}`;
  const html = await fetchText(url);
  const meta = parseGeethleHtml(html);

  if (!meta.sourceUrl) {
    throw new Error("No music result found for this search");
  }

  return meta;
}

/** Fallback seeds when primary search finds nothing. */
const FALLBACK_QUERIES = [
  "Shape of You Ed Sheeran",
  "Kesariya Arijit",
  "Blinding Lights",
  "Tum Hi Ho",
  "Levitating Dua Lipa",
  "Stay The Kid Laroi",
];

/**
 * Scrape YouTube search results for videoIds (used when Geethle is down/empty).
 */
export async function searchYoutubeVideoIds(query, { limit = 6 } = {}) {
  const q = String(query || "").trim();
  if (!q) return [];

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q).replace(/%20/g, "+")}`;
  const html = await fetchText(url, { timeout: 14000 });
  const ids = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
  return [...new Set(ids)].slice(0, limit);
}

async function oembedMeta(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: videoId,
      title: data.title || "Unknown track",
      artist: data.author_name || "Unknown artist",
      album: "",
      thumbnail:
        data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      sourceUrl: `https://music.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    return {
      id: videoId,
      title: "Unknown track",
      artist: "Unknown artist",
      album: "",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      sourceUrl: `https://music.youtube.com/watch?v=${videoId}`,
    };
  }
}

/** Resolve several YouTube video IDs into playable songs (best-effort). */
async function songsFromVideoIds(videoIds, { limit = 5 } = {}) {
  const ids = [...new Set(videoIds)].slice(0, Math.max(limit * 2, limit));
  const settled = await Promise.allSettled(
    ids.map(async (id) => {
      const meta = await oembedMeta(id);
      if (!meta?.sourceUrl) return null;
      return parseMusicMedia(meta.sourceUrl, meta);
    })
  );

  const songs = [];
  const seen = new Set();
  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value?.id || !r.value?.audioUrl) continue;
    if (seen.has(r.value.id)) continue;
    seen.add(r.value.id);
    songs.push(r.value);
    if (songs.length >= limit) break;
  }
  return songs;
}

/**
 * When Geethle fails: try YouTube search for the query, then popular alternatives.
 * Always prefers returning songs over throwing.
 */
export async function searchAlternateSongs(query, { limit = 5 } = {}) {
  const q = String(query || "").trim();
  const songs = [];
  const seen = new Set();

  const pushAll = (list) => {
    for (const s of list) {
      if (!s?.id || seen.has(s.id)) continue;
      seen.add(s.id);
      songs.push(s);
      if (songs.length >= limit) return true;
    }
    return false;
  };

  // 1) Try YouTube results for the user's query (different matches)
  if (q) {
    try {
      const ids = await searchYoutubeVideoIds(q, { limit: 8 });
      if (ids.length) {
        const fromYt = await songsFromVideoIds(ids, { limit });
        if (pushAll(fromYt)) return songs;
      }
    } catch (e) {
      console.warn("searchAlternateSongs yt:", e.message);
    }
  }

  // 2) Popular alternate seeds so UI never looks empty
  const seedQueries = FALLBACK_QUERIES.filter(
    (s) => s.toLowerCase() !== q.toLowerCase()
  ).slice(0, 4);

  const seedSettled = await Promise.allSettled(
    seedQueries.map(async (seed) => {
      const ids = await searchYoutubeVideoIds(seed, { limit: 2 });
      if (!ids[0]) return null;
      return songsFromVideoIds([ids[0]], { limit: 1 });
    })
  );

  for (const r of seedSettled) {
    if (r.status !== "fulfilled" || !r.value?.length) continue;
    if (pushAll(r.value)) break;
  }

  return songs;
}

/** Resolve search query → meta (Geethle first, YouTube Music URL fallback). */
export async function resolveSearchMeta(query) {
  try {
    return await resolveFromGeethle(query);
  } catch (geethleErr) {
    console.warn("geethle miss:", geethleErr.message);
    const ids = await searchYoutubeVideoIds(query, { limit: 1 });
    if (!ids[0]) throw geethleErr;
    const meta = await oembedMeta(ids[0]);
    if (!meta?.sourceUrl) throw geethleErr;
    return meta;
  }
}

/** @deprecated use resolveFromGeethle */
export async function resolveYoutubeMusicUrl(query) {
  const meta = await resolveSearchMeta(query);
  return meta.sourceUrl;
}

/**
 * POST vidssave parse — only `link` changes; auth/origin/domain fixed.
 * Picks best audio from data.resources (type === "audio").
 */
export async function parseMusicMedia(youtubeMusicUrl, geethleMeta = null) {
  const link = String(youtubeMusicUrl || "").trim();
  if (!link.includes("music.youtube.com/watch")) {
    throw new Error("Invalid YouTube Music link");
  }

  const body = new URLSearchParams({
    auth: VIDSSAVE_AUTH,
    origin: VIDSSAVE_ORIGIN,
    domain: VIDSSAVE_DOMAIN,
    link,
  });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  let payload;
  try {
    const res = await fetch(VIDSSAVE_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Parse API HTTP ${res.status}`);
    payload = await res.json();
  } finally {
    clearTimeout(t);
  }

  // Real API: { data: { id, title, thumbnail, duration, resources: [...] }, status: 1 }
  const data = payload?.data || payload || {};
  const resources = Array.isArray(data.resources)
    ? data.resources
    : Array.isArray(data.medias)
      ? data.medias
      : Array.isArray(payload?.resources)
        ? payload.resources
        : [];

  const best = pickBestAudio(resources);
  const streamUrl = audioUrlOf(best);
  if (!streamUrl) {
    throw new Error("No audio stream available for this track");
  }

  const videoId =
    extractVideoId(link) || String(data.id || geethleMeta?.id || link);

  return {
    id: videoId,
    // Prefer real song name from geethle / vidssave title
    title:
      geethleMeta?.title ||
      data.title ||
      data.media_title ||
      "Unknown track",
    thumbnail:
      geethleMeta?.thumbnail ||
      data.thumbnail ||
      data.thumb ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
    artist:
      geethleMeta?.artist ||
      data.artist ||
      data.uploader ||
      data.author ||
      "Unknown artist",
    album: geethleMeta?.album || "",
    duration: parseDurationSeconds(data.duration) || 0,
    audioUrl: streamUrl,
    quality: `${normalizeFormat(best.format)} ${normalizeQuality(best.quality)}`.trim(),
    format: normalizeFormat(best.format),
    sourceUrl: link,
  };
}

/**
 * Full flow: geethle (preferred) → YouTube fallback → alternate songs.
 * Always tries to attach related/suggested tracks after the primary hit.
 */
export async function searchStoryMusic(query, { relatedLimit = 4 } = {}) {
  try {
    const meta = await resolveSearchMeta(query);
    const primary = await parseMusicMedia(meta.sourceUrl, meta);

    let related = [];
    if (relatedLimit > 0) {
      related = await fetchSuggestedSongs(query, primary, relatedLimit);
    }

    return {
      song: primary,
      related,
      // Keep Results = top match only; Suggested = related list
      results: [primary],
      fallback: false,
    };
  } catch (err) {
    console.warn("searchStoryMusic primary failed:", err.message);
    const alternates = await searchAlternateSongs(query, {
      limit: Math.max(5, relatedLimit + 1),
    });
    if (!alternates.length) {
      throw err;
    }
    return {
      song: alternates[0],
      related: alternates.slice(1),
      results: [alternates[0]],
      fallback: true,
    };
  }
}

/**
 * Suggested tracks: same search + artist vibes, excluding the primary song.
 * Uses one YouTube scrape (+ optional artist scrape) then parallel audio parse.
 */
async function fetchSuggestedSongs(query, primary, limit = 4) {
  const seen = new Set(primary?.id ? [primary.id] : []);
  const videoIds = [];

  try {
    const fromQuery = await searchYoutubeVideoIds(query, { limit: limit + 4 });
    for (const id of fromQuery) {
      if (seen.has(id) || videoIds.includes(id)) continue;
      videoIds.push(id);
    }
  } catch {
    /* ignore */
  }

  const artistQ = String(primary?.artist || "")
    .replace(/Unknown artist/i, "")
    .trim();
  if (artistQ && videoIds.length < limit + 2) {
    try {
      const fromArtist = await searchYoutubeVideoIds(`${artistQ} songs`, {
        limit: 4,
      });
      for (const id of fromArtist) {
        if (seen.has(id) || videoIds.includes(id)) continue;
        videoIds.push(id);
      }
    } catch {
      /* ignore */
    }
  }

  if (!videoIds.length) return [];

  const songs = await songsFromVideoIds(videoIds, { limit });
  return songs.filter((s) => s.id && s.id !== primary?.id);
}

export async function getMusicByLink(link) {
  return parseMusicMedia(link);
}
