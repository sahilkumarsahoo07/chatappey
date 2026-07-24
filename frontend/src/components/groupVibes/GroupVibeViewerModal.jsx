import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  X,
  Volume2,
  VolumeX,
  Trash2,
  Eye,
  Send,
  Heart,
  ChevronLeft,
  ChevronRight,
  Share2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useGroupVibeStore } from "../../store/useGroupVibeStore";
import { useAuthStore } from "../../store/useAuthStore";
import { audioManager } from "../../lib/audioManager";
import { groupVibePreloader } from "../../lib/groupVibePreloader";
import { InstagramMusicSticker } from "./InstagramMusicSticker";
import { MusicOnlyVibeView } from "./MusicOnlyVibeView";
import { formatDistanceToNow } from "date-fns";

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😍", "👏", "😮"];

export const GroupVibeViewerModal = () => {
  const {
    isViewerOpen,
    activeViewerGroupId,
    activeVibeIndex,
    groupVibesMap,
    setViewerOpen,
    nextVibe,
    prevVibe,
    deleteVibe,
    viewVibe,
    reactToVibe,
    replyToVibe,
    fetchVibeViewers,
    viewersDrawerOpen,
    viewersList,
    viewersLoading,
    closeViewersDrawer,
    floatingReactions,
  } = useGroupVibeStore();

  const authUser = useAuthStore((state) => state.authUser);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Swipe & touch gesture state
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isHolding = useRef(false);
  const holdTimer = useRef(null);

  const vibes = activeViewerGroupId ? groupVibesMap[activeViewerGroupId] || [] : [];
  const currentVibe = vibes[activeVibeIndex] || null;
  const isCreator =
    currentVibe &&
    authUser &&
    String(currentVibe.creator?._id || currentVibe.creatorId?._id || currentVibe.creatorId) === String(authUser._id);

  // Determine slide duration (default 5s for photo/text, custom for music clip)
  const durationSec = currentVibe?.music?.clipDuration
    ? Number(currentVibe.music.clipDuration)
    : currentVibe?.duration || 5;

  // --- AUTO-MARK AS VIEWED INSTANTLY ---
  useEffect(() => {
    if (isViewerOpen && activeViewerGroupId && currentVibe?._id) {
      viewVibe(activeViewerGroupId, currentVibe._id);
    }
  }, [isViewerOpen, activeViewerGroupId, currentVibe?._id, viewVibe]);

  // --- PRELOAD NEIGHBORS ON VIBE CHANGE ---
  useEffect(() => {
    if (isViewerOpen && vibes.length > 0) {
      groupVibePreloader.preloadNeighbors(vibes, activeVibeIndex);
    }
  }, [isViewerOpen, activeViewerGroupId, activeVibeIndex, vibes]);

  // --- AUDIO & PROGRESS SYNCHRONIZATION ENGINE ---
  useEffect(() => {
    if (!isViewerOpen || !currentVibe) {
      audioManager.stop();
      return;
    }

    setProgress(0);
    setIsBuffering(false);

    let progressInterval = null;
    let audioStarted = false;

    // Handle music playback
    if (currentVibe?.music && !isMuted) {
      const audioUrl = currentVibe.music.audioUrl || "";
      const sourceUrl = currentVibe.music.sourceUrl || "";
      const title = currentVibe.music.title || "";
      const artist = currentVibe.music.artist || "";
      const startSec = Number(currentVibe.music.clipStart ?? currentVibe.music.startOffset ?? 0);
      const clipDuration = Number(currentVibe.music.clipDuration ?? durationSec);

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

      const startPlayback = (targetUrl, isFallback = false) => {
        audioManager.play({
          id: `vibe_${currentVibe._id}_${isFallback ? "proxy" : "direct"}`,
          url: targetUrl,
          volume: 0.9,
          loop: true,
          clipStart: startSec,
          clipDuration: clipDuration,
          onPlaying: () => {
            setIsBuffering(false);
            audioStarted = true;
          },
          onWaiting: () => {
            setIsBuffering(true);
          },
          onError: () => {
            if (!isFallback && fallbackUrl) {
              startPlayback(fallbackUrl, true);
            } else {
              setIsBuffering(false);
              audioStarted = true; // allow story to proceed silently if audio fails
            }
          },
        });
      };

      startPlayback(primaryUrl, false);
    } else {
      audioManager.stop();
      audioStarted = true; // No music, start progress timer right away
    }

    // --- Story Timer Engine (Updates progress only when NOT buffering and NOT paused) ---
    const totalMs = durationSec * 1000;

    progressInterval = setInterval(() => {
      if (isPaused || viewersDrawerOpen) return;

      // Wait if media/audio is buffering
      if (currentVibe?.music && !isMuted && !audioStarted) {
        setIsBuffering(true);
        return;
      }

      setProgress((prev) => {
        const nextVal = prev + 100 / (totalMs / 50);
        if (nextVal >= 100) {
          clearInterval(progressInterval);
          nextVibe();
          return 100;
        }
        return nextVal;
      });
    }, 50);

    return () => {
      if (progressInterval) clearInterval(progressInterval);
      audioManager.stop();
    };
  }, [
    isViewerOpen,
    activeViewerGroupId,
    activeVibeIndex,
    currentVibe?._id,
    isMuted,
    isPaused,
    viewersDrawerOpen,
    durationSec,
  ]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isViewerOpen) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        nextVibe();
      } else if (e.key === "ArrowLeft") {
        prevVibe();
      } else if (e.key === "Escape") {
        setViewerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen, nextVibe, prevVibe, setViewerOpen]);

  if (!isViewerOpen || !currentVibe) return null;

  // --- HANDLERS ---
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      await replyToVibe(activeViewerGroupId, currentVibe._id, replyText);
      setReplyText("");
    } catch (e) {
      // Handled in store
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this Group Vibe?")) {
      deleteVibe(activeViewerGroupId, currentVibe._id);
    }
  };

  // Touch gesture handlers for Hold & Swipe Down
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    holdTimer.current = setTimeout(() => {
      isHolding.current = true;
      setIsPaused(true);
    }, 200);
  };

  const handleTouchEnd = (e) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (isHolding.current) {
      isHolding.current = false;
      setIsPaused(false);
      return;
    }

    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchEndY - touchStartY.current;

    // Swipe down > 80px to close
    if (diffY > 80) {
      setViewerOpen(false);
      return;
    }

    // Tap left/right 30% boundaries
    const screenWidth = window.innerWidth;
    const clickX = e.changedTouches[0].clientX;

    if (clickX < screenWidth * 0.35) {
      prevVibe();
    } else if (clickX > screenWidth * 0.65) {
      nextVibe();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 sm:backdrop-blur-xl p-0 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className="relative w-full h-full sm:h-[94vh] sm:max-h-[850px] sm:max-w-md bg-slate-950 sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl border-0 sm:border border-white/10"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ==================================================================== */}
        {/* 1. MEDIA CANVAS CONTAINER */}
        {/* ==================================================================== */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-slate-900">
          {/* Media Content rendering based on mediaType */}
          {currentVibe.mediaType === "photo" && currentVibe.mediaUrl && (
            <img
              src={currentVibe.mediaUrl}
              alt="Group Vibe"
              className="w-full h-full object-contain pointer-events-none"
            />
          )}

          {currentVibe.mediaType === "video" && currentVibe.mediaUrl && (
            <video
              src={currentVibe.mediaUrl}
              autoPlay
              playsInline
              loop
              muted={isMuted || !!currentVibe.music}
              className="w-full h-full object-contain pointer-events-none"
            />
          )}

          {currentVibe.mediaType === "text" && (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-indigo-900 via-purple-900 to-rose-950 text-white font-black text-2xl sm:text-3xl leading-snug drop-shadow-xl">
              {currentVibe.text}
            </div>
          )}

          {currentVibe.mediaType === "music" && (
            <MusicOnlyVibeView vibe={currentVibe} isPlaying={!isPaused && !isBuffering} />
          )}

          {/* Instagram Music Sticker Overlay if media + song */}
          {currentVibe.music && currentVibe.mediaType !== "music" && (
            <div
              className="absolute z-20 pointer-events-none drop-shadow-2xl"
              style={{
                left: `${currentVibe.music.position?.x ?? 50}%`,
                top: `${currentVibe.music.position?.y ?? 25}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <InstagramMusicSticker music={currentVibe.music} isPlaying={!isPaused && !isBuffering} />
            </div>
          )}

          {/* Text Caption if Media + Text */}
          {currentVibe.mediaType !== "text" && currentVibe.text && (
            <div className="absolute bottom-16 inset-x-4 z-20 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-semibold text-center max-w-xs shadow-xl">
                {currentVibe.text}
              </div>
            </div>
          )}

          {/* Buffering Spinner Overlay */}
          {isBuffering && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-xs">
              <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* 2. TOP OVERLAY HEADER (Progress Bar, User Info, Controls) */}
        {/* ==================================================================== */}
        <div
          className={`absolute top-0 inset-x-0 z-30 p-3 pt-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-200 ${
            isHolding.current ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Segmented Top Progress Bars */}
          <div className="flex items-center gap-1 mb-3 px-1">
            {vibes.map((v, idx) => {
              let fillWidth = "0%";
              if (idx < activeVibeIndex) fillWidth = "100%";
              else if (idx === activeVibeIndex) fillWidth = `${progress}%`;

              return (
                <div
                  key={v._id}
                  className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden backdrop-blur-sm"
                >
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                    style={{ width: fillWidth }}
                  />
                </div>
              );
            })}
          </div>

          {/* Creator Profile Info & Right Action Buttons */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentVibe.creator?.profilePic || "/avatar.png"}
                alt={currentVibe.creator?.fullName || "Creator"}
                className="w-9 h-9 rounded-full object-cover border border-white/30 shadow-md shrink-0"
              />
              <div className="leading-tight min-w-0">
                <p className="text-xs font-bold text-white truncate drop-shadow">
                  {currentVibe.creator?.fullName || "Group Member"}
                </p>
                <p className="text-[10px] text-white/70 truncate drop-shadow">
                  {currentVibe.createdAt
                    ? formatDistanceToNow(new Date(currentVibe.createdAt), { addSuffix: true })
                    : "Just now"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-white shrink-0">
              {currentVibe.music && (
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
              )}

              {isCreator && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-rose-400 hover:bg-rose-600/30 transition-colors"
                  title="Delete Vibe"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Floating live reaction particles */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {floatingReactions.map((particle) => (
            <div
              key={particle.id}
              className="absolute text-3xl animate-float-up opacity-90"
              style={{ left: `${particle.x}%`, bottom: "120px" }}
            >
              {particle.emoji}
            </div>
          ))}
        </div>

        {/* ==================================================================== */}
        {/* 3. BOTTOM INSTAGRAM BAR (Reply, Reactions, View Count) */}
        {/* ==================================================================== */}
        <div
          className={`relative z-20 p-3 pb-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-200 ${
            isHolding.current ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Reaction Shortcuts Bar */}
          <div className="flex items-center justify-between gap-1 mb-2.5 px-2 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
            {REACTION_EMOJIS.map((emoji) => {
              const isSelected = currentVibe.myReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => reactToVibe(activeViewerGroupId, currentVibe._id, emoji)}
                  className={`text-xl p-1.5 rounded-full transition-transform active:scale-125 hover:scale-110 ${
                    isSelected ? "bg-white/20 ring-2 ring-rose-400 scale-110" : ""
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          {/* Reply Form / Viewers Launcher */}
          <div className="flex items-center gap-2">
            {!isCreator ? (
              <form onSubmit={handleReplySubmit} className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Reply to ${currentVibe.creator?.fullName?.split(" ")[0] || "story"}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full bg-black/60 border border-white/20 text-white placeholder-white/50 text-xs focus:outline-none focus:border-rose-400 backdrop-blur-md"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSendingReply}
                  className="p-2.5 rounded-full bg-rose-500 text-white disabled:opacity-40 hover:bg-rose-600 transition-colors shadow-lg"
                >
                  {isSendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => fetchVibeViewers(activeViewerGroupId, currentVibe._id)}
                className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-white/20 transition-colors shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-rose-400" />
                  <span>
                    {currentVibe.viewCount || 1} {currentVibe.viewCount === 1 ? "View" : "Views"}
                  </span>
                </div>
                <span className="text-[10px] text-white/70">Tap to see who viewed & reacted</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. VIEWERS DRAWER MODAL (Creator Only) */}
      {/* ==================================================================== */}
      {viewersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[70vh] flex flex-col overflow-hidden text-white shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-sm">Story Viewers & Reactions</h3>
              </div>
              <button
                type="button"
                onClick={closeViewersDrawer}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {viewersLoading ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-2">
                  <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
                  <p className="text-xs text-white/60">Loading viewers...</p>
                </div>
              ) : viewersList.length === 0 ? (
                <p className="text-center text-xs text-white/60 p-6">No viewers yet.</p>
              ) : (
                viewersList.map((viewer, idx) => {
                  const user = viewer.user || viewer;
                  const name = user.fullName || user.name || "Group Member";
                  const pic = user.profilePic || "/avatar.png";
                  const time = viewer.viewedAt
                    ? formatDistanceToNow(new Date(viewer.viewedAt), { addSuffix: true })
                    : "Recently";

                  return (
                    <div
                      key={user._id || viewer._id || idx}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={pic}
                          alt={name}
                          className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-md shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{name}</p>
                          <p className="text-[10px] text-white/60">{time}</p>
                        </div>
                      </div>
                      {viewer.reaction && (
                        <span className="text-xl bg-black/60 px-2.5 py-1 rounded-full border border-white/20 shadow-md animate-in zoom-in-50 duration-150 shrink-0">
                          {viewer.reaction}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
