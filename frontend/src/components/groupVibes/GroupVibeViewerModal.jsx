import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  Eye,
  Trash2,
  Send,
  Music,
  ChevronLeft,
  ChevronRight,
  Heart,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useGroupVibeStore } from "../../store/useGroupVibeStore";
import { useAuthStore } from "../../store/useAuthStore";
import { audioManager } from "../../lib/audioManager";
import { GroupVibeViewersDrawer } from "./GroupVibeViewersDrawer";
import { formatDistanceToNow } from "date-fns";

const REACTION_EMOJIS = ["❤️", "😂", "🔥", "😍", "😮", "😢", "👏"];

export const GroupVibeViewerModal = () => {
  const {
    isViewerOpen,
    activeViewerGroupId,
    activeVibeIndex,
    groupVibesMap,
    setViewerOpen,
    nextVibe,
    prevVibe,
    reactToVibe,
    replyToVibe,
    deleteVibe,
    fetchVibeViewers,
    floatingReactions,
  } = useGroupVibeStore();

  const authUser = useAuthStore((s) => s.authUser);

  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef(null);
  const touchStartY = useRef(null);
  const progressTimerRef = useRef(null);
  const isPausedRef = useRef(isPaused);

  const rawVibes = activeViewerGroupId ? groupVibesMap[activeViewerGroupId] || [] : [];

  // Deduplicate and filter out deleted/invalid vibes for clean viewer segments
  const vibes = React.useMemo(() => {
    const seen = new Set();
    return rawVibes.filter((v) => {
      if (!v || !v._id || v.deleted) return false;
      const idStr = String(v._id);
      if (seen.has(idStr)) return false;
      seen.add(idStr);
      return true;
    });
  }, [rawVibes]);

  const currentVibe = vibes[activeVibeIndex];

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      audioManager.pause();
    } else if (isViewerOpen && currentVibe?.music && !isMuted) {
      audioManager.resume();
    }
  }, [isPaused, isMuted, isViewerOpen, currentVibe?._id]);

  const isCreator = currentVibe && String(currentVibe.creator?._id || currentVibe.creatorId?._id || currentVibe.creatorId) === String(authUser?._id);

  // Audio & Progress Sync Engine
  useEffect(() => {
    if (!isViewerOpen || !currentVibe) return;

    setProgress(0);
    const durationSec = Math.max(3, currentVibe.duration || 5);
    const durationMs = durationSec * 1000;
    const intervalMs = 50;
    const increment = (intervalMs / durationMs) * 100;

    // Handle music playback
    if (currentVibe?.music && !isMuted) {
      const audioUrl = currentVibe.music.audioUrl || "";
      const sourceUrl = currentVibe.music.sourceUrl || "";
      const title = currentVibe.music.title || "";
      const artist = currentVibe.music.artist || "";

      const getApiBaseUrl = () => {
        if (import.meta.env.MODE === "development") {
          return `http://${window.location.hostname}:5001`;
        }
        return "https://chatappey.onrender.com";
      };

      const streamProxyUrl = `${getApiBaseUrl()}/api/music/stream?url=${encodeURIComponent(audioUrl)}&sourceUrl=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

      const playAudioWithFallback = () => {
        audioManager.play({
          id: `vibe_music_${currentVibe._id}`,
          url: streamProxyUrl,
          volume: 0.9,
          loop: true,
          onError: () => {
            if (audioUrl) {
              audioManager.play({
                id: `vibe_music_direct_${currentVibe._id}`,
                url: audioUrl,
                volume: 0.9,
                loop: true,
              });
            }
          },
        });

        if (currentVibe.music.clipStart > 0) {
          audioManager.seek(currentVibe.music.clipStart);
        }
      };

      playAudioWithFallback();
    } else {
      audioManager.stop();
    }

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressTimerRef.current);
            nextVibe();
            return 100;
          }
          return prev + increment;
        });
      }
    }, intervalMs);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      audioManager.stop();
    };
  }, [isViewerOpen, activeViewerGroupId, activeVibeIndex, isMuted, currentVibe?._id]);

  // Touch Swipe Down to close
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e) => {
    setIsPaused(false);
    if (touchStartY.current !== null) {
      const touchEndY = e.changedTouches[0].clientY;
      const diffY = touchEndY - touchStartY.current;
      if (diffY > 100) {
        setViewerOpen(false);
      }
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !currentVibe) return;
    const textToSend = replyText.trim();
    setReplyText("");
    await replyToVibe(activeViewerGroupId, currentVibe._id, textToSend);
  };

  if (!isViewerOpen || !currentVibe) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black sm:bg-black/95 sm:backdrop-blur-lg select-none animate-in fade-in duration-200">
      <div
        className="relative w-full h-full sm:h-[95vh] sm:max-h-[840px] sm:max-w-md bg-slate-950 sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl border-0 sm:border border-white/10"
        onTouchStart={(e) => {
          audioManager.resume();
          handleTouchStart(e);
        }}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => {
          audioManager.resume();
          setIsPaused(true);
        }}
        onMouseUp={() => setIsPaused(false)}
      >
        {/* Floating Live Reactions Layer */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {floatingReactions.map((p) => (
            <div
              key={p.id}
              className="absolute bottom-20 text-3xl animate-vibe-float opacity-0"
              style={{ left: `${p.x}%` }}
            >
              {p.emoji}
            </div>
          ))}
        </div>

        {/* Top Segmented Progress Bar */}
        <div className="absolute top-3 inset-x-3 z-30 flex gap-1.5 px-2">
          {vibes.map((v, idx) => (
            <div
              key={v._id}
              className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm"
            >
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{
                  width:
                    idx < activeVibeIndex
                      ? "100%"
                      : idx === activeVibeIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Header */}
        <div className="absolute top-7 inset-x-0 z-30 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white">
          <div className="flex items-center gap-2.5">
            <img
              src={currentVibe.creator?.profilePic || "/avatar.png"}
              alt={currentVibe.creator?.fullName}
              className="w-9 h-9 rounded-full object-cover border border-white/30"
            />
            <div className="min-w-0">
              <p className="font-bold text-xs leading-tight truncate">
                {currentVibe.creator?.fullName}
              </p>
              <p className="text-[10px] text-white/70">
                {formatDistanceToNow(new Date(currentVibe.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            {currentVibe.music?.audioUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="p-1.5 rounded-full bg-black/40 text-white/80 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-rose-400" />}
              </button>
            )}

            {/* Play/Pause */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(!isPaused);
              }}
              className="p-1.5 rounded-full bg-black/40 text-white/80 hover:text-white"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            {/* Delete button if creator */}
            {isCreator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteVibe(activeViewerGroupId, currentVibe._id);
                }}
                className="p-1.5 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/40"
                title="Delete Group Vibe"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewerOpen(false);
              }}
              className="p-1.5 rounded-full bg-black/40 text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media / Text Story Layer */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
          {currentVibe.mediaType === "video" ? (
            <video
              ref={videoRef}
              src={currentVibe.mediaUrl}
              autoPlay
              loop
              playsInline
              muted={isMuted || !!currentVibe.music?.audioUrl}
              className="w-full h-full object-contain"
            />
          ) : currentVibe.mediaType === "photo" ? (
            <img
              src={currentVibe.mediaUrl}
              alt="Group Vibe"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8 text-center bg-gradient-to-tr from-purple-800 via-indigo-900 to-slate-900 text-white font-bold text-2xl sm:text-3xl">
              {currentVibe.text}
            </div>
          )}

          {/* Music Sticker Overlay */}
          {currentVibe.music?.title && (
            <div
              className="absolute z-20 pointer-events-none transition-all duration-150"
              style={{
                left: `${currentVibe.music.position?.x ?? 50}%`,
                top: `${currentVibe.music.position?.y ?? 24}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 text-white shadow-xl">
                <Music className="w-4 h-4 text-rose-400 animate-spin-slow" />
                <div className="text-left leading-none">
                  <p className="text-xs font-bold truncate max-w-[160px]">{currentVibe.music.title}</p>
                  <p className="text-[10px] text-white/70 truncate max-w-[160px]">{currentVibe.music.artist}</p>
                </div>
              </div>
            </div>
          )}

          {/* Caption Overlay if Photo/Video */}
          {currentVibe.mediaType !== "text" && currentVibe.text && (
            <div className="absolute bottom-24 inset-x-4 z-20 pointer-events-none">
              <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-center text-sm font-medium">
                {currentVibe.text}
              </div>
            </div>
          )}

          {/* Tap Zones for Prev/Next */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              prevVibe();
            }}
            className="absolute left-0 top-20 bottom-24 w-1/3 z-20 cursor-pointer"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              nextVibe();
            }}
            className="absolute right-0 top-20 bottom-24 w-1/3 z-20 cursor-pointer"
          />
        </div>

        {/* Bottom Bar: Reaction Emojis & Reply Input */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent text-white flex flex-col gap-2">
          {/* Reaction Bar */}
          <div className="flex items-center justify-between px-2 gap-1 overflow-x-auto no-scrollbar">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reactToVibe(activeViewerGroupId, currentVibe._id, emoji);
                }}
                className={`text-xl p-2 rounded-full transition-transform active:scale-125 hover:bg-white/10 ${
                  currentVibe.myReaction === emoji ? "bg-rose-500/30 border border-rose-400/50 scale-110" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Reply Form & Viewers Button */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleReplySubmit} className="flex-1 flex items-center relative">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                placeholder="Reply to Group Vibe..."
                className="w-full px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-md text-white placeholder-white/50 border border-white/20 focus:outline-none focus:border-rose-400 text-xs sm:text-sm"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="absolute right-2 p-1.5 rounded-full bg-rose-500 text-white disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Viewer Count Launcher */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchVibeViewers(activeViewerGroupId, currentVibe._id);
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold hover:bg-white/20 transition-colors"
            >
              <Eye className="w-4 h-4 text-rose-400" />
              <span>{currentVibe.viewCount || 0}</span>
            </button>
          </div>
        </div>

        {/* Viewers Drawer */}
        <GroupVibeViewersDrawer />
      </div>
    </div>
  );
};
