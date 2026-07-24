import { parseStoryMusicApi } from "./storyMusicApi";

class GroupVibePreloader {
  constructor() {
    this.audioCache = new Map(); // url -> Audio element
    this.imageCache = new Map(); // url -> HTMLImageElement
    this.urlResolutionCache = new Map(); // sourceUrl -> resolvedAudioUrl
    this.activePreloads = new Set();
  }

  isExpired(url) {
    if (!url) return true;
    try {
      const u = new URL(url);
      const expire = u.searchParams.get("expire");
      if (expire) {
        return Date.now() >= Number(expire) * 1000 - 30000;
      }
    } catch (e) {}
    return false;
  }

  async resolveAudioUrl(vibe) {
    if (!vibe?.music) return null;
    const { audioUrl, sourceUrl } = vibe.music;

    if (audioUrl && !this.isExpired(audioUrl)) {
      return audioUrl;
    }

    if (sourceUrl) {
      if (this.urlResolutionCache.has(sourceUrl)) {
        return this.urlResolutionCache.get(sourceUrl);
      }
      try {
        const data = await parseStoryMusicApi(sourceUrl);
        if (data?.song?.audioUrl) {
          this.urlResolutionCache.set(sourceUrl, data.song.audioUrl);
          return data.song.audioUrl;
        }
      } catch (e) {
        console.warn("Preloader failed to resolve audio:", e);
      }
    }

    return audioUrl || null;
  }

  async preloadVibe(vibe) {
    if (!vibe || !vibe._id || this.activePreloads.has(vibe._id)) return;
    this.activePreloads.add(vibe._id);

    try {
      // 1. Preload Media (Image/Video)
      if (vibe.mediaType === "photo" && vibe.mediaUrl) {
        if (!this.imageCache.has(vibe.mediaUrl)) {
          const img = new Image();
          img.src = vibe.mediaUrl;
          this.imageCache.set(vibe.mediaUrl, img);
        }
      } else if (vibe.mediaType === "video" && vibe.mediaUrl) {
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.src = vibe.mediaUrl;
      }

      // 2. Preload & Resolve Audio
      if (vibe.music) {
        const resolvedUrl = await this.resolveAudioUrl(vibe);
        if (resolvedUrl && !this.audioCache.has(resolvedUrl)) {
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = resolvedUrl;
          this.audioCache.set(resolvedUrl, audio);
        }
      }
    } catch (e) {
      console.warn("preloadVibe error:", e);
    } finally {
      this.activePreloads.delete(vibe._id);
    }
  }

  preloadNeighbors(vibes, currentIndex) {
    if (!vibes || !vibes.length) return;

    // Current vibe
    const current = vibes[currentIndex];
    if (current) this.preloadVibe(current);

    // Next vibe
    const next = vibes[currentIndex + 1];
    if (next) this.preloadVibe(next);

    // Previous vibe
    const prev = vibes[currentIndex - 1];
    if (prev) this.preloadVibe(prev);

    // Cap cache sizes to avoid memory leaks over 100+ views
    if (this.imageCache.size > 20) {
      const first = this.imageCache.keys().next().value;
      this.imageCache.delete(first);
    }
    if (this.audioCache.size > 15) {
      const first = this.audioCache.keys().next().value;
      const audio = this.audioCache.get(first);
      if (audio) {
        try {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        } catch (e) {}
      }
      this.audioCache.delete(first);
    }
  }

  clear() {
    this.imageCache.clear();
    for (const [, audio] of this.audioCache) {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch (e) {}
    }
    this.audioCache.clear();
    this.urlResolutionCache.clear();
    this.activePreloads.clear();
  }
}

export const groupVibePreloader = new GroupVibePreloader();
