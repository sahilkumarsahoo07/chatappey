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

/**
 * GET /api/music/stream?url=...&sourceUrl=...
 * Proxy audio stream to bypass mobile CORS/expiration issues & support byte-range seeking.
 */
export const streamMusicProxy = async (req, res) => {
  try {
    let streamUrl = String(req.query.url || "").trim();
    let sourceUrl = String(req.query.sourceUrl || "").trim();
    const title = String(req.query.title || "").trim();
    const artist = String(req.query.artist || "").trim();

    if (!streamUrl && !sourceUrl && !title) {
      return res.status(400).json({ error: "url, sourceUrl, or title required" });
    }

    let response = null;

    if (streamUrl) {
      try {
        const headers = {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
          Accept: "*/*",
        };
        if (req.headers.range) {
          headers["Range"] = req.headers.range;
        }

        const testRes = await fetch(streamUrl, { headers });
        if (testRes.ok || testRes.status === 206) {
          response = testRes;
        }
      } catch (err) {
        console.warn("Direct stream proxy failed, re-parsing sourceUrl:", err.message);
      }
    }

    if (!response && sourceUrl) {
      try {
        const fullSourceUrl = sourceUrl.includes("music.youtube.com")
          ? sourceUrl
          : `https://music.youtube.com/watch?v=${sourceUrl}`;
        const freshSong = await getMusicByLink(fullSourceUrl);
        if (freshSong?.audioUrl) {
          streamUrl = freshSong.audioUrl;
          const cacheKey = `link:${sourceUrl}`;
          linkCacheSet(cacheKey, freshSong);

          const headers = {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            Accept: "*/*",
          };
          if (req.headers.range) {
            headers["Range"] = req.headers.range;
          }
          const freshRes = await fetch(streamUrl, { headers });
          if (freshRes.ok || freshRes.status === 206) {
            response = freshRes;
          }
        }
      } catch (err) {
        console.error("Failed to re-parse music for stream proxy:", err.message);
      }
    }

    if (!response && (title || artist)) {
      try {
        const cleanTitle = title
          .replace(/Unknown artist/gi, "")
          .replace(/\[.*?\]|\(.*?\)/g, "")
          .replace(/\|.*/, "")
          .replace(/\.\.\./g, "")
          .trim();
        const cleanArtist = artist.replace(/Unknown artist/gi, "").trim();

        const query = `${cleanTitle} ${cleanArtist}`.trim();
        if (query) {
          console.log(`🔎 Stream proxy searching fallback query: "${query}"`);
          let freshAudioUrl = "";
          try {
            const freshLink = await resolveYoutubeMusicUrl(query);
            const freshSong = await parseMusicMedia(freshLink);
            freshAudioUrl = freshSong?.audioUrl || "";
          } catch {
            const searchRes = await searchStoryMusic(query, { relatedLimit: 0 });
            if (searchRes?.song?.audioUrl) {
              freshAudioUrl = searchRes.song.audioUrl;
            } else if (searchRes?.song?.sourceUrl) {
              const freshSong = await parseMusicMedia(searchRes.song.sourceUrl);
              freshAudioUrl = freshSong?.audioUrl || "";
            }
          }

          if (freshAudioUrl) {
            streamUrl = freshAudioUrl;
            const headers = {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
              Accept: "*/*",
            };
            if (req.headers.range) {
              headers["Range"] = req.headers.range;
            }
            const titleRes = await fetch(streamUrl, { headers });
            if (titleRes.ok || titleRes.status === 206) {
              response = titleRes;
            }
          }
        }
      } catch (err) {
        console.error("Title search stream fallback failed:", err.message);
      }
    }

    if (!response) {
      return res.status(502).json({ error: "Unable to stream audio resource" });
    }

    res.status(response.status);
    const passHeaders = ["content-type", "content-length", "content-range", "accept-ranges"];
    for (const h of passHeaders) {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    if (!res.getHeader("content-type")) {
      res.setHeader("content-type", "audio/mpeg");
    }

    const reader = response.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (e) {
        res.end();
      }
    };
    pump();
  } catch (error) {
    console.error("streamMusicProxy:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Audio proxy stream error" });
    }
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
