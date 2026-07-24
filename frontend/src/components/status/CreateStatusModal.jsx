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
  const [videoMeta, setVideoMeta] = useState(null); // { duration }
  const [validating, setValidating] = useState(false);
  const inputRef = useRef(null);
  const previewStageRef = useRef(null);
  const submitLock = useRef(false);

  const selectedMusic = useStoryMusicStore((s) => s.selectedSong);
  const openMusicPicker = useStoryMusicStore((s) => s.openPicker);
  const clearSelectedMusic = useStoryMusicStore((s) => s.clearSelected);
  const updateSelectedSticker = useStoryMusicStore((s) => s.updateSelectedSticker);

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
      submitLock.current = false;
      clearSelectedMusic();
    }
  }, [isCreateOpen, clearSelectedMusic]);

  const clearFile = useCallback(() => {
    setFile(null);
    setVideoMeta(null);
    setLocalError("");
  }, []);

  const onPick = useCallback(async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setLocalError("");
    setValidating(true);
    try {
      validateStatusFile(f);

      if (isVideoFile(f)) {
        const duration = await getVideoDuration(f);
        if (duration > MAX_VIDEO_SECONDS + 0.35) {
          throw new Error(
            `Video is ${Math.ceil(duration)}s long. Please choose one under ${MAX_VIDEO_SECONDS} seconds.`
          );
        }
        setVideoMeta({ duration });
      } else {
        setVideoMeta(null);
      }

      setFile(f);
    } catch (err) {
      setFile(null);
      setVideoMeta(null);
      setLocalError(err.message || "Invalid file");
    } finally {
      setValidating(false);
    }
  }, []);

  const toggleId = (list, setList, id) => {
    setList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!file || isUploading || validating || submitLock.current) return;

    if (privacy === "only_share_with" && included.length === 0) {
      setLocalError("Select at least one friend to share with");
      return;
    }

    submitLock.current = true;
    setLocalError("");
    try {
      await uploadStatus({
        file,
        caption,
        privacy,
        excludedUserIds:
          privacy === "contacts_except" ? excluded : undefined,
        includedUserIds:
          privacy === "only_share_with" ? included : undefined,
        music: selectedMusic || undefined,
      });
      clearSelectedMusic();
    } catch {
      // store already toasts / sets uploadError
    } finally {
      submitLock.current = false;
    }
  };

  if (!isCreateOpen) return null;

  const isVideo = file ? isVideoFile(file) : false;
  const displayError = localError || uploadError;
  const canPost = !!file && !isUploading && !validating && !submitLock.current;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-[statusFadeIn_0.2s_ease-out]">
      <div className="bg-base-100 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-300 max-h-[92dvh] flex flex-col overflow-hidden animate-[statusSheetUp_0.28s_ease-out]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div>
            <h2 className="font-bold text-lg">Add status</h2>
            <p className="text-xs text-base-content/50">
              Photo or video (max {MAX_VIDEO_SECONDS}s) · expires in 24h
            </p>
          </div>
          <button
            type="button"
            onClick={closeCreate}
            disabled={isUploading}
            className="p-2 rounded-xl hover:bg-base-200 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!file ? (
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
                  <div className="flex gap-3">
                    <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <ImagePlus className="w-6 h-6" />
                    </span>
                    <span className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                      <Film className="w-6 h-6" />
                    </span>
                  </div>
                  <p className="font-semibold">Add status</p>
                  <p className="text-xs text-base-content/45 px-6 text-center">
                    JPG, PNG, WebP · MP4, MOV, WebM
                    <br />
                    Images ≤ {formatMb(MAX_IMAGE_BYTES)} · Videos ≤{" "}
                    {formatMb(MAX_VIDEO_BYTES)}
                  </p>
                </>
              )}
            </button>
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
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="relative z-10 max-w-full max-h-full object-contain drop-shadow-xl rounded-lg"
                />
              )}
              {selectedMusic && (
                <MusicSticker
                  music={selectedMusic}
                  playing
                  editable
                  containerRef={previewStageRef}
                  onChange={updateSelectedSticker}
                  onRemove={clearSelectedMusic}
                />
              )}
              <div className="absolute top-3 right-3 flex gap-2 z-40">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 transition-colors disabled:opacity-40"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              {isVideo && videoMeta && (
                <span className="absolute bottom-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white z-40">
                  {videoMeta.duration.toFixed(1)}s / {MAX_VIDEO_SECONDS}s
                </span>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mov"
            className="hidden"
            onChange={onPick}
          />

          {file && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={openMusicPicker}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition overflow-hidden ${
                  selectedMusic
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 hover:bg-base-200/60"
                }`}
              >
                <Music2 className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-[220px]">
                  {selectedMusic ? selectedMusic.title : "Add music"}
                </span>
              </button>
              {selectedMusic && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={clearSelectedMusic}
                  className="px-3 py-2.5 rounded-xl border border-base-300 text-xs font-semibold hover:bg-base-200 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
              Caption{" "}
              <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Say something…"
              className="mt-1.5 w-full rounded-xl border border-base-300 bg-base-200/40 px-3 py-2.5 text-sm outline-none focus:border-primary resize-none h-20"
              disabled={isUploading}
            />
            <p className="text-[11px] text-base-content/40 text-right mt-1">
              {caption.length}/500
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Lock className="w-3.5 h-3.5" />
              Who can see
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRIVACY_OPTIONS.map(({ id, label, icon: Icon, hint }) => (
                <button
                  key={id}
                  type="button"
                  disabled={isUploading}
                  onClick={() => setPrivacy(id)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition ${
                    privacy === id
                      ? "border-primary bg-primary/10"
                      : "border-base-300 hover:bg-base-200/60"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-sm">
                    <Icon className="w-4 h-4" />
                    {label}
                  </span>
                  <span className="text-[11px] text-base-content/45 block mt-0.5">
                    {hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {(privacy === "contacts_except" || privacy === "only_share_with") && (
            <div className="rounded-xl border border-base-300 max-h-40 overflow-y-auto">
              {friends.length === 0 ? (
                <p className="text-xs text-base-content/45 p-3">No friends yet</p>
              ) : (
                friends.map((f) => {
                  const list =
                    privacy === "contacts_except" ? excluded : included;
                  const setList =
                    privacy === "contacts_except" ? setExcluded : setIncluded;
                  const checked = list.includes(f._id);
                  return (
                    <label
                      key={f._id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-base-200/50 cursor-pointer border-b border-base-200 last:border-0"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={checked}
                        onChange={() => toggleId(list, setList, f._id)}
                        disabled={isUploading}
                      />
                      <img
                        src={f.profilePic || defaultImg}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className="text-sm font-medium truncate">
                        {f.fullName}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}

          {isUploading && (
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span>Uploading status…</span>
                <span>{uploadProgress}%</span>
              </div>
              <progress
                className="progress progress-primary w-full"
                value={uploadProgress}
                max="100"
              />
            </div>
          )}

          {displayError && (
            <p
              role="alert"
              className="text-sm text-error bg-error/10 rounded-xl px-3 py-2"
            >
              {displayError}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-base-300 flex gap-2">
          <button
            type="button"
            onClick={closeCreate}
            disabled={isUploading}
            className="btn btn-ghost flex-1 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canPost}
            className="btn btn-primary flex-1 rounded-xl"
          >
            {isUploading ? "Posting…" : "Post status"}
          </button>
        </div>
      </div>
      <StoryMusicPicker />
    </div>
  );
}
