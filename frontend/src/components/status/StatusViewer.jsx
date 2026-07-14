import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Volume2,
  VolumeX,
  Pause,
} from "lucide-react";
import { useStatusStore } from "../../store/useStatusStore";
import { useAuthStore } from "../../store/useAuthStore";
import { formatStatusTime } from "../../hooks/useStoryProgress";
import defaultImg from "../../public/avatar.png";
import StatusEngagementBar from "./StatusEngagementBar";
import StatusInsightsSheet from "./StatusInsightsSheet";
import StoryReactionOverlay from "./StoryReactionOverlay";
import StoryOwnerBar from "./StoryOwnerBar";
import { useStoryReactionFx } from "../../hooks/useStoryReactionFx";
import { haptic } from "../../lib/haptics";
import { buildQualityUrl, selectFastestMediaUrl } from "../../lib/mediaDelivery";
import DoubleTapLike from "../DoubleTapLike";
import MusicSticker from "./MusicSticker";
import { parseStoryMusicApi } from "../../lib/storyMusicApi";
import "./storyMusic.css";

const IMAGE_MS = 5000;
const HOLD_MS = 180; // distinguish tap vs hold
const SWIPE_PX = 56;

const musicRefreshedSet = new Set();

function isAudioUrlExpired(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    const expire = u.searchParams.get("expire");
    if (expire) {
      const expireTimeMs = Number(expire) * 1000;
      return Date.now() >= (expireTimeMs - 30000);
    }
  } catch (e) {}
  return false;
}

/**
 * Full-screen WhatsApp-style story viewer.
 */
function StatusViewer() {
  const authUser = useAuthStore((s) => s.authUser);
  const {
    isViewerOpen,
    viewerGroups,
    viewerGroupIndex,
    viewerStatusIndex,
    closeViewer,
    setViewerIndices,
    markViewed,
    deleteStatus,
    openViewersPanel,
    showViewersPanel,
    viewersList,
    likesList,
    reactionsList,
    commentsList,
    insightsTab,
    setInsightsTab,
    isViewersLoading,
    closeViewersPanel,
    openCreate,
    toggleLike,
    reactToStatus,
    loadComments,
    addComment,
    removeComment,
  } = useStatusStore();

  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [musicLoading, setMusicLoading] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [entering, setEntering] = useState(true);
  const [mediaSrc, setMediaSrc] = useState("");

  const videoRef = useRef(null);
  const musicRef = useRef(null);
  const mediaStageRef = useRef(null);
  const holdingRef = useRef(false);
  const holdTimerRef = useRef(null);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const viewedSet = useRef(new Set());
  const preloaded = useRef(new Set());
  const closingEndRef = useRef(false);

  const group = viewerGroups[viewerGroupIndex];
  const status = group?.statuses?.[viewerStatusIndex];
  const isOwn = !!(group?.isOwn || group?.user?._id === authUser?._id);
  const isVideo = status?.mediaType === "video";
  const hasMusic = !!(status?.music?.audioUrl);

  const { particles, centerHeart, removeParticle } = useStoryReactionFx({
    enabled: isOwn && isViewerOpen && !!status?._id,
    statusId: status?._id,
  });

  const reactionSummary = status?.reactionSummary || {};
  const durationMs = isVideo
    ? Math.min(30000, Math.max(500, (status?.duration || 5) * 1000))
    : Math.min(
        30000,
        Math.max(
          IMAGE_MS,
          (status?.music?.clipDuration || status?.duration || 5) * 1000
        )
      );

  const totalGroups = viewerGroups.length;
  const totalInGroup = group?.statuses?.length || 0;

  const goNext = useCallback(() => {
    haptic("storyNav");
    if (!group) return;
    if (viewerStatusIndex < totalInGroup - 1) {
      setViewerIndices(viewerGroupIndex, viewerStatusIndex + 1);
      return;
    }
    if (viewerGroupIndex < totalGroups - 1) {
      setViewerIndices(viewerGroupIndex + 1, 0);
      return;
    }
    // End of all stories → close (WhatsApp behavior)
    if (!closingEndRef.current) {
      closingEndRef.current = true;
      closeViewer();
    }
  }, [
    group,
    viewerStatusIndex,
    totalInGroup,
    viewerGroupIndex,
    totalGroups,
    setViewerIndices,
    closeViewer,
  ]);

  const goPrev = useCallback(() => {
    haptic("storyNav");
    if (viewerStatusIndex > 0) {
      setViewerIndices(viewerGroupIndex, viewerStatusIndex - 1);
      return;
    }
    if (viewerGroupIndex > 0) {
      const prevGroup = viewerGroups[viewerGroupIndex - 1];
      const lastIdx = Math.max(0, (prevGroup?.statuses?.length || 1) - 1);
      setViewerIndices(viewerGroupIndex - 1, lastIdx);
    } else {
      // Restart current story timer
      elapsedRef.current = 0;
      startRef.current = performance.now();
      setProgress(0);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [viewerStatusIndex, viewerGroupIndex, viewerGroups, setViewerIndices]);

  // Open animation
  useEffect(() => {
    if (!isViewerOpen) return;
    setEntering(true);
    closingEndRef.current = false;
    const t = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(t);
  }, [isViewerOpen]);

  // Reset when story changes
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
    holdingRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setMediaReady(false);
    setMediaLoading(true);
    setMusicLoading(false);
    setMediaError(false);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Use original URL immediately so stories never stick on a blank/loading state
    // while CDN probing runs. Videos must not get image transforms applied.
    if (status?.mediaUrl) {
      const immediate = buildQualityUrl(status.mediaUrl, undefined, {
        isVideo: status.mediaType === "video",
      });
      setMediaSrc(immediate || status.mediaUrl);
    } else {
      setMediaSrc("");
    }

    let cancelled = false;
    (async () => {
      if (!status?.mediaUrl || status.mediaType === "video") return;
      const qualityUrl = buildQualityUrl(status.mediaUrl);
      try {
        const best = await selectFastestMediaUrl(qualityUrl);
        if (!cancelled && best) setMediaSrc(best);
      } catch {
        /* keep immediate URL */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status?._id, status?.mediaUrl, status?.mediaType]);

  // Record unique view
  useEffect(() => {
    if (!status?._id || isOwn) return;
    if (viewedSet.current.has(status._id)) return;
    viewedSet.current.add(status._id);
    markViewed(status._id);
  }, [status?._id, isOwn, markViewed]);

  // Preload next story media
  useEffect(() => {
    if (!group) return;
    const nextStatus =
      group.statuses[viewerStatusIndex + 1] ||
      viewerGroups[viewerGroupIndex + 1]?.statuses?.[0];
    if (!nextStatus?.mediaUrl || preloaded.current.has(nextStatus._id)) return;
    preloaded.current.add(nextStatus._id);
    if (nextStatus.mediaType === "image") {
      const img = new Image();
      img.decoding = "async";
      img.src = nextStatus.mediaUrl;
    } else {
      // Prefer thumbnail first, then warm video
      if (nextStatus.thumbnailUrl) {
        const thumb = new Image();
        thumb.src = nextStatus.thumbnailUrl;
      }
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.src = nextStatus.mediaUrl;
    }
  }, [group, viewerStatusIndex, viewerGroupIndex, viewerGroups]);

  // Image timer — only after media ready; pauses on hold / viewers / hidden / music loading
  useEffect(() => {
    if (!isViewerOpen || !status || isVideo || showViewersPanel || !mediaReady || musicLoading) {
      return;
    }

    const tick = (now) => {
      if (!pausedRef.current && !holdingRef.current && !document.hidden) {
        const total = elapsedRef.current + (now - startRef.current);
        const p = Math.min(1, total / durationMs);
        setProgress(p);
        if (p >= 1) {
          goNext();
          return;
        }
      } else {
        startRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    isViewerOpen,
    status?._id,
    isVideo,
    durationMs,
    goNext,
    showViewersPanel,
    mediaReady,
    musicLoading,
  ]);

  // Music URL check and auto-refresh before playing
  useEffect(() => {
    const music = status?.music;
    if (!isViewerOpen || !music?.sourceUrl) return;

    let isCurrent = true;

    const checkAndRefresh = async () => {
      const isExpired = !music.audioUrl || isAudioUrlExpired(music.audioUrl);
      if (isExpired && !musicRefreshedSet.has(status._id)) {
        musicRefreshedSet.add(status._id);
        setMusicLoading(true);
        try {
          const data = await parseStoryMusicApi(music.sourceUrl);
          if (data?.song?.audioUrl && isCurrent) {
            useStatusStore.getState().patchStatusInFeed(status._id, {
              music: {
                ...music,
                audioUrl: data.song.audioUrl,
              },
            });
          }
        } catch (err) {
          console.warn("Failed to refresh status music:", err);
        } finally {
          if (isCurrent) setMusicLoading(false);
        }
      }
    };

    checkAndRefresh();

    return () => {
      isCurrent = false;
    };
  }, [isViewerOpen, status?._id, status?.music]);

  // Story soundtrack — autoplay, pause with hold/sheet, respect mute
  useEffect(() => {
    const music = status?.music;
    const audio = musicRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute("src");

    if (!isViewerOpen || !music?.audioUrl) {
      audio.load();
      return;
    }

    const start = Math.max(0, Number(music.startOffset) || 0);
    const clip = Math.max(5, Number(music.clipDuration) || 15);
    audio.src = music.audioUrl;
    audio.loop = false;
    audio.muted = muted;
    audio.currentTime = start;

    const onTime = () => {
      if (audio.currentTime >= start + clip - 0.05) {
        audio.pause();
      }
    };
    audio.addEventListener("timeupdate", onTime);

    const onError = async () => {
      if (!music?.sourceUrl || musicRefreshedSet.has(status._id)) return;
      musicRefreshedSet.add(status._id);
      setMusicLoading(true);
      try {
        const data = await parseStoryMusicApi(music.sourceUrl);
        if (data?.song?.audioUrl) {
          useStatusStore.getState().patchStatusInFeed(status._id, {
            music: {
              ...music,
              audioUrl: data.song.audioUrl,
            },
          });
        }
      } catch (err) {
        console.warn("Failed to refresh music on error:", err);
      } finally {
        setMusicLoading(false);
      }
    };
    audio.addEventListener("error", onError);

    const tryPlay = () => {
      if (pausedRef.current || holdingRef.current || document.hidden || muted) return;
      audio.play().catch(() => {});
    };

    audio.addEventListener("canplay", tryPlay, { once: true });
    tryPlay();

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
  }, [isViewerOpen, status?._id, status?.music?.audioUrl, muted]);

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio || !hasMusic) return;
    audio.muted = muted;
    if (muted) {
      audio.pause();
      return;
    }
    if (!paused && isViewerOpen && !holdingRef.current && !document.hidden) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [muted, paused, isViewerOpen, hasMusic, showViewersPanel]);

  // Keep timer/video in sync with React `paused` (comments/reaction focus/viewers)
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      if (!isVideo) {
        // freeze image progress
      }
      videoRef.current?.pause();
      musicRef.current?.pause();
    } else if (isViewerOpen && !holdingRef.current && !document.hidden) {
      startRef.current = performance.now();
      videoRef.current?.play().catch(() => {});
      if (hasMusic && !muted) musicRef.current?.play().catch(() => {});
    }
  }, [paused, isViewerOpen, isVideo, hasMusic, muted]);

  // Pause when viewers sheet opens
  useEffect(() => {
    if (showViewersPanel) {
      if (!isVideo && !pausedRef.current) {
        elapsedRef.current += performance.now() - startRef.current;
      }
      pausedRef.current = true;
      setPaused(true);
      videoRef.current?.pause();
      musicRef.current?.pause();
    } else if (isViewerOpen && !holdingRef.current && !document.hidden) {
      startRef.current = performance.now();
      pausedRef.current = false;
      setPaused(false);
      videoRef.current?.play().catch(() => {});
      if (hasMusic && !muted) musicRef.current?.play().catch(() => {});
    }
  }, [showViewersPanel, isViewerOpen, isVideo, hasMusic, muted]);

  // Tab visibility
  useEffect(() => {
    if (!isViewerOpen) return;
    const onVis = () => {
      if (document.hidden) {
        if (!pausedRef.current && !isVideo) {
          elapsedRef.current += performance.now() - startRef.current;
        }
        pausedRef.current = true;
        setPaused(true);
        videoRef.current?.pause();
        musicRef.current?.pause();
      } else if (!holdingRef.current && !showViewersPanel) {
        startRef.current = performance.now();
        pausedRef.current = false;
        setPaused(false);
        videoRef.current?.play().catch(() => {});
        if (hasMusic && !muted) musicRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isViewerOpen, isVideo, showViewersPanel, hasMusic, muted]);

  // Keyboard
  useEffect(() => {
    if (!isViewerOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showViewersPanel) closeViewersPanel();
        else closeViewer();
      }
      if (showViewersPanel) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isViewerOpen,
    closeViewer,
    closeViewersPanel,
    showViewersPanel,
    goNext,
    goPrev,
  ]);

  // Body scroll lock
  useEffect(() => {
    if (!isViewerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isViewerOpen]);

  const onVideoTime = useCallback(() => {
    const v = videoRef.current;
    if (!v?.duration || !Number.isFinite(v.duration)) return;
    setProgress(Math.min(1, v.currentTime / v.duration));
  }, []);

  const beginHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdingRef.current = true;
      if (!isVideo && !pausedRef.current) {
        elapsedRef.current += performance.now() - startRef.current;
      }
      pausedRef.current = true;
      setPaused(true);
      videoRef.current?.pause();
      musicRef.current?.pause();
    }, HOLD_MS);
  }, [isVideo]);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (showViewersPanel) return;
    startRef.current = performance.now();
    pausedRef.current = false;
    setPaused(false);
    videoRef.current?.play().catch(() => {});
    if (hasMusic && !muted) musicRef.current?.play().catch(() => {});
  }, [showViewersPanel, hasMusic, muted]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX || 0;
    touchStartY.current = e.touches[0]?.clientY || 0;
  };

  const onTouchEnd = (e) => {
    const x = e.changedTouches[0]?.clientX || 0;
    const y = e.changedTouches[0]?.clientY || 0;
    const dx = x - touchStartX.current;
    const dy = y - touchStartY.current;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }
    if (isOwn && status?._id && dy < -SWIPE_PX && Math.abs(dy) > Math.abs(dx)) {
      openViewersPanel(status._id, "overview");
    }
  };

  const segments = useMemo(() => group?.statuses || [], [group]);

  const onImageLoad = useCallback(() => {
    setMediaLoading(false);
    setMediaReady(true);
    setMediaError(false);
  }, []);

  if (!isViewerOpen || !group || !status) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] bg-black text-white select-none touch-none transition-opacity duration-200 ${
        entering ? "opacity-0" : "opacity-100"
      }`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Status viewer"
    >
      {/* Progress bars */}
      <div className="absolute top-0 inset-x-0 z-30 px-2 pt-[max(10px,env(safe-area-inset-top))] flex gap-1 pointer-events-none">
        {segments.map((s, i) => {
          let fill = 0;
          if (i < viewerStatusIndex) fill = 1;
          else if (i === viewerStatusIndex) fill = progress;
          return (
            <div
              key={s._id}
              className="flex-1 h-[2.5px] rounded-full bg-white/30 overflow-hidden"
            >
              <div
                className="h-full bg-white rounded-full will-change-[width]"
                style={{ width: `${fill * 100}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="absolute top-5 inset-x-0 z-30 px-3 pt-[max(8px,env(safe-area-inset-top))] flex items-center gap-3">
        <img
          src={group.user?.profilePic || defaultImg}
          alt=""
          className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate drop-shadow">
            {isOwn ? "My status" : group.user?.fullName}
          </p>
          <p className="text-[11px] text-white/70 drop-shadow">
            {formatStatusTime(status.createdAt)}
          </p>
        </div>
        {paused && (
          <span className="text-white/70" aria-hidden>
            <Pause className="w-4 h-4" />
          </span>
        )}
        {(isVideo || hasMusic) && (
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setMuted((m) => !m);
            }}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        )}
        {isOwn && (
          <>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                openViewersPanel(status._id, "overview");
              }}
              aria-label="Viewers"
            >
              <Eye className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-white/10 text-red-300"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Delete this status?")) {
                  deleteStatus(status._id);
                }
              }}
              aria-label="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        )}
        <button
          type="button"
          className="p-2 rounded-full hover:bg-white/10"
          onClick={closeViewer}
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Media stage */}
      <div
        ref={mediaStageRef}
        className="absolute inset-0 flex items-center justify-center bg-black"
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
      >
        <audio ref={musicRef} preload="auto" playsInline />
        {(mediaLoading || musicLoading) && !mediaError && (
          <span className="absolute z-10 loading loading-spinner loading-lg text-white/70" />
        )}
        {mediaError && (
          <div className="absolute z-10 text-center px-6">
            <p className="font-semibold mb-3">Couldn’t load this status</p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                className="btn btn-sm btn-ghost text-white"
                onClick={closeViewer}
              >
                Close
              </button>
              <button type="button" className="btn btn-sm" onClick={goNext}>
                Next
              </button>
            </div>
          </div>
        )}

        {isVideo ? (
          <DoubleTapLike
            className="max-w-full max-h-full w-full h-full flex items-center justify-center z-[5]"
            disabled={isOwn}
            onDoubleTap={() => toggleLike(status._id)}
          >
            <video
              key={status._id}
              ref={videoRef}
              src={mediaSrc || status.mediaUrl}
              poster={status.thumbnailUrl || undefined}
              className="max-w-full max-h-full w-full h-full object-contain pointer-events-none"
              playsInline
              autoPlay
              muted={muted}
              preload="auto"
              onWaiting={() => setMediaLoading(true)}
              onPlaying={() => {
                setMediaLoading(false);
                setMediaReady(true);
              }}
              onCanPlay={() => {
                setMediaLoading(false);
                setMediaReady(true);
                if (!pausedRef.current && !holdingRef.current) {
                  videoRef.current?.play().catch(() => {});
                }
              }}
              onTimeUpdate={onVideoTime}
              onEnded={goNext}
              onError={() => {
                // Fall back to original URL if transformed/CDN URL fails
                if (mediaSrc && mediaSrc !== status.mediaUrl) {
                  setMediaSrc(status.mediaUrl);
                  setMediaError(false);
                  setMediaLoading(true);
                  return;
                }
                setMediaError(true);
                setMediaLoading(false);
              }}
            />
          </DoubleTapLike>
        ) : (
          <DoubleTapLike
            className="max-w-full max-h-full flex items-center justify-center z-[5]"
            disabled={isOwn}
            onDoubleTap={() => toggleLike(status._id)}
          >
            <img
              key={status._id}
              src={mediaSrc || status.mediaUrl}
              alt=""
              className="max-w-full max-h-full object-contain pointer-events-none"
              onLoad={onImageLoad}
              onError={() => {
                if (mediaSrc && mediaSrc !== status.mediaUrl) {
                  setMediaSrc(status.mediaUrl);
                  setMediaError(false);
                  setMediaLoading(true);
                  return;
                }
                setMediaError(true);
                setMediaLoading(false);
              }}
              draggable={false}
            />
          </DoubleTapLike>
        )}

        {hasMusic && (
          <MusicSticker
            music={status.music}
            playing={!muted && !paused}
            editable={false}
            containerRef={mediaStageRef}
          />
        )}

        {/* Tap zones — leave center + bottom free for double-tap / engagement */}
        <button
          type="button"
          className="absolute top-0 bottom-[28%] left-0 w-[28%] z-[15] cursor-pointer"
          aria-label="Previous"
          onClick={(e) => {
            e.stopPropagation();
            endHold();
            goPrev();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="absolute top-0 bottom-[28%] right-0 w-[28%] z-[15] cursor-pointer"
          aria-label="Next"
          onClick={(e) => {
            e.stopPropagation();
            endHold();
            goNext();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>

      {isOwn && (
        <StoryReactionOverlay
          particles={particles}
          centerHeart={centerHeart}
          onParticleDone={removeParticle}
        />
      )}

      {isOwn && status.caption && (
        <div className="absolute bottom-20 inset-x-0 z-30 px-6 text-center pointer-events-none">
          <p className="text-sm sm:text-base font-medium drop-shadow-lg leading-relaxed">
            {status.caption}
          </p>
        </div>
      )}

      {!isOwn && (
        <StatusEngagementBar
          status={status}
          isOwn={false}
          authUserId={authUser?._id}
          onLike={toggleLike}
          onReact={reactToStatus}
          onLoadComments={loadComments}
          onAddComment={addComment}
          onDeleteComment={removeComment}
          paused={paused}
          setPaused={setPaused}
        />
      )}

      {isOwn && status && (
        <StoryOwnerBar
          status={status}
          reactionSummary={reactionSummary}
          onAddStatus={() => {
            closeViewer();
            openCreate();
          }}
          onOpenInsights={(tab) => openViewersPanel(status._id, tab || "overview")}
        />
      )}

      <button
        type="button"
        className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/10 items-center justify-center hover:bg-white/20"
        onClick={goPrev}
        aria-label="Previous"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        type="button"
        className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/10 items-center justify-center hover:bg-white/20"
        onClick={goNext}
        aria-label="Next"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <StatusInsightsSheet
        open={showViewersPanel}
        tab={insightsTab}
        onTabChange={setInsightsTab}
        onClose={closeViewersPanel}
        loading={isViewersLoading}
        viewers={viewersList}
        likes={likesList}
        reactions={reactionsList}
        comments={commentsList}
        onDeleteComment={async (commentId) => {
          const ok = await removeComment(status._id, commentId);
          if (ok) {
            useStatusStore.setState((s) => ({
              commentsList: s.commentsList.filter((c) => c._id !== commentId),
            }));
          }
        }}
      />
    </div>,
    document.body
  );
}

export default memo(StatusViewer);
