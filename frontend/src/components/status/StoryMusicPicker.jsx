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
} from "lucide-react";
import { useStoryMusicStore } from "../../store/useStoryMusicStore";
import toast from "react-hot-toast";
import "./storyMusic.css";

const CLIP_OPTIONS = [30, 40, 50, 60];
const STICKER_THEMES = ["classic", "dark", "neon", "minimal"];
const WAVE_BARS = [
  28, 52, 78, 44, 90, 60, 36, 72, 48, 84, 40, 66, 92, 50, 34, 70, 58, 86, 42, 76,
  54, 88, 38, 64, 80, 46, 74, 56, 82, 62,
];

function formatTime(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function SongRow({ song, onSelect, onPlay, playingId, loadingId, selected }) {
  const isPlaying = playingId === song.id;
  const isLoading = loadingId === song.id;
  return (
    <div className={`story-music-row${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        disabled={isLoading}
        onClick={() => onSelect(song)}
      >
        <img
          className="story-music-cover"
          src={song.thumbnail || "/avatar.png"}
          alt=""
          loading="lazy"
        />
        <span className="story-music-meta">
          <span className="title block">{song.title}</span>
          <span className="sub block">
            {song.artist}
            {song.duration ? ` · ${formatTime(song.duration)}` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="story-music-play"
        aria-label={isLoading ? "Loading" : isPlaying ? "Pause" : "Play"}
        disabled={isLoading}
        onClick={() => onPlay(song)}
      >
        {isLoading ? (
          <span className="loading loading-spinner loading-xs text-white" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" fill="currentColor" />
        ) : (
          <Play className="w-4 h-4" fill="currentColor" />
        )}
      </button>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="story-music-skel">
          <div className="box" />
          <div className="lines">
            <div className="line" />
            <div className="line short" />
          </div>
        </div>
      ))}
    </>
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

  const timelineBars = useMemo(() => {
    if (!previewSong) return [];
    const seed = previewSong.id || "default";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const heights = [];
    for (let i = 0; i < 80; i++) {
      const angle = i * 0.2 + Math.abs(hash % 100);
      const h = 25 + Math.sin(angle) * 20 + Math.cos(angle * 0.5) * 15 + Math.abs((hash + i) % 30);
      heights.push(Math.min(90, Math.max(15, h)));
    }
    return heights;
  }, [previewSong]);

  const maxStart = useMemo(() => {
    if (!previewSong?.duration) return 120;
    return Math.max(0, previewSong.duration - clipDuration);
  }, [previewSong, clipDuration]);

  const sliderProgress = useMemo(() => {
    if (!maxStart) return 0;
    return Math.min(100, (startOffset / maxStart) * 100);
  }, [startOffset, maxStart]);

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

      // Trigger store clip update
      useStoryMusicStore.getState().setClip({
        startOffset: newStart,
        clipDuration,
      });

      // Seek audio
      const now = Date.now();
      if (now - lastSeekTimeRef.current > 80) {
        const a = audioRef.current;
        if (a && playingId === previewSong?.id) {
          a.currentTime = newStart;
        }
        lastSeekTimeRef.current = now;
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [maxStart, clipDuration, playingId, previewSong]);

  // Mouse drag handlers to support scrolling on desktop
  const handleMouseDown = (e) => {
    if (!scrubberRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - scrubberRef.current.offsetLeft;
    startScrollLeftRef.current = scrubberRef.current.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !scrubberRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrubberRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    scrubberRef.current.scrollLeft = startScrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleCycleDuration = useCallback(() => {
    if (!previewSong) return;
    const currentIndex = CLIP_OPTIONS.indexOf(clipDuration);
    const nextIndex = (currentIndex + 1) % CLIP_OPTIONS.length;
    const nextDuration = CLIP_OPTIONS[nextIndex];
    const nextMax = Math.max(0, (previewSong.duration || 0) - nextDuration);
    setClip({
      clipDuration: nextDuration,
      startOffset: Math.min(startOffset, nextMax),
    });
  }, [clipDuration, startOffset, previewSong, setClip]);

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

  // Loop within selected clip while previewing (Instagram-style)
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

  return (
    <div className="story-music-sheet" role="dialog" aria-modal="true" aria-label="Add music">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={closePicker} />
      <div className="story-music-panel">
        {!previewSong ? (
          <>
            <header className="story-music-header">
              <div className="story-music-header-left">
                <Music2 className="story-music-header-icon" strokeWidth={2.25} />
                <h3>Add music</h3>
              </div>
              <button type="button" className="story-music-close" onClick={closePicker} aria-label="Close">
                <X className="w-5 h-5" strokeWidth={2.25} />
              </button>
            </header>

            <div className="story-music-search">
              <Search className="w-4 h-4" strokeWidth={2.25} />
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
                placeholder="Search"
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

            <div className="story-music-body">
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
                        <h4 className="!p-0 !mb-0">Recent searches</h4>
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
                      <h4>Recently played</h4>
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
                    <h4>Trending</h4>
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
          </>
        ) : (
          /* PREVIEW / EDITOR MODE (Fully cloned from Instagram UI) */
          <div className="story-music-preview flex flex-col flex-1 h-full justify-between">
            <div>
              <div className="story-music-preview-bar">
                <button
                  type="button"
                  className="story-music-back"
                  onClick={handleBackFromPreview}
                  aria-label="Back"
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  className="story-music-preview-dismiss"
                  onClick={closePicker}
                  aria-label="Close picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="story-music-preview-top mt-4">
                <img
                  className="story-music-cover"
                  src={previewSong.thumbnail || "/avatar.png"}
                  alt=""
                />
                <div className="story-music-meta">
                  <div className="title text-base font-bold">{previewSong.title}</div>
                  <div className="sub text-sm">{previewSong.artist}</div>
                </div>
                <button
                  type="button"
                  className="story-music-play"
                  onClick={() => playSong(previewSong)}
                  aria-label={playing && playingId === previewSong.id ? "Pause" : "Play"}
                >
                  {playing && playingId === previewSong.id ? (
                    <Pause className="w-4 h-4" fill="currentColor" />
                  ) : (
                    <Play className="w-4 h-4" fill="currentColor" />
                  )}
                </button>
              </div>

              {/* Instagram-Style Interactive Scrubber Container */}
              <div
                className="instagram-scrubber-container"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                {/* Fixed Center Highlight Window */}
                <div className="instagram-scrubber-window" />

                {/* Scrollable Waveform Track */}
                <div className="instagram-scrubber-track" ref={scrubberRef}>
                  {/* Left padding spacer (50% width to allow first bar to start at center) */}
                  <div style={{ minWidth: "50%", flexShrink: 0 }} />

                  {/* Waveform bars */}
                  {timelineBars.map((h, i) => {
                    const barTime = (i / timelineBars.length) * (previewSong.duration || 120);
                    // Is the bar within the active selected segment?
                    const isActive = barTime >= startOffset && barTime <= (startOffset + clipDuration);
                    // Has this part of the selected segment already played?
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

                  {/* Right padding spacer (50% width to allow last bar to end at center) */}
                  <div style={{ minWidth: "50%", flexShrink: 0 }} />
                </div>
              </div>

              {/* Selection Info details below Scrubber */}
              <div className="flex justify-between items-center px-1 text-xs text-gray-400 font-semibold mb-6">
                <span>{formatTime(currentTime)}</span>
                <span className="text-white bg-white/10 px-3 py-1 rounded-full font-variant-numeric: tabular-nums text-[11px] tracking-wider uppercase">
                  Clip: {formatTime(startOffset)} → {formatTime(startOffset + clipDuration)}
                </span>
                <span>{formatTime(previewSong.duration || 0)}</span>
              </div>
            </div>

            {/* Structured action panel containing duration & sticker theme selectors to prevent overlap */}
            <div className="flex flex-col gap-5 mt-auto pb-4 pt-2 border-t border-white/5">
              {/* Duration selector */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Select Clip Duration</span>
                <div className="story-music-clips flex items-center justify-center gap-3">
                  {CLIP_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className={`story-music-clip-btn ${clipDuration === sec ? "is-active" : ""}`}
                      onClick={() => {
                        const nextMax = Math.max(0, (previewSong.duration || 0) - sec);
                        setClip({
                          clipDuration: sec,
                          startOffset: Math.min(startOffset, nextMax),
                        });
                      }}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme selector */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Select Sticker Theme</span>
                <div className="story-music-sticker-themes flex items-center justify-center gap-3">
                  {STICKER_THEMES.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={`story-music-theme-btn ${stickerTheme === theme ? "is-active" : ""}`}
                      onClick={() => setStickerTheme(theme)}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" className="story-music-use mt-2" onClick={handleUse}>
                Use music
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StoryMusicPicker);
