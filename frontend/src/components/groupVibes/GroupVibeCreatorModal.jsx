import React, { useState, useRef, useEffect } from "react";
import { X, Image, Video, Music, Sparkles, Send, Volume2, VolumeX, Type, Palette } from "lucide-react";
import { useGroupVibeStore } from "../../store/useGroupVibeStore";
import { useStoryMusicStore } from "../../store/useStoryMusicStore";
import StoryMusicPicker from "../status/StoryMusicPicker";
import { audioManager } from "../../lib/audioManager";
import { toast } from "react-hot-toast";

import { useGroupStore } from "../../store/useGroupStore";

const BACKGROUND_GRADIENTS = [
  "linear-gradient(135deg, #130CB7 0%, #52E5E7 100%)",
  "linear-gradient(135deg, #69FF87 0%, #00E4FF 100%)",
  "linear-gradient(135deg, #EE9CA7 0%, #FFDDE1 100%)",
  "linear-gradient(135deg, #000000 0%, #434343 100%)",
  "linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)",
  "linear-gradient(135deg, #3A1C71 0%, #D76D77 50%, #FFAF7B 100%)",
];

export const GroupVibeCreatorModal = ({ groupId: propsGroupId, groupName: propsGroupName, onClose: propsOnClose }) => {
  const { isCreatorOpen, creatorGroupId, setCreatorOpen, createGroupVibe, isSubmitting } = useGroupVibeStore();
  const { groups } = useGroupStore();
  const { openPicker, selectedSong, clearSong, clipStart, clipDuration } = useStoryMusicStore();

  const activeGroupId = propsGroupId || creatorGroupId;
  const activeGroup = groups.find((g) => g._id === activeGroupId);
  const activeGroupName = propsGroupName || activeGroup?.name || "Group";

  const handleClose = propsOnClose || (() => setCreatorOpen(false, null));

  const [mode, setMode] = useState("media"); // 'media' | 'text'
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState("photo"); // 'photo' | 'video'
  const [text, setText] = useState("");
  const [gradientIndex, setGradientIndex] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const fileInputRef = useRef(null);

  if (!isCreatorOpen && !propsGroupId) return null;

  useEffect(() => {
    return () => {
      audioManager.stop();
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle media file selection
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const isVid = selected.type.startsWith("video/");
    const isImg = selected.type.startsWith("image/");

    if (!isVid && !isImg) {
      toast.error("Please select an image or video file");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selected);
    setMediaType(isVid ? "video" : "photo");
    setPreviewUrl(URL.createObjectURL(selected));
  };

  // Music playback preview in creator
  useEffect(() => {
    if (selectedSong?.audioUrl && !isAudioMuted) {
      audioManager.play({
        id: `creator_music_${selectedSong.id}`,
        url: selectedSong.audioUrl,
        volume: 0.8,
        loop: true,
      });
      if (clipStart > 0) {
        audioManager.seek(clipStart);
      }
    } else {
      audioManager.stop();
    }
  }, [selectedSong, clipStart, isAudioMuted]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "media" && !file) {
      toast.error("Please select a photo or video");
      return;
    }
    if (mode === "text" && !text.trim()) {
      toast.error("Please enter text for your Vibe");
      return;
    }

    const formData = new FormData();
    if (file) {
      formData.append("media", file);
    }
    formData.append("text", text);
    formData.append("caption", text);

    if (selectedSong) {
      const musicPayload = {
        id: selectedSong.id,
        title: selectedSong.title,
        artist: selectedSong.artist,
        artwork: selectedSong.artwork || selectedSong.thumbnail || "",
        audioUrl: selectedSong.audioUrl,
        sourceUrl: selectedSong.sourceUrl || "",
        clipStart,
        clipDuration,
      };
      formData.append("music", JSON.stringify(musicPayload));
    }

    // Temporary preview payload for instant UI update
    const tempPreviewPayload = {
      mediaType: mode === "text" ? "text" : mediaType,
      mediaUrl: previewUrl || "",
      text,
      music: selectedSong
        ? {
            title: selectedSong.title,
            artist: selectedSong.artist,
            artwork: selectedSong.artwork || selectedSong.thumbnail,
            audioUrl: selectedSong.audioUrl,
          }
        : null,
    };

    try {
      audioManager.stop();
      await createGroupVibe(activeGroupId, formData, tempPreviewPayload);
      handleClose();
    } catch (e) {
      // Error handled in store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md h-[90vh] max-h-[750px] bg-base-100 rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-base-content/10">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 inset-x-0 z-20 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-400 animate-spin-slow" />
            <div>
              <h3 className="font-bold text-sm leading-tight">Create Group Vibe</h3>
              <p className="text-xs text-white/70">{activeGroupName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              audioManager.stop();
              handleClose();
            }}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Canvas */}
        <div
          className="relative flex-1 flex flex-col items-center justify-center overflow-hidden bg-slate-900"
          style={
            mode === "text"
              ? { background: BACKGROUND_GRADIENTS[gradientIndex] }
              : {}
          }
        >
          {mode === "media" ? (
            file ? (
              mediaType === "video" ? (
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  loop
                  muted={isAudioMuted || !!selectedSong}
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Vibe Preview"
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-rose-400/50 hover:bg-white/5 transition-all text-center gap-3 text-white/70"
              >
                <div className="p-4 rounded-full bg-rose-500/20 text-rose-400">
                  <Image className="w-10 h-10" />
                </div>
                <div>
                  <p className="font-semibold text-white">Tap to upload Photo or Video</p>
                  <p className="text-xs text-white/50">MP4, WebM, PNG, JPG supported</p>
                </div>
              </div>
            )
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a group vibe status..."
              maxLength={500}
              className="w-full h-full bg-transparent resize-none p-8 pt-20 text-center font-bold text-2xl sm:text-3xl text-white placeholder-white/50 focus:outline-none flex items-center justify-center"
            />
          )}

          {/* Music Sticker Overlay */}
          {selectedSong && (
            <div className="absolute top-20 inset-x-4 flex justify-center z-10 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-xl max-w-xs">
                <img
                  src={selectedSong.artwork || selectedSong.thumbnail || "/music-placeholder.png"}
                  alt="Song cover"
                  className="w-10 h-10 rounded-xl object-cover animate-pulse"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{selectedSong.title}</p>
                  <p className="text-[10px] text-white/70 truncate">{selectedSong.artist}</p>
                </div>
                <button
                  type="button"
                  onClick={() => clearSong()}
                  className="text-white/60 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Caption input if media mode */}
          {mode === "media" && file && (
            <div className="absolute bottom-20 inset-x-4 z-10">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a caption..."
                maxLength={300}
                className="w-full px-4 py-3 rounded-full bg-black/60 backdrop-blur-md text-white placeholder-white/60 border border-white/20 focus:outline-none focus:border-rose-400 text-sm"
              />
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Bottom Toolbar & Action Bar */}
        <div className="p-4 bg-base-200 border-t border-base-content/10 flex items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-2">
            {/* Mode Selector */}
            <button
              type="button"
              onClick={() => setMode("media")}
              className={`p-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors ${
                mode === "media" ? "bg-primary text-primary-content" : "bg-base-300 hover:bg-base-100"
              }`}
            >
              <Image className="w-4 h-4" />
              Media
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`p-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors ${
                mode === "text" ? "bg-primary text-primary-content" : "bg-base-300 hover:bg-base-100"
              }`}
            >
              <Type className="w-4 h-4" />
              Text
            </button>

            {/* Gradient Switcher if Text Mode */}
            {mode === "text" && (
              <button
                type="button"
                onClick={() => setGradientIndex((prev) => (prev + 1) % BACKGROUND_GRADIENTS.length)}
                className="p-2.5 rounded-xl bg-base-300 hover:bg-base-100 text-xs flex items-center gap-1"
                title="Change background"
              >
                <Palette className="w-4 h-4" />
              </button>
            )}

            {/* Music Picker Launcher */}
            <button
              type="button"
              onClick={() => openPicker()}
              className={`p-2.5 rounded-xl flex items-center gap-1 text-xs font-medium transition-all ${
                selectedSong
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-base-300 hover:bg-base-100"
              }`}
            >
              <Music className="w-4 h-4" />
              {selectedSong ? "Change Music" : "Add Music"}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (mode === "media" && !file) || (mode === "text" && !text.trim())}
            className="btn btn-primary btn-circle shadow-lg hover:scale-105 transition-transform"
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Send className="w-5 h-5 ml-0.5" />
            )}
          </button>
        </div>

        {/* Global Story Music Picker Modal */}
        <StoryMusicPicker />
      </div>
    </div>
  );
};
