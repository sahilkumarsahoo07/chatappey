import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  Film,
  X,
  Lock,
  Users,
  Globe,
  UserX,
  UserCheck,
  Music2,
  Type,
  Sparkles,
  AtSign,
  Share2,
} from "lucide-react";
import { useStatusStore } from "../../store/useStatusStore";
import { useChatStore } from "../../store/useChatStore";
import { useStoryMusicStore } from "../../store/useStoryMusicStore";
import {
  MAX_VIDEO_SECONDS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  validateStatusFile,
  getVideoDuration,
  isVideoFile,
} from "../../lib/statusMedia";
import defaultImg from "../../public/avatar.png";
import StoryMusicPicker from "./StoryMusicPicker";
import MusicSticker from "./MusicSticker";
import MusicStoryCanvas from "./MusicStoryCanvas";
import StoryMentionPicker from "./StoryMentionPicker";
import StoryMentionSticker from "./StoryMentionSticker";
import "./storyMusic.css";

const PRIVACY_OPTIONS = [
  { id: "contacts", label: "My contacts", icon: Users, hint: "Friends only" },
  { id: "everyone", label: "Everyone", icon: Globe, hint: "Anyone on ChatAppey" },
  {
    id: "contacts_except",
    label: "Contacts except…",
    icon: UserX,
    hint: "Hide from some friends",
  },
  {
    id: "only_share_with",
    label: "Only share with…",
    icon: UserCheck,
    hint: "Selected friends",
  },
];

function formatMb(bytes) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export default function CreateStatusModal() {
  const {
    isCreateOpen,
    closeCreate,
    uploadStatus,
    isUploading,
    uploadProgress,
    uploadError,
    reStoryData,
  } = useStatusStore();
  const users = useChatStore((s) => s.users);
  const getUsers = useChatStore((s) => s.getUsers);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("contacts");
  const [excluded, setExcluded] = useState([]);
  const [included, setIncluded] = useState([]);
  const [localError, setLocalError] = useState("");
  const [videoMeta, setVideoMeta] = useState(null);
  const [validating, setValidating] = useState(false);
  const [mentions, setMentions] = useState([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  const inputRef = useRef(null);
  const previewStageRef = useRef(null);
  const submitLock = useRef(false);

  const selectedMusic = useStoryMusicStore((s) => s.selectedSong);
  const openMusicPicker = useStoryMusicStore((s) => s.openPicker);
  const clearSelectedMusic = useStoryMusicStore((s) => s.clearSelected);
  const updateSelectedSticker = useStoryMusicStore((s) => s.updateSelectedSticker);
  const setBackgroundTheme = useStoryMusicStore((s) => s.setBackgroundTheme);
  const setLayoutStyle = useStoryMusicStore((s) => s.setLayoutStyle);

  const friends = useMemo(
    () => (users || []).filter((u) => u.isFriend),
    [users]
  );

  useEffect(() => {
    if (isCreateOpen) getUsers();
  }, [isCreateOpen, getUsers]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!isCreateOpen) {
      setFile(null);
      setCaption("");
      setPrivacy("contacts");
      setExcluded([]);
      setIncluded([]);
      setLocalError("");
      setVideoMeta(null);
      setValidating(false);
      setMentions([]);
      setShowMentionPicker(false);
      submitLock.current = false;
      clearSelectedMusic();
    }
  }, [isCreateOpen, clearSelectedMusic]);

  const clearFile = useCallback(() => {
    setFile(null);
    setVideoMeta(null);
    setLocalError("");
  }, []);

  const handleSelectMentionUser = (user) => {
    if (mentions.some((m) => m.userId === user._id)) return;
    setMentions((prev) => [
      ...prev,
      {
        userId: user._id,
        username: user.username || user.fullName?.toLowerCase().replace(/\s+/g, ""),
        displayName: user.fullName,
        x: 0.5,
        y: 0.4 + prev.length * 0.1,
        scale: 1,
        rotation: 0,
        style: "default",
      },
    ]);
    setShowMentionPicker(false);
  };

  const handleUpdateMentionPosition = (userId, newPos) => {
    setMentions((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, ...newPos } : m))
    );
  };

  const handleRemoveMention = (userId) => {
    setMentions((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleCaptionChange = (e) => {
    const val = e.target.value;
    setCaption(val);
    if (val.endsWith("@")) {
      setShowMentionPicker(true);
    }
  };

  const onPick = useCallback(async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setLocalError("");
    const err = validateStatusFile(f);
    if (err) {
      setLocalError(err);
      return;
    }

    if (isVideoFile(f)) {
      setValidating(true);
      try {
        const sec = await getVideoDuration(f);
        if (sec > MAX_VIDEO_SECONDS + 0.5) {
          setLocalError(
            `Video is longer than ${MAX_VIDEO_SECONDS}s (${Math.round(sec)}s). Please choose a shorter clip.`
          );
          setValidating(false);
          return;
        }
        setVideoMeta({ duration: sec });
      } catch (ex) {
        console.warn("Duration check failed, continuing:", ex);
        setVideoMeta({ duration: 15 });
      } finally {
        setValidating(false);
      }
    } else {
      setVideoMeta(null);
    }

    setFile(f);
  }, []);

  const isVideo = file && isVideoFile(file);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current || isUploading) return;
    submitLock.current = true;
    setLocalError("");

    try {
      await uploadStatus({
        file,
        caption: caption.trim(),
        privacy,
        excludedUserIds: privacy === "contacts_except" ? excluded : [],
        includedUserIds: privacy === "only_share_with" ? included : [],
        music: selectedMusic,
        mentions: mentions.length > 0 ? mentions : undefined,
        restory: reStoryData || undefined,
      });
      closeCreate();
    } catch (err) {
      setLocalError(err.message || "Failed to upload status");
    } finally {
      submitLock.current = false;
    }
  };

  if (!isCreateOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-base-100 border border-base-300 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-[statusModalIn_0.25s_cubic-bezier(0.16,1,0.3,1)]">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
              {reStoryData ? (
                <>
                  <Share2 className="w-5 h-5 text-primary" />
                  <span>Re-Story</span>
                </>
              ) : (
                <>
                  <span>Create Story</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </>
              )}
            </h2>
            <p className="text-xs text-base-content/60">
              {reStoryData
                ? `Sharing @${reStoryData.originalUsername}'s story`
                : "Photo, Video, Text or Music Story · expires in 24h"}
            </p>
          </div>
          <button
            type="button"
            onClick={closeCreate}
            disabled={isUploading}
            className="p-2 rounded-full hover:bg-base-200 text-base-content/70 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (Hidden during Re-Story) */}
        {!reStoryData && (
          <div className="grid grid-cols-5 gap-1 p-2 bg-base-200/50 border-b border-base-300 text-center">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={onPick}
            />
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.accept = "image/*";
                  inputRef.current.click();
                }
              }}
              disabled={isUploading}
              className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${
                file && !isVideo ? "bg-primary text-primary-content shadow-sm" : "hover:bg-base-200 text-base-content/70"
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              <span>Photo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.accept = "video/*";
                  inputRef.current.click();
                }
              }}
              disabled={isUploading}
              className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${
                file && isVideo ? "bg-primary text-primary-content shadow-sm" : "hover:bg-base-200 text-base-content/70"
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Video</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.accept = "image/*,video/*";
                  inputRef.current.click();
                }
              }}
              disabled={isUploading}
              className="py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition hover:bg-base-200 text-base-content/70"
            >
              <Type className="w-4 h-4" />
              <span>Text</span>
            </button>
            <button
              type="button"
              onClick={openMusicPicker}
              disabled={isUploading}
              className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${
                selectedMusic && !file ? "bg-primary text-primary-content shadow-sm" : "hover:bg-base-200 text-base-content/70"
              }`}
            >
              <Music2 className="w-4 h-4" />
              <span>Music</span>
            </button>

            {/* @ Mention Sticker Button */}
            <button
              type="button"
              onClick={() => setShowMentionPicker((p) => !p)}
              disabled={isUploading}
              className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${
                mentions.length > 0 ? "bg-amber-500 text-black shadow-sm" : "hover:bg-base-200 text-base-content/70"
              }`}
            >
              <AtSign className="w-4 h-4" />
              <span>Mention</span>
            </button>
          </div>
        )}

        {/* Content Body & Canvas Stage */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative">
          {/* Mention Suggestions Popup */}
          {showMentionPicker && (
            <StoryMentionPicker
              selectedMentions={mentions}
              onSelectUser={handleSelectMentionUser}
              onClose={() => setShowMentionPicker(false)}
            />
          )}

          {/* Re-Story Preview Canvas */}
          {reStoryData ? (
            <div
              ref={previewStageRef}
              className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 w-full h-[380px] sm:h-[420px] flex flex-col items-center justify-center p-6 border border-white/15 shadow-2xl group"
            >
              <div className="relative z-10 w-full max-w-[240px] bg-black/60 backdrop-blur-2xl border border-white/20 rounded-3xl p-3.5 shadow-2xl flex flex-col gap-2.5 animate-[statusScaleUp_0.3s_ease-out]">
                <div className="flex items-center gap-2 text-xs font-bold text-white px-1">
                  <Share2 className="w-4 h-4 text-primary" />
                  <span className="truncate">@{reStoryData.originalUsername}</span>
                </div>
                <div className="relative aspect-[9/14] w-full rounded-2xl overflow-hidden shadow-lg border border-white/10">
                  <img
                    src={reStoryData.originalMediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white/90 font-medium truncate">
                    Originally shared by {reStoryData.originalDisplayName}
                  </div>
                </div>
              </div>

              {/* Render Mentions & Stickers on Re-Story Canvas */}
              {mentions.map((m) => (
                <StoryMentionSticker
                  key={m.userId}
                  mention={m}
                  editable={true}
                  onUpdatePosition={handleUpdateMentionPosition}
                  onRemove={handleRemoveMention}
                />
              ))}
            </div>
          ) : !file && !selectedMusic ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={validating || isUploading}
              className="w-full aspect-[9/12] max-h-[280px] rounded-2xl border-2 border-dashed border-base-300 hover:border-primary/50 bg-base-200/40 flex flex-col items-center justify-center gap-3 transition disabled:opacity-60"
            >
              {validating ? (
                <span className="loading loading-spinner loading-md text-primary" />
              ) : (
                <>
                  <div className="flex gap-2">
                    <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <ImagePlus className="w-5 h-5" />
                    </span>
                    <span className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                      <Film className="w-5 h-5" />
                    </span>
                    <span className="w-10 h-10 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                      <Music2 className="w-5 h-5" />
                    </span>
                  </div>
                  <p className="font-semibold text-sm">Add Photo, Video or Music</p>
                  <p className="text-xs text-base-content/45 px-6 text-center">
                    Tap Music above for Music Story or @ for Mentions
                    <br />
                    Images ≤ {formatMb(MAX_IMAGE_BYTES)} · Videos ≤ {formatMb(MAX_VIDEO_BYTES)}
                  </p>
                </>
              )}
            </button>
          ) : selectedMusic && !file ? (
            /* Music Only Story Canvas */
            <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[380px] sm:h-[420px] border border-white/10 group">
              <MusicStoryCanvas
                music={selectedMusic}
                editable={true}
                containerRef={previewStageRef}
                onThemeChange={(t) => setBackgroundTheme(t)}
                onLayoutChange={(l) => setLayoutStyle(l)}
              />

              {/* Render Mention Stickers */}
              {mentions.map((m) => (
                <StoryMentionSticker
                  key={m.userId}
                  mention={m}
                  editable={true}
                  onUpdatePosition={handleUpdateMentionPosition}
                  onRemove={handleRemoveMention}
                />
              ))}

              <div className="absolute top-2.5 right-2.5 flex gap-1.5 z-40">
                <button
                  type="button"
                  onClick={openMusicPicker}
                  disabled={isUploading}
                  className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold hover:bg-black/90 border border-white/15 transition-colors disabled:opacity-40 shadow-md"
                >
                  Change Song
                </button>
                <button
                  type="button"
                  onClick={clearSelectedMusic}
                  disabled={isUploading}
                  className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold hover:bg-black/90 border border-white/15 transition-colors disabled:opacity-40 shadow-md"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={previewStageRef}
              className="relative rounded-2xl overflow-hidden bg-slate-950 w-full h-[320px] sm:h-[360px] flex items-center justify-center border border-white/10 shadow-inner group"
            >
              {!isVideo && (
                <img
                  src={previewUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none"
                />
              )}
              {isVideo ? (
                <video
                  src={previewUrl}
                  className="relative z-10 max-w-full max-h-full object-contain rounded-lg"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Status preview"
                  className="relative z-10 max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              )}

              {/* Render Interactive Music Sticker */}
              {selectedMusic && (
                <MusicSticker
                  music={selectedMusic}
                  editable={true}
                  containerRef={previewStageRef}
                  onUpdatePosition={updateSelectedSticker}
                  onRemove={clearSelectedMusic}
                />
              )}

              {/* Render Interactive Mention Stickers */}
              {mentions.map((m) => (
                <StoryMentionSticker
                  key={m.userId}
                  mention={m}
                  editable={true}
                  onUpdatePosition={handleUpdateMentionPosition}
                  onRemove={handleRemoveMention}
                />
              ))}

              <div className="absolute top-3 right-3 flex gap-2 z-40">
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={isUploading}
                  className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-colors disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Caption Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-base-content/70">
                CAPTION (optional)
              </label>
              <button
                type="button"
                onClick={() => setShowMentionPicker(true)}
                className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1"
              >
                <AtSign className="w-3 h-3" /> Mention someone
              </button>
            </div>
            <textarea
              value={caption}
              onChange={handleCaptionChange}
              placeholder="Say something... (Type @ to mention friends)"
              rows={2}
              maxLength={500}
              disabled={isUploading}
              className="w-full rounded-2xl bg-base-200/60 border border-base-300 p-3 text-xs sm:text-sm focus:outline-none focus:border-primary transition resize-none disabled:opacity-50"
            />
            <p className="text-[10px] text-base-content/40 text-right mt-0.5">
              {caption.length}/500
            </p>
          </div>

          {/* Privacy Controls */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>WHO CAN SEE</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRIVACY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = privacy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPrivacy(opt.id)}
                    disabled={isUploading}
                    className={`p-2.5 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-base-300 hover:border-base-content/20 bg-base-200/30 text-base-content"
                    }`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate">
                        {opt.label}
                      </p>
                      <p className="text-[10px] opacity-70 truncate">
                        {opt.hint}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {localError && (
          <div className="px-5 py-2 bg-red-500/10 border-t border-red-500/20 text-red-500 text-xs text-center font-medium">
            {localError}
          </div>
        )}

        {uploadError && (
          <div className="px-5 py-2 bg-red-500/10 border-t border-red-500/20 text-red-500 text-xs text-center font-medium">
            {uploadError}
          </div>
        )}

        <div className="p-4 border-t border-base-300 bg-base-200/30 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={closeCreate}
            disabled={isUploading}
            className="btn btn-ghost btn-sm rounded-xl text-xs"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              (!file && !selectedMusic && !reStoryData) ||
              validating ||
              isUploading
            }
            className="btn btn-primary btn-sm rounded-xl px-6 text-xs font-semibold shadow-md flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                <span>Posting... {uploadProgress}%</span>
              </>
            ) : (
              <span>Post status</span>
            )}
          </button>
        </div>
      </div>

      {/* Story Music Sheet Picker Modal */}
      <StoryMusicPicker />
    </div>
  );
}
