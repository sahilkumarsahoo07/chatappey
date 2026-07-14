import {
  searchStoryMusic,
  searchAlternateSongs,
  getMusicByLink,
  resolveYoutubeMusicUrl,
  parseMusicMedia,
} from "../utils/storyMusic.utils.js";

/** In-memory cache for hot searches (avoid hammering upstream). */
const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

const linkCache = new Map();
const LINK_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function cacheGet(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  searchCache.set(key, { at: Date.now(), data });
  if (searchCache.size > 200) {
    const first = searchCache.keys().next().value;
    searchCache.delete(first);
  }
}

function linkCacheGet(key) {
  const hit = linkCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LINK_CACHE_TTL_MS) {
    linkCache.delete(key);
    return null;
  }
  return hit.data;
}

function linkCacheSet(key, data) {
  linkCache.set(key, { at: Date.now(), data });
  if (linkCache.size > 500) {
    const first = linkCache.keys().next().value;
    linkCache.delete(first);
  }
}

/**
 * GET /api/music/search?q=
 * Always prefers returning songs (alternates) over a hard error.
 */
export const searchMusic = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Query required" });
    if (q.length > 120) return res.status(400).json({ error: "Query too long" });

    const cacheKey = q.toLowerCase();
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
      const data = await searchStoryMusic(q, { relatedLimit: 4 });
      cacheSet(cacheKey, data);
      return res.json({ ...data, cached: false });
    } catch (primaryErr) {
      console.error("searchMusic primary:", primaryErr.message);
      const alternates = await searchAlternateSongs(q, { limit: 6 });
      if (alternates.length) {
        const data = {
          song: alternates[0],
          related: alternates.slice(1),
          results: [alternates[0]],
          fallback: true,
        };
        cacheSet(cacheKey, data);
        return res.json({ ...data, cached: false });
      }
      // Soft empty — UI should show other suggestions, not an error banner
      return res.json({
        song: null,
        related: [],
        results: [],
        fallback: true,
        cached: false,
      });
    }
  } catch (error) {
    console.error("searchMusic:", error.message);
    return res.json({
      song: null,
      related: [],
      results: [],
      fallback: true,
      cached: false,
    });
  }
};

/**
 * POST /api/music/parse  { link }
 */
export const parseMusic = async (req, res) => {
  try {
    const link = String(req.body.link || "").trim();
    if (!link) return res.status(400).json({ error: "link required" });

    const cacheKey = `link:${link}`;
    const cached = linkCacheGet(cacheKey);
    if (cached) return res.json({ song: cached, cached: true });

    const song = await getMusicByLink(link);
    linkCacheSet(cacheKey, song);
    return res.json({ song, cached: false });
  } catch (error) {
    console.error("parseMusic:", error.message);
    return res.status(502).json({
      error: error.message || "Failed to parse music",
    });
  }
};

/**
 * POST /api/music/resolve  { query } — redirect URL only (debug / advanced)
 */
export const resolveMusic = async (req, res) => {
  try {
    const q = String(req.body.query || req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "query required" });
    const link = await resolveYoutubeMusicUrl(q);
    const song = await parseMusicMedia(link);
    return res.json({ link, song });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Resolve failed" });
  }
};

/** Curated trending seeds — resolved on demand when client opens Music. */
const TRENDING_QUERIES = [
  "Shape of You",
  "Blinding Lights",
  "Kesariya",
  "Tere Bina",
  "Levitating",
  "Stay Justin Bieber",
  "Apt Rosé",
  "Tum Hi Ho",
];

export const getTrendingMusic = async (_req, res) => {
  try {
    const cacheKey = "trending:v1";
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ results: cached, cached: true });

    // Resolve a few seeds in parallel (primary only) for faster Music tab open
    const settled = await Promise.allSettled(
      TRENDING_QUERIES.slice(0, 4).map((q) =>
        searchStoryMusic(q, { relatedLimit: 0 })
      )
    );
    const results = [];
    const seen = new Set();
    for (const r of settled) {
      if (r.status !== "fulfilled" || !r.value?.song) continue;
      const song = r.value.song;
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      results.push(song);
    }
    cacheSet(cacheKey, results);
    return res.json({ results, cached: false });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Trending failed" });
  }
};
