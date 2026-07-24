import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Music2,
  Pause,
  Play,
  Search,
  X,
  Clock,
  Trash2,
  ChevronLeft,
  Check,
  Sparkles,
} from "lucide-react";
import { useStoryMusicStore } from "../../store/useStoryMusicStore";
import { InstagramMusicSticker } from "../groupVibes/InstagramMusicSticker";
import toast from "react-hot-toast";
import "./storyMusic.css";

const CLIP_OPTIONS = [15, 30, 45, 60];
const STICKER_THEMES = ["classic", "rounded", "compact", "vinyl", "neon"];

function formatTime(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Compute a dynamic blurred background gradient based on song metadata */
function getSongGradient(song) {
  if (!song) {
    return {
      bg: "linear-gradient(145deg, #1e1b4b 0%, #0f172a 50%, #09090b 100%)",
      glow: "rgba(255, 45, 85, 0.3)",
      accent: "#ff2d55",
    };
  }
  const seed = song.id || song.title || "default";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 55 + (Math.abs(hash >> 3) % 70)) % 360;

  return {
    bg: `linear-gradient(155deg, hsl(${h1}, 75%, 15%) 0%, hsl(${h2}, 85%, 9%) 55%, #09090b 100%)`,
    glow: `hsla(${h1}, 90%, 55%, 0.4)`,
    accent: `hsl(${h1}, 95%, 60%)`,
  };
}

function SongRow({ song, onSelect, onPlay, playingId, loadingId, selected }) {
  const isPlaying = playingId === song.id;
  const isLoading = loadingId === song.id;

  return (
    <div className={`story-music-row ${selected ? "is-selected" : ""}`}>
      <button
        type="button"
        className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer group"
        disabled={isLoading}
        onClick={() => onSelect(song)}
      >
        <div className="relative shrink-0">
          <img
            className="story-music-cover"
            src={song.thumbnail || song.artwork || "/avatar.png"}
            alt={song.title}
            loading="lazy"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 h-full bg-rose-400 animate-eq-bar-1 rounded-full" />
                <span className="w-0.5 h-full bg-rose-400 animate-eq-bar-2 rounded-full" />
                <span className="w-0.5 h-full bg-rose-400 animate-eq-bar-3 rounded-full" />
              </div>
            </div>
          )}
        </div>
        <div className="story-music-meta">
          <p className="title block font-bold text-sm text-white truncate group-hover:text-rose-300 transition-colors">
            {song.title}
          </p>
          <p className="sub block text-xs text-white/60 truncate mt-0.5">
            {song.artist}
            {song.duration ? ` · ${formatTime(song.duration)}` : ""}
          </p>
        </div>
      </button>

      <button
        type="button"
        className="story-music-play"
        aria-label={isLoading ? "Loading" : isPlaying ? "Pause" : "Play"}
        disabled={isLoading}
        onClick={() => onPlay(song)}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 text-white fill-current" />
        ) : (
          <Play className="w-4 h-4 text-white fill-current translate-x-0.5" />
        )}
      </button>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 px-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="story-music-skel">
          <div className="box" />
          <div className="lines">
            <div className="line" />
            <div className="line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryMusicPicker() {
  const {
    isOpen,
    closePicker,
    query,
    searchDebounced,
    searching,
    results,
    related,
    trending,
    trendingLoading,
    recentSearches,
    recentlyPlayed,
    clearRecent,
    previewSong,
    setPreviewSong,
    clipDuration,
    startOffset,
    setClip,
    stickerTheme,
    setStickerTheme,
    confirmSelection,
    searchNow,
    pushRecent,
  } = useStoryMusicStore();

  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const scrubberRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const lastSeekTimeRef = useRef(0);
  const isSelfScrollingRef = useRef(false);

  // Dynamic color theme computed for the active preview song
  const activeGradient = useMemo(() => getSongGradient(previewSong), [previewSong]);

  // Generate waveform heights
  const timelineBars = useMemo(() => {
    if (!previewSong) return [];
    const seed = previewSong.id || "default";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const heights = [];
    for (let i = 0; i < 70; i++) {
      const angle = i * 0.25 + Math.abs(hash % 100);
      const h = 30 + Math.sin(angle) * 25 + Math.cos(angle * 0.4) * 20 + Math.abs((hash + i) % 25);
      heights.push(Math.min(95, Math.max(18, h)));
    }
    return heights;
  }, [previewSong]);

  const maxStart = useMemo(() => {
    if (!previewSong?.duration) return 120;
    return Math.max(0, previewSong.duration - clipDuration);
  }, [previewSong, clipDuration]);

  // Sync scroll position from store state
  useEffect(() => {
    const el = scrubberRef.current;
    if (!el || !maxStart) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;

    const targetScroll = (startOffset / maxStart) * maxScroll;

    if (Math.abs(el.scrollLeft - targetScroll) > 3) {
      isSelfScrollingRef.current = true;
      el.scrollLeft = targetScroll;
      const timer = setTimeout(() => {
        isSelfScrollingRef.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [startOffset, maxStart, clipDuration]);

  // Listen to native scroll events on the scrubber track
  useEffect(() => {
    const el = scrubberRef.current;
    if (!el) return;

    const onScroll = () => {
      if (isSelfScrollingRef.current || !maxStart) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;

      const pct = el.scrollLeft / maxScroll;
      const newStart = Math.min(maxStart, pct * maxStart);

      useStoryMusicStore.getState().setClip({
        startOffset: newStart,
        clipDuration,
      });

      const now = Date.now();
      if (now - lastSeekTimeRef.current > 80) {
        const a = audioRef.current;
        if (a && playingId === previewSong?.id) {
          a.currentTime = newStart;
        }
        lastSeekTimeRef.current = now;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [maxStart, clipDuration, playingId, previewSong]);

  // Mouse / touch drag handlers for track scrolling
  const handleMouseDown = (e) => {
    if (!scrubberRef.current) return;
    isDraggingRef.current = true;
    const pageX = e.touches ? e.touches[0].pageX : e.pageX;
    startXRef.current = pageX - scrubberRef.current.offsetLeft;
    startScrollLeftRef.current = scrubberRef.current.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !scrubberRef.current) return;
    const pageX = e.touches ? e.touches[0].pageX : e.pageX;
    const x = pageX - scrubberRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    scrubberRef.current.scrollLeft = startScrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPlaying(false);
    setPlayingId(null);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    if (!isOpen) stopAudio();
  }, [isOpen, stopAudio]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  // Loop within selected clip window while previewing
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !previewSong) return;
    const onTime = () => {
      const end = startOffset + clipDuration;
      if (a.currentTime >= end) {
        a.currentTime = startOffset;
      }
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [previewSong, startOffset, clipDuration]);

  const playSong = useCallback(
    async (song, { fromOffset } = {}) => {
      if (!song) return;

      if (query && query.trim()) {
        pushRecent(query);
      }

      let currentSong = song;
      if (!currentSong.audioUrl) {
        setLoadingId(song.id);
        try {
          const resolved = await useStoryMusicStore.getState().resolveSongAudio(song);
          if (!resolved?.audioUrl) {
            toast.error("Could not load audio for this song");
            return;
          }
          currentSong = resolved;
        } catch (err) {
          toast.error("Failed to load audio");
          return;
        } finally {
          setLoadingId(null);
        }
      }

      let a = audioRef.current;
      if (!a) {
        a = new Audio();
        a.preload = "auto";
        audioRef.current = a;
        a.addEventListener("timeupdate", () => setCurrentTime(a.currentTime || 0));
        a.addEventListener("ended", () => setPlaying(false));
        a.addEventListener("pause", () => setPlaying(false));
        a.addEventListener("play", () => setPlaying(true));
      }

      if (playingId === currentSong.id && !a.paused) {
        a.pause();
        return;
      }

      setPreviewSong(currentSong);
      setPlayingId(currentSong.id);
      a.src = currentSong.audioUrl;
      const start = fromOffset ?? startOffset;
      a.currentTime = Math.max(0, start);
      try {
        await a.play();
      } catch (e) {
        console.warn("preview play blocked:", e.message);
      }
    },
    [playingId, setPreviewSong, startOffset, query, pushRecent]
  );

  const onSelectSong = useCallback(
    async (song) => {
      if (query && query.trim()) {
        pushRecent(query);
      }

      let currentSong = song;
      if (!currentSong.audioUrl) {
        setLoadingId(song.id);
        try {
          const resolved = await useStoryMusicStore.getState().resolveSongAudio(song);
          if (!resolved?.audioUrl) {
            toast.error("Could not load audio for this song");
            return;
          }
          currentSong = resolved;
        } catch (err) {
          toast.error("Failed to load audio");
          return;
        } finally {
          setLoadingId(null);
        }
      }

      setPreviewSong(currentSong);
      const maxStart = Math.max(0, (currentSong.duration || 0) - clipDuration);
      const nextStart = Math.min(startOffset, maxStart);
      setClip({
        startOffset: nextStart,
        clipDuration,
      });
      playSong(currentSong, { fromOffset: nextStart });
    },
    [setPreviewSong, clipDuration, startOffset, setClip, playSong, query, pushRecent]
  );

  const handleUse = () => {
    stopAudio();
    confirmSelection();
  };

  const handleBackFromPreview = useCallback(() => {
    stopAudio();
    setPreviewSong(null);
  }, [stopAudio, setPreviewSong]);

  if (!isOpen) return null;

  const showBrowse = !query.trim() && !searching && !results.length;
  const playingKey = playing ? playingId : null;

  // Active music sticker object for live story preview
  const liveMusicObject = previewSong
    ? {
        ...previewSong,
        title: previewSong.title,
        artist: previewSong.artist,
        artwork: previewSong.thumbnail || previewSong.artwork,
        sticker: { theme: stickerTheme },
      }
    : null;

  return (
    <div className="story-music-sheet" role="dialog" aria-modal="true" aria-label="Add music">
      {/* Backdrop overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-2xl transition-opacity border-0"
        aria-label="Close"
        onClick={closePicker}
      />

      <div className="story-music-panel">
        <div className="story-music-handle" />

        {!previewSong ? (
          /* ==================================================================== */
          /* 1. BROWSE / SEARCH MUSIC VIEW (Instagram Native Header & List) */
          /* ==================================================================== */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="story-music-header">
              <div className="story-music-header-left">
                <ChevronLeft
                  className="w-6 h-6 text-white cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={closePicker}
                />
                <h3>Music</h3>
              </div>
              <Music2 className="w-5 h-5 text-rose-400 animate-pulse" />
            </header>

            {/* Search Bar */}
            <div className="story-music-search">
              <Search className="w-4 h-4" />
              <input
                value={query}
                onChange={(e) => searchDebounced(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    searchNow(query);
                    if (query && query.trim()) {
                      pushRecent(query);
                    }
                  }
                }}
                placeholder="Search music..."
                autoFocus
              />
              {query ? (
                <button
                  type="button"
                  className="story-music-search-clear"
                  onClick={() => searchDebounced("")}
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {/* Results / Browse Scroll Area */}
            <div className="story-music-body custom-scrollbar">
              {searching && <SkeletonRows />}

              {!searching && results.length > 0 && (
                <section className="story-music-section">
                  <h4>Results</h4>
                  {results.map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      onSelect={onSelectSong}
                      onPlay={(s) => playSong(s)}
                      playingId={playingKey}
                      loadingId={loadingId}
                      selected={false}
                    />
                  ))}
                </section>
              )}

              {!searching && related.length > 0 && (
                <section className="story-music-section">
                  <h4>Suggested</h4>
                  {related.map((song) => (
                    <SongRow
                      key={`rel-${song.id}`}
                      song={song}
                      onSelect={onSelectSong}
                      onPlay={(s) => playSong(s)}
                      playingId={playingKey}
                      loadingId={loadingId}
                      selected={false}
                    />
                  ))}
                </section>
              )}

              {showBrowse && (
                <>
                  {recentSearches.length > 0 && (
                    <section className="story-music-section">
                      <div className="story-music-section-head">
                        <h4>Recent Searches</h4>
                        <button type="button" className="story-music-clear-link" onClick={clearRecent}>
                          <Trash2 className="w-3 h-3" /> Clear
                        </button>
                      </div>
                      <div className="story-music-recent-row">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            className="story-music-chip"
                            onClick={() => {
                              searchDebounced(term);
                              searchNow(term);
                            }}
                          >
                            <Clock className="w-3 h-3 opacity-60" />
                            {term}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {recentlyPlayed.length > 0 && (
                    <section className="story-music-section">
                      <h4>Recently Played</h4>
                      {recentlyPlayed.slice(0, 6).map((song) => (
                        <SongRow
                          key={`played-${song.id}`}
                          song={song}
                          onSelect={onSelectSong}
                          onPlay={(s) => playSong(s)}
                          playingId={playingKey}
                          loadingId={loadingId}
                          selected={false}
                        />
                      ))}
                    </section>
                  )}

                  <section className="story-music-section">
                    <h4>Trending Songs</h4>
                    {trendingLoading && !trending.length ? <SkeletonRows /> : null}
                    {trending.map((song) => (
                      <SongRow
                        key={`trend-${song.id}`}
                        song={song}
                        onSelect={onSelectSong}
                        onPlay={(s) => playSong(s)}
                        playingId={playingKey}
                        loadingId={loadingId}
                        selected={false}
                      />
                    ))}
                    {!trendingLoading && !trending.length && (
                      <p className="story-music-empty">Search for a song to get started</p>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* 2. INSTAGRAM PREVIEW & TRIMMER VIEW (Dynamic Ambient Gradient) */
          /* ==================================================================== */
          <div
            className="relative flex flex-col flex-1 h-full overflow-y-auto custom-scrollbar select-none transition-colors duration-500"
            style={{ background: activeGradient.bg }}
          >
            {/* Ambient Background Glow Aura */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-60 transition-all duration-700"
              style={{ background: activeGradient.glow }}
            />

            {/* Top Navigation Header: ← Back, Music, [Space] */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
              <button
                type="button"
                className="flex items-center gap-1 text-white font-bold text-sm bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 border border-white/10 shadow-lg cursor-pointer"
                onClick={handleBackFromPreview}
                aria-label="Back to music search"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Back</span>
              </button>

              <span className="text-white font-extrabold text-base tracking-wide drop-shadow">
                Music
              </span>

              <div className="w-16" /> {/* Balance header spacing */}
            </div>

            {/* Main Center Content: Artwork & Song Meta */}
            <div className="relative z-10 flex flex-col items-center justify-center pt-4 px-6 text-center">
              {/* Album Artwork with Soft Aura & Floating Play Badge */}
              <div className="relative group cursor-pointer" onClick={() => playSong(previewSong)}>
                <img
                  className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/20 transition-transform duration-300 group-hover:scale-105"
                  src={previewSong.thumbnail || previewSong.artwork || "/avatar.png"}
                  alt={previewSong.title}
                />
                <button
                  type="button"
                  className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 active:scale-95"
                  aria-label={playing && playingId === previewSong.id ? "Pause" : "Play"}
                >
                  {playing && playingId === previewSong.id ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current translate-x-0.5" />
                  )}
                </button>
              </div>

              {/* Title & Artist */}
              <div className="mt-5 space-y-1 max-w-xs">
                <h2 className="text-xl font-black text-white tracking-tight leading-tight truncate drop-shadow-md">
                  {previewSong.title}
                </h2>
                <p className="text-sm font-semibold text-white/75 truncate drop-shadow">
                  {previewSong.artist}
                </p>
              </div>
            </div>

            {/* ==================================================================== */}
            {/* 3. INSTAGRAM WAVEFORM & CLIP SCRUBBER */}
            {/* ==================================================================== */}
            <div className="relative z-10 px-4 mt-6">
              <div
                className="instagram-scrubber-container relative"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUpOrLeave}
              >
                {/* Fixed Center Highlight Selection Window */}
                <div className="instagram-scrubber-window shadow-[0_0_20px_rgba(255,45,85,0.4)]" />

                {/* Scrollable Waveform Bar Track */}
                <div className="instagram-scrubber-track" ref={scrubberRef}>
                  {/* Left 50% Spacer */}
                  <div style={{ minWidth: "50%", flexShrink: 0 }} />

                  {/* Waveform bars */}
                  {timelineBars.map((h, i) => {
                    const barTime = (i / timelineBars.length) * (previewSong.duration || 120);
                    const isActive = barTime >= startOffset && barTime <= startOffset + clipDuration;
                    const isPlayed = isActive && barTime < currentTime;

                    return (
                      <div
                        key={i}
                        className={`instagram-scrubber-bar ${
                          isPlayed ? "is-played" : isActive ? "is-active" : ""
                        }`}
                        style={{
                          height: `${h}%`,
                        }}
                      />
                    );
                  })}

                  {/* Right 50% Spacer */}
                  <div style={{ minWidth: "50%", flexShrink: 0 }} />
                </div>
              </div>

              {/* Clip Timestamp details */}
              <div className="flex justify-between items-center px-2 mt-2 text-xs text-white/70 font-medium">
                <span>{formatTime(startOffset)}</span>
                <span className="text-[11px] font-bold text-white bg-white/15 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 uppercase tracking-wider">
                  Clip: {formatTime(startOffset)} → {formatTime(startOffset + clipDuration)}
                </span>
                <span>{formatTime(previewSong.duration || 120)}</span>
              </div>
            </div>

            {/* ==================================================================== */}
            {/* 4. LIVE STORY STICKER PREVIEW & THEME SWITCHER */}
            {/* ==================================================================== */}
            <div className="relative z-10 px-6 mt-6 flex flex-col items-center">
              <span className="text-[10px] font-extrabold text-white/60 uppercase tracking-widest mb-3">
                Live Story Sticker Preview
              </span>

              {/* Dynamic Live Sticker Component Rendering */}
              <div className="p-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 shadow-xl transition-all duration-300 transform hover:scale-105">
                <InstagramMusicSticker music={liveMusicObject} isPlaying={playing} />
              </div>

              {/* Sticker Style Selector Segmented Control */}
              <div className="flex items-center justify-center gap-2 mt-4 flex-wrap max-w-sm">
                {STICKER_THEMES.map((theme) => {
                  const isSelected = stickerTheme === theme;
                  return (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setStickerTheme(theme)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all duration-200 cursor-pointer shadow-md ${
                        isSelected
                          ? "bg-white text-black scale-105 ring-2 ring-rose-400 shadow-rose-500/20"
                          : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/10"
                      }`}
                    >
                      {theme}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ==================================================================== */}
            {/* 5. SEGMENTED DURATION PICKER */}
            {/* ==================================================================== */}
            <div className="relative z-10 px-6 mt-6 flex flex-col items-center">
              <span className="text-[10px] font-extrabold text-white/60 uppercase tracking-widest mb-2.5">
                Clip Duration
              </span>

              <div className="flex items-center p-1 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 shadow-inner">
                {CLIP_OPTIONS.map((sec) => {
                  const isSelected = clipDuration === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        const nextMax = Math.max(0, (previewSong.duration || 120) - sec);
                        setClip({
                          clipDuration: sec,
                          startOffset: Math.min(startOffset, nextMax),
                        });
                      }}
                      className={`px-5 py-1.5 rounded-full text-xs font-black transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg scale-105"
                          : "text-white/70 hover:text-white"
                      }`}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ==================================================================== */}
            {/* 6. STICKY BOTTOM ACTION (Instagram "Done" Button) */}
            {/* ==================================================================== */}
            <div className="sticky bottom-0 z-20 p-5 mt-8 bg-gradient-to-t from-black via-black/80 to-transparent">
              <button
                type="button"
                onClick={handleUse}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white font-black text-base shadow-[0_10px_30px_rgba(255,45,85,0.4)] transition-all duration-200 active:scale-95 hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Done</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StoryMusicPicker);
