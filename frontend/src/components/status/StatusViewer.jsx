import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Volume2,
  VolumeX,
  Pause,
  Music,
  Disc,
  Share2,
  AtSign,
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
import MusicStoryCanvas from "./MusicStoryCanvas";
import StoryMentionSticker from "./StoryMentionSticker";
import { audioManager } from "../../lib/audioManager";
import "./storyMusic.css";

const IMAGE_MS = 5000;
const HOLD_MS = 180; // distinguish tap vs hold
const SWIPE_PX = 56;

/**
 * Full-screen Instagram/WhatsApp-style story viewer.
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
    openReStory,
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
  const [audioError, setAudioError] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [entering, setEntering] = useState(true);
  const [mediaSrc, setMediaSrc] = useState("");

  const videoRef = useRef(null);
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
  const hasMusic = !!(status?.music?.audioUrl || status?.music?.sourceUrl);
  const isMusicOnly =
    status?.mediaType === "music" ||
    (hasMusic && (!status?.mediaUrl || status?.mediaUrl === "" || status?.mediaUrl === "blank"));

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
    // End of all stories → close (Instagram/WhatsApp behavior)
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
    setAudioError(false);
    setMediaError(false);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isMusicOnly || !status?.mediaUrl) {
      setMediaReady(true);
      setMediaLoading(false);
      setMediaSrc("");
      return;
    }

    setMediaReady(false);
    setMediaLoading(true);

    if (status?.mediaUrl) {
      const immediate = buildQualityUrl(status.mediaUrl, undefined, {
        isVideo: status.mediaType === "video",
      });
      setMediaSrc(immediate || status.mediaUrl);
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
  }, [status?._id, status?.mediaUrl, status?.mediaType, isMusicOnly]);

  const viewTimerRef = useRef(null);

  // Record unique view (requires minimum 1.5 seconds of active visibility & ready media)
  useEffect(() => {
    if (!status?._id || isOwn || !isViewerOpen) return;
    if (viewedSet.current.has(status._id)) return;

    if (!mediaReady || paused || showViewersPanel) {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
      return;
    }

    // Require 1.5s active continuous viewing before recording view
    viewTimerRef.current = setTimeout(() => {
      if (status?._id && !viewedSet.current.has(status._id)) {
        viewedSet.current.add(status._id);
        markViewed(status._id);
      }
    }, 1500);

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [status?._id, isOwn, isViewerOpen, mediaReady, paused, showViewersPanel, markViewed]);

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

  // Image, Music & Video smooth 60fps timer — progress increments smoothly; pauses on hold / viewers / hidden
  useEffect(() => {
    if (!isViewerOpen || !status || showViewersPanel || !mediaReady) {
      return;
    }

    const tick = (now) => {
      if (!pausedRef.current && !holdingRef.current && !document.hidden) {
        if (isVideo && videoRef.current) {
          const v = videoRef.current;
          if (v.duration && Number.isFinite(v.duration) && v.duration > 0) {
            const p = Math.min(1, v.currentTime / v.duration);
            setProgress(p);
          }
        } else {
          const total = elapsedRef.current + (now - startRef.current);
          const p = Math.min(1, total / durationMs);
          setProgress(p);
          if (p >= 1) {
            goNext();
            return;
          }
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
  ]);

  // Audio Playback Engine via Centralized Audio Manager
  useEffect(() => {
    const music = status?.music;
    if (!isViewerOpen || !music || (!music.audioUrl && !music.sourceUrl)) {
      audioManager.stop();
      setAudioError(false);
      return;
    }

    const audioUrl = music.audioUrl || "";
    const sourceUrl = music.sourceUrl || "";
    const title = music.title || "";
    const artist = music.artist || "";
    const startSec = Number(music.clipStart ?? music.startOffset ?? 0);
    const clipDuration = Number(music.clipDuration ?? 15);

    const getApiBaseUrl = () => {
      if (import.meta.env.MODE === "development") {
        return `http://${window.location.hostname}:5001`;
      }
      return "https://chatappey.onrender.com";
    };

    const streamProxyUrl = `${getApiBaseUrl()}/api/music/stream?url=${encodeURIComponent(
      audioUrl
    )}&sourceUrl=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(
      artist
    )}`;

    const primaryUrl = audioUrl || streamProxyUrl;
    const fallbackUrl = audioUrl ? streamProxyUrl : "";

    console.log("🔊 Story loaded music:", {
      storyId: status._id,
      music,
      audioUrl: primaryUrl,
      clipStart: startSec,
      clipDuration,
    });

    const startPlayback = (targetUrl, isFallback = false) => {
      audioManager.play({
        id: `story_${status._id}_${isFallback ? "proxy" : "direct"}`,
        url: targetUrl,
        volume: isVideo ? 0.6 : 1.0,
        loop: false,
        clipStart: startSec,
        clipDuration: clipDuration,
        onPlaying: () => {
          console.log(`▶️ Audio playing event for story: ${status._id}`);
          setAudioError(false);
        },
        onWaiting: () => {
          console.log(`⏳ Audio buffering event for story: ${status._id}`);
        },
        onError: (err) => {
          console.warn(`⚠️ Audio playback error for story: ${status._id}`, err);
          if (!isFallback && fallbackUrl) {
            console.log("🔄 Retrying audio with fallback proxy stream...");
            startPlayback(fallbackUrl, true);
          } else {
            setAudioError(true);
          }
        },
      });
    };

    if (!muted && !pausedRef.current && !holdingRef.current && !showViewersPanel) {
      startPlayback(primaryUrl);
    }

    return () => {
      audioManager.stop();
    };
  }, [isViewerOpen, status?._id, status?.music, isVideo, muted]);

  // Synchronize audioManager with play/pause/mute state
  useEffect(() => {
    if (!hasMusic) return;
    if (muted || paused || showViewersPanel || holdingRef.current || document.hidden) {
      audioManager.pause();
    } else if (isViewerOpen) {
      audioManager.resume();
    }
  }, [muted, paused, isViewerOpen, hasMusic, showViewersPanel]);

  // Keep timer/video in sync with React `paused` (comments/reaction focus/viewers)
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      videoRef.current?.pause();
      if (hasMusic) audioManager.pause();
    } else if (isViewerOpen && !holdingRef.current && !document.hidden) {
      startRef.current = performance.now();
      videoRef.current?.play().catch(() => {});
      if (hasMusic && !muted) audioManager.resume();
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
      if (hasMusic) audioManager.pause();
    } else if (isViewerOpen && !holdingRef.current && !document.hidden) {
      startRef.current = performance.now();
      pausedRef.current = false;
      setPaused(false);
      videoRef.current?.play().catch(() => {});
      if (hasMusic && !muted) audioManager.resume();
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
        if (hasMusic) audioManager.pause();
      } else if (!holdingRef.current && !showViewersPanel) {
        startRef.current = performance.now();
        pausedRef.current = false;
        setPaused(false);
        videoRef.current?.play().catch(() => {});
        if (hasMusic && !muted) audioManager.resume();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isViewerOpen, isVideo, showViewersPanel, hasMusic, muted]);

  // Keyboard navigation
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
      if (hasMusic) audioManager.pause();
    }, HOLD_MS);
  }, [isVideo, hasMusic]);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdingRef.current) {
      holdingRef.current = false;
      if (!showViewersPanel) {
        startRef.current = performance.now();
        pausedRef.current = false;
        setPaused(false);
        videoRef.current?.play().catch(() => {});
        if (hasMusic && !muted) audioManager.resume();
      }
    }
  }, [showViewersPanel, hasMusic, muted]);

  const onImageLoad = useCallback(() => {
    setMediaLoading(false);
    setMediaReady(true);
  }, []);

  if (!isViewerOpen || !group || !status) return null;

  const user = group.user || {};
  const userPic = user.profilePic || defaultImg;
  const userName = isOwn ? "Your story" : user.fullName || "User";

  const isReStory = status?.mediaType === "restory";
  const isMentioned = useMemo(() => {
    if (!status?.mentions || !authUser?._id) return false;
    return status.mentions.some((m) => String(m.userId) === String(authUser._id));
  }, [status, authUser]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] bg-black flex items-center justify-center transition-opacity duration-200 ${
        entering ? "opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Story Viewer"
    >
      {/* Segmented progress bar */}
      <div className="absolute top-0 left-0 right-0 z-30 p-2 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex gap-1.5 px-2">
          {group.statuses.map((st, idx) => {
            const isCurrent = idx === viewerStatusIndex;
            const isPast = idx < viewerStatusIndex;
            const scale = isCurrent ? Math.min(1, Math.max(0, progress)) : isPast ? 1 : 0;
            return (
              <div
                key={st._id || idx}
                className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white origin-left will-change-transform"
                  style={{
                    transform: `scaleX(${scale})`,
                    transition: isCurrent ? "none" : "transform 0.15s ease-out",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Header bar */}
      <div className="absolute top-4 left-0 right-0 z-30 px-4 pt-4 flex items-center justify-between text-white drop-shadow-md">
        <div className="flex items-center gap-3">
          <img
            src={userPic}
            alt=""
            className="w-10 h-10 rounded-full object-cover border-2 border-white/40"
          />
          <div>
            <div className="font-semibold text-sm leading-tight flex items-center gap-2">
              <span>{userName}</span>
              {hasMusic && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] backdrop-blur-md">
                  <Music className="w-3 h-3 text-pink-400 animate-spin" style={{ animationDuration: '3s' }} />
                  {status.music.title}
                </span>
              )}
            </div>
            <span className="text-xs text-white/70">
              {formatStatusTime(status.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {audioError && (
            <span className="text-[11px] bg-red-500/30 border border-red-500/40 text-red-200 px-2 py-0.5 rounded-full">
              Music unavailable
            </span>
          )}
          {hasMusic && (
            <button
              type="button"
              className="p-2 rounded-full hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                setMuted((m) => !m);
              }}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-pink-400" />}
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
      </div>

      {/* Media stage */}
      <div
        ref={mediaStageRef}
        className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden"
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
      >
        {mediaLoading && !mediaError && (
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

        {isReStory ? (
          /* Re-Story Canvas Renderer */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950">
            <div className="relative z-10 w-full max-w-[280px] bg-black/60 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white px-1">
                <Share2 className="w-4 h-4 text-pink-400" />
                <span className="truncate">@{status.restory?.originalUsername}</span>
              </div>
              <div className="relative aspect-[9/14] w-full rounded-2xl overflow-hidden shadow-lg border border-white/10">
                <img
                  src={status.restory?.originalMediaUrl || status.mediaUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onLoad={onImageLoad}
                />
                <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white/90 font-medium truncate">
                  Originally shared by {status.restory?.originalDisplayName || "User"}
                </div>
              </div>
            </div>
          </div>
        ) : isMusicOnly ? (
          /* Music-Only Story Renderer */
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <MusicStoryCanvas
              music={status.music}
              isPlaying={mediaReady && isViewerOpen && !paused && !muted}
            />
          </div>
        ) : isVideo ? (
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

        {hasMusic && !isMusicOnly && (
          <MusicSticker
            music={status.music}
            playing={!muted && !paused}
            editable={false}
            containerRef={mediaStageRef}
          />
        )}

        {/* Render Mention Stickers */}
        {status.mentions?.map((m) => (
          <StoryMentionSticker
            key={m.userId}
            mention={m}
            editable={false}
            onTapMention={(item) => {
              toast(`Mentioned @${item.username || item.displayName}`, {
                icon: "🏷️",
                style: {
                  borderRadius: "16px",
                  background: "#18181b",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.1)",
                },
              });
            }}
          />
        ))}

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

        {paused && !showViewersPanel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[16] bg-black/20">
            <Pause className="w-14 h-14 text-white/80 drop-shadow-lg" />
          </div>
        )}

        {/* Reaction Floating FX */}
        <StoryReactionOverlay
          particles={particles}
          centerHeart={centerHeart}
          onRemoveParticle={removeParticle}
        />
      </div>

      {/* Caption overlay */}
      {status.caption && (
        <div className="absolute bottom-24 left-0 right-0 z-20 px-6 text-center pointer-events-none">
          <p className="inline-block bg-black/60 backdrop-blur-md text-white text-sm px-4 py-2 rounded-2xl max-w-[85vw] break-words shadow-lg">
            {status.caption}
          </p>
        </div>
      )}

      {/* Instagram-style Re-Story Button for Mentioned Users */}
      {isMentioned && !isOwn && (
        <div className="absolute bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openReStory(status);
              closeViewer();
            }}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-xs shadow-2xl hover:scale-105 active:scale-95 transition flex items-center gap-2 border border-white/20 animate-bounce"
          >
            <Share2 className="w-4 h-4" />
            <span>Add this to your story</span>
          </button>
        </div>
      )}

      {/* Instagram/WhatsApp Engagement Bar */}
      <StatusEngagementBar
        status={status}
        isOwn={isOwn}
        authUserId={authUser?._id}
        onLike={() => toggleLike(status._id)}
        onReact={(emoji) => reactToStatus(status._id, emoji)}
        onLoadComments={(sid) => loadComments(sid)}
        onAddComment={(sid, text, replyTo) => addComment(sid, text, replyTo)}
        onDeleteComment={(sid, commentId) => removeComment(sid, commentId)}
        paused={paused}
        setPaused={setPaused}
      />

      {/* Insights Drawer Sheet */}
      <StatusInsightsSheet
        isOpen={showViewersPanel}
        statusId={status._id}
        tab={insightsTab}
        onTabChange={setInsightsTab}
        onClose={closeViewersPanel}
        viewers={viewersList}
        likes={likesList}
        reactions={reactionsList}
        comments={commentsList}
        loading={isViewersLoading}
        onRemoveComment={(commentId) => removeComment(status._id, commentId)}
      />
    </div>,
    document.body
  );
}

export default memo(StatusViewer);
