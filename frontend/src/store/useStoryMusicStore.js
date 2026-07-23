import { create } from "zustand";
import {
  searchStoryMusicApi,
  fetchTrendingMusicApi,
  parseStoryMusicApi,
} from "../lib/storyMusicApi";

const RECENT_KEY = "chatappey_story_music_recent_v1";
const PLAYED_KEY = "chatappey_story_music_played_v1";
const TREND_CACHE_KEY = "chatappey_story_music_trend_v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

let searchAbort = null;
let debounceTimer = null;
const searchMemCache = new Map();
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const resolvingMap = new Map();

function getCachedSearch(q) {
  const hit = searchMemCache.get(q.toLowerCase());
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) {
    searchMemCache.delete(q.toLowerCase());
    return null;
  }
  return hit.data;
}

function setCachedSearch(q, data) {
  searchMemCache.set(q.toLowerCase(), { at: Date.now(), data });
  if (searchMemCache.size > 40) {
    const first = searchMemCache.keys().next().value;
    searchMemCache.delete(first);
  }
}

export const useStoryMusicStore = create((set, get) => ({
  isOpen: false,
  query: "",
  searching: false,
  searchError: null,
  results: [],
  related: [],
  trending: readJson(TREND_CACHE_KEY, [])?.results || [],
  trendingLoading: false,
  recentSearches: readJson(RECENT_KEY, []),
  recentlyPlayed: readJson(PLAYED_KEY, []),
  selectedSong: null,
  previewSong: null,
  clipDuration: 30,
  startOffset: 0,
  stickerTheme: "classic",

  openPicker: () => {
    set({ isOpen: true, searchError: null });
    get().loadTrending();
  },

  closePicker: () => {
    if (searchAbort) searchAbort.abort();
    set({
      isOpen: false,
      searching: false,
      query: "",
      results: [],
      related: [],
      previewSong: null,
      clipDuration: 30,
      startOffset: 0,
      stickerTheme: "classic",
    });
  },

  setQuery: (query) => set({ query }),

  clearRecent: () => {
    writeJson(RECENT_KEY, []);
    set({ recentSearches: [] });
  },

  pushRecent: (term) => {
    const t = String(term || "").trim();
    if (!t) return;
    const next = [t, ...get().recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 20);
    writeJson(RECENT_KEY, next);
    set({ recentSearches: next });
  },

  pushPlayed: (song) => {
    if (!song?.id) return;
    const next = [
      song,
      ...get().recentlyPlayed.filter((s) => s.id !== song.id),
    ].slice(0, 20);
    writeJson(PLAYED_KEY, next);
    set({ recentlyPlayed: next });
  },

  loadTrending: async () => {
    if (get().trendingLoading) return;
    const cached = readJson(TREND_CACHE_KEY, null);
    if (cached?.results?.length && Date.now() - (cached.at || 0) < 30 * 60 * 1000) {
      set({ trending: cached.results });
      get().preloadResultAudios(cached.results);
      return;
    }
    set({ trendingLoading: true });
    try {
      const data = await fetchTrendingMusicApi();
      const results = data.results || [];
      writeJson(TREND_CACHE_KEY, { at: Date.now(), results });
      set({ trending: results });
      get().preloadResultAudios(results);
    } catch (e) {
      console.warn("trending music:", e.message);
    } finally {
      set({ trendingLoading: false });
    }
  },

  searchDebounced: (rawQuery) => {
    const query = String(rawQuery || "").trim();
    set({ query: rawQuery });
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!query) {
      if (searchAbort) searchAbort.abort();
      set({ results: [], related: [], searching: false, searchError: null });
      return;
    }

    // Instant paint from memory cache while typing
    const cached = getCachedSearch(query);
    if (cached) {
      const results = cached.results || (cached.song ? [cached.song] : []);
      set({
        results,
        related: cached.related || [],
        searching: false,
        searchError: null,
      });
      get().preloadResultAudios(results);
      return;
    }

    // Show skeleton immediately (don't wait for debounce to feel stuck)
    set({ searching: true, searchError: null });

    debounceTimer = setTimeout(() => {
      get().searchNow(query);
    }, 180);
  },

  searchNow: async (query) => {
    const q = String(query || "").trim();
    if (!q) return;

    const cached = getCachedSearch(q);
    if (cached) {
      const results = cached.results || (cached.song ? [cached.song] : []);
      set({
        results,
        related: cached.related || [],
        searching: false,
        searchError: null,
      });
      get().preloadResultAudios(results);
      return;
    }

    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    const { signal } = searchAbort;

    set({ searching: true, searchError: null });

    try {
      const data = await searchStoryMusicApi(q, { signal });
      // Ignore stale responses if user typed something else
      if (get().query.trim().toLowerCase() !== q.toLowerCase()) return;

      let results = data.results || (data.song ? [data.song] : []);
      // If API returned nothing, quietly show trending / recently played instead of an error
      if (!results.length) {
        const { trending, recentlyPlayed } = get();
        results = [...(trending || []), ...(recentlyPlayed || [])]
          .filter((s, i, arr) => s?.id && arr.findIndex((x) => x.id === s.id) === i)
          .slice(0, 8);
      }

      setCachedSearch(q, { ...data, results });
      set({
        results,
        related: data.related || [],
        searching: false,
        searchError: null,
      });
      get().preloadResultAudios(results);
    } catch (e) {
      if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || signal.aborted) return;
      if (get().query.trim().toLowerCase() !== q.toLowerCase()) return;

      // Never surface error banner — fill with other songs
      const { trending, recentlyPlayed } = get();
      const results = [...(trending || []), ...(recentlyPlayed || [])]
        .filter((s, i, arr) => s?.id && arr.findIndex((x) => x.id === s.id) === i)
        .slice(0, 8);

      set({
        searching: false,
        searchError: null,
        results,
        related: [],
      });
      get().preloadResultAudios(results);
    }
  },

  setPreviewSong: (song) => {
    set({ previewSong: song });
    if (song) get().pushPlayed(song);
  },

  setClip: (patch) => {
    const current = get();
    const nextStart = patch.startOffset !== undefined ? Math.max(0, Number(patch.startOffset) || 0) : current.startOffset;
    const nextDuration = patch.clipDuration !== undefined ? Math.min(60, Math.max(5, Number(patch.clipDuration) || 30)) : current.clipDuration;
    set({
      startOffset: nextStart,
      clipDuration: nextDuration,
    });
  },

  setStickerTheme: (theme) => set({ stickerTheme: theme }),

  confirmSelection: () => {
    const { previewSong, startOffset, clipDuration, stickerTheme } = get();
    if (!previewSong) return null;
    const song = {
      ...previewSong,
      startOffset,
      clipStart: startOffset,
      clipDuration,
      sticker: {
        x: 0.5,
        y: 0.72,
        scale: 1,
        rotation: 0,
        theme: stickerTheme,
      },
    };
    set({
      selectedSong: song,
      isOpen: false,
      searching: false,
      query: "",
      results: [],
      related: [],
      previewSong: null,
      clipDuration: 30,
      startOffset: 0,
      stickerTheme: "classic",
    });
    return song;
  },

  clearSelected: () => set({ selectedSong: null, previewSong: null }),
  clearSong: () => set({ selectedSong: null, previewSong: null }),

  updateSelectedSticker: (patch) => {
    const cur = get().selectedSong;
    if (!cur) return;
    set({
      selectedSong: {
        ...cur,
        sticker: { ...cur.sticker, ...patch },
      },
    });
  },

  /** Re-parse a known youtube music link if audio URL expired */
  refreshSongAudio: async (song) => {
    if (!song?.sourceUrl) return song;
    try {
      const data = await parseStoryMusicApi(song.sourceUrl);
      return { ...song, ...data.song, sticker: song.sticker };
    } catch {
      return song;
    }
  },

  /** Resolve audioUrl for a song on-demand when starting play or preview */
  resolveSongAudio: async (song) => {
    if (!song) return null;
    if (song.audioUrl) return song;

    const cacheKey = song.id;
    if (resolvingMap.has(cacheKey)) {
      return resolvingMap.get(cacheKey);
    }

    const promise = (async () => {
      try {
        const data = await parseStoryMusicApi(song.sourceUrl);
        if (data?.song) {
          const resolvedSong = { ...song, ...data.song };
          set((state) => {
            const updateList = (list) =>
              list.map((s) => (s?.id === song.id ? resolvedSong : s));
            return {
              results: updateList(state.results),
              related: updateList(state.related),
              trending: updateList(state.trending),
              recentlyPlayed: updateList(state.recentlyPlayed),
              previewSong: state.previewSong?.id === song.id ? resolvedSong : state.previewSong,
              selectedSong: state.selectedSong?.id === song.id ? resolvedSong : state.selectedSong,
            };
          });
          return resolvedSong;
        }
      } catch (e) {
        console.warn("Failed to resolve song audio:", e);
        throw e;
      } finally {
        resolvingMap.delete(cacheKey);
      }
      return song;
    })();

    resolvingMap.set(cacheKey, promise);
    return promise;
  },

  preloadResultAudios: async (songs) => {
    if (!songs || !songs.length) return;
    const targets = songs.slice(0, 3).filter((s) => s && !s.audioUrl);
    for (const song of targets) {
      try {
        await get().resolveSongAudio(song);
      } catch (e) {
        // ignore preload errors silently
      }
    }
  },

  reset: () => {
    if (searchAbort) searchAbort.abort();
    set({
      isOpen: false,
      query: "",
      searching: false,
      searchError: null,
      results: [],
      related: [],
      trending: [],
      trendingLoading: false,
      recentSearches: [],
      recentlyPlayed: [],
      selectedSong: null,
      previewSong: null,
      clipDuration: 30,
      startOffset: 0,
      stickerTheme: "classic",
    });
  },
}));
