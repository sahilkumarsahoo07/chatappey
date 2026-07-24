import React from "react";
import { Music, Sparkles } from "lucide-react";
import { InstagramMusicSticker } from "./InstagramMusicSticker";

export const MusicOnlyVibeView = ({ vibe, isPlaying = false }) => {
  if (!vibe?.music) return null;

  const title = vibe.music.title || "Music Story";
  const artist = vibe.music.artist || "Unknown Artist";
  const artwork = vibe.music.artwork || vibe.music.thumbnail || "/music-placeholder.png";

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 animate-aurora-bg">
      {/* Floating Glowing Orbs for Aurora Effect */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-600/30 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-rose-600/25 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/3 w-60 h-60 bg-cyan-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: "3s" }} />

      {/* Floating Particles Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-2 h-2 rounded-full bg-white/20 animate-ping" />
        <div className="absolute top-1/3 right-12 w-3 h-3 rounded-full bg-rose-400/30 animate-pulse" />
        <div className="absolute bottom-1/3 left-16 w-2.5 h-2.5 rounded-full bg-cyan-400/30 animate-bounce" />
      </div>

      {/* Center 3D Album Vinyl Card */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-sm">
        {/* Glow Ring */}
        <div className="relative mb-6 group">
          <div
            className={`absolute -inset-4 rounded-3xl bg-gradient-to-tr from-rose-500 via-purple-500 to-cyan-400 blur-xl opacity-60 transition-opacity duration-500 ${
              isPlaying ? "animate-pulse opacity-80" : "opacity-40"
            }`}
          />
          {/* Vinyl / Cover Art Container */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 flex items-center justify-center">
            <img
              src={artwork}
              alt={title}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? "scale-105" : "scale-100"
              }`}
            />

            {/* Overlaid Vinyl Spin Accent if playing */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
              <div
                className={`w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl ${
                  isPlaying ? "animate-spin-slow" : ""
                }`}
              >
                <Music className="w-6 h-6 text-rose-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Song & Artist Info */}
        <div className="space-y-1.5 mb-6 text-white">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight line-clamp-1 drop-shadow-md">
            {title}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-white/80 line-clamp-1 drop-shadow">
            {artist}
          </p>
        </div>

        {/* 5-Bar Waveform Equalizer */}
        <div className="flex items-end justify-center gap-1.5 h-8 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
          <div className={`w-1 rounded-full bg-rose-400 ${isPlaying ? "animate-eq-bar-1" : "h-[30%]"}`} />
          <div className={`w-1 rounded-full bg-purple-400 ${isPlaying ? "animate-eq-bar-2" : "h-[75%]"}`} />
          <div className={`w-1 rounded-full bg-cyan-400 ${isPlaying ? "animate-eq-bar-3" : "h-[45%]"}`} />
          <div className={`w-1 rounded-full bg-pink-400 ${isPlaying ? "animate-eq-bar-4" : "h-[90%]"}`} />
          <div className={`w-1 rounded-full bg-amber-400 ${isPlaying ? "animate-eq-bar-1" : "h-[25%]"}`} />
        </div>
      </div>

      {/* Optional Customized Sticker Position */}
      {vibe.music?.position && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: `${vibe.music.position.x ?? 50}%`,
            top: `${vibe.music.position.y ?? 25}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <InstagramMusicSticker music={vibe.music} isPlaying={isPlaying} />
        </div>
      )}
    </div>
  );
};
