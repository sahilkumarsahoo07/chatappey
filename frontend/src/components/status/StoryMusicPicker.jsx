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
import "./storyMusic.css";

const CLIP_OPTIONS = [5, 10, 15, 20, 30];
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

function SongRow({ song, onSelect, onPlay, playingId, selected }) {
  const isPlaying = playingId === song.id;
  return (
    <div className={`story-music-row${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={() => onPlay(song)}
      >
        {isPlaying ? (
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
  } = useStoryMusicStore();

  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playingId, setPlayingId] = useState(null);

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
      if (!song?.audioUrl) return;
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

      if (playingId === song.id && !a.paused) {
        a.pause();
        return;
      }

      setPreviewSong(song);
      setPlayingId(song.id);
      a.src = song.audioUrl;
      const start = fromOffset ?? startOffset;
      a.currentTime = Math.max(0, start);
      try {
        await a.play();
      } catch (e) {
        console.warn("preview play blocked:", e.message);
      }
    },
    [playingId, setPreviewSong, startOffset]
  );

  const onSelectSong = useCallback(
    (song) => {
      setPreviewSong(song);
      const maxStart = Math.max(0, (song.duration || 0) - clipDuration);
      const nextStart = Math.min(startOffset, maxStart);
      setClip({
        startOffset: nextStart,
        clipDuration,
      });
      playSong(song, { fromOffset: nextStart });
    },
    [setPreviewSong, clipDuration, startOffset, setClip, playSong]
  );

  const maxStart = useMemo(() => {
    if (!previewSong?.duration) return 120;
    return Math.max(0, previewSong.duration - clipDuration);
  }, [previewSong, clipDuration]);

  const sliderProgress = useMemo(() => {
    if (!maxStart) return 0;
    return Math.min(100, (startOffset / maxStart) * 100);
  }, [startOffset, maxStart]);

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
              if (e.key === "Enter") searchNow(query);
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
                  selected={previewSong?.id === song.id}
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
                  selected={previewSong?.id === song.id}
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
                  <div className="flex flex-wrap px-4">
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
                      selected={previewSong?.id === song.id}
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
                    selected={previewSong?.id === song.id}
                  />
                ))}
                {!trendingLoading && !trending.length && (
                  <p className="story-music-empty">Search for a song to get started</p>
                )}
              </section>
            </>
          )}
        </div>

        {previewSong && (
          <div className="story-music-preview">
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
                onClick={handleBackFromPreview}
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="story-music-preview-top">
              <img
                className="story-music-cover"
                src={previewSong.thumbnail || "/avatar.png"}
                alt=""
              />
              <div className="story-music-meta">
                <div className="title">{previewSong.title}</div>
                <div className="sub">{previewSong.artist}</div>
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

            <div
              className={`story-music-wave${playing && playingId === previewSong.id ? "" : " is-paused"}`}
            >
              {WAVE_BARS.map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>

            <div className="story-music-times">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(previewSong.duration || 0)}</span>
            </div>

            <div className="story-music-clips">
              {CLIP_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={clipDuration === sec ? "is-active" : ""}
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

            <div className="story-music-trim">
              <div className="story-music-trim-label">
                <span>Clip start</span>
                <strong>
                  {formatTime(startOffset)} → {formatTime(startOffset + clipDuration)}
                </strong>
              </div>
              <input
                className="story-music-progress"
                type="range"
                min={0}
                max={maxStart || 1}
                step={0.1}
                value={Math.min(startOffset, maxStart)}
                style={{ "--progress": `${sliderProgress}%` }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setClip({ startOffset: v, clipDuration });
                  const a = audioRef.current;
                  if (a && playingId === previewSong.id) {
                    a.currentTime = v;
                  }
                }}
              />
            </div>

            <div className="story-music-clips">
              {STICKER_THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={stickerTheme === theme ? "is-active" : ""}
                  onClick={() => setStickerTheme(theme)}
                >
                  {theme}
                </button>
              ))}
            </div>

            <button type="button" className="story-music-use" onClick={handleUse}>
              Use music
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StoryMusicPicker);
