import React from "react";
import { Music, X, Sparkles } from "lucide-react";

export const STICKER_THEMES = ["classic", "rounded", "compact", "vinyl", "neon"];

export const InstagramMusicSticker = ({
  music,
  isPlaying = false,
  isEditable = false,
  onThemeChange,
  onRemove,
  onPointerDown,
  style = {},
  className = "",
}) => {
  if (!music || (!music.title && !music.name)) return null;

  const title = music.title || music.name || "Music";
  const artist = music.artist || music.artistName || "Unknown Artist";
  const artwork = music.artwork || music.thumbnail || "/music-placeholder.png";
  const theme = music.sticker?.theme || "classic";

  const renderEqualizer = (accentClass = "bg-rose-400") => (
    <div className="flex items-end gap-[2px] h-3.5 px-1 select-none">
      <div className={`w-[2.5px] rounded-full ${accentClass} ${isPlaying ? "animate-eq-bar-1" : "h-[30%]"}`} />
      <div className={`w-[2.5px] rounded-full ${accentClass} ${isPlaying ? "animate-eq-bar-2" : "h-[70%]"}`} />
      <div className={`w-[2.5px] rounded-full ${accentClass} ${isPlaying ? "animate-eq-bar-3" : "h-[40%]"}`} />
      <div className={`w-[2.5px] rounded-full ${accentClass} ${isPlaying ? "animate-eq-bar-4" : "h-[85%]"}`} />
    </div>
  );

  const handleStickerClick = (e) => {
    if (isEditable && onThemeChange) {
      e.stopPropagation();
      onThemeChange();
    }
  };

  return (
    <div
      onClick={handleStickerClick}
      onPointerDown={isEditable ? onPointerDown : undefined}
      onTouchStart={isEditable ? onPointerDown : undefined}
      style={style}
      className={`select-none touch-none transition-transform duration-150 active:scale-95 ${
        isEditable ? "cursor-grab active:cursor-grabbing" : ""
      } ${className}`}
    >
      {/* Theme 1: CLASSIC (Instagram Glass Pill) */}
      {theme === "classic" && (
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/20 text-white shadow-2xl ring-1 ring-white/10 hover:border-white/40">
          <img
            src={artwork}
            alt={title}
            className="w-8 h-8 rounded-full object-cover shadow border border-white/30 pointer-events-none"
            draggable={false}
          />
          <div className="leading-tight max-w-[150px] pointer-events-none">
            <p className="text-xs font-bold truncate drop-shadow">{title}</p>
            <p className="text-[10px] text-white/75 truncate drop-shadow">{artist}</p>
          </div>
          {renderEqualizer("bg-rose-400")}
          {isEditable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/20 transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Theme 2: ROUNDED (Instagram Glass Card) */}
      {theme === "rounded" && (
        <div className="flex items-center gap-3 p-2.5 pr-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-rose-500/30 text-white shadow-2xl">
          <img
            src={artwork}
            alt={title}
            className="w-10 h-10 rounded-xl object-cover shadow border border-white/20 pointer-events-none"
            draggable={false}
          />
          <div className="leading-tight max-w-[140px] pointer-events-none">
            <p className="text-xs font-extrabold truncate text-rose-300">{title}</p>
            <p className="text-[10px] text-white/70 truncate">{artist}</p>
          </div>
          {renderEqualizer("bg-cyan-400")}
          {isEditable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Theme 3: COMPACT (Minimal Pill) */}
      {theme === "compact" && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-white/25 text-white shadow-lg">
          <Music className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <p className="text-xs font-semibold truncate max-w-[160px] pointer-events-none">
            {title} • {artist}
          </p>
          {renderEqualizer("bg-amber-400")}
          {isEditable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-0.5 rounded-full text-white/60 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Theme 4: VINYL (Rotating Vinyl Record) */}
      {theme === "vinyl" && (
        <div className="flex items-center gap-3 p-2 pr-4 rounded-full bg-slate-950/85 backdrop-blur-2xl border border-white/20 text-white shadow-2xl">
          <div className="relative w-10 h-10 flex items-center justify-center pointer-events-none">
            <div
              className={`absolute inset-0 rounded-full bg-black border-2 border-slate-700 shadow-md ${
                isPlaying ? "animate-vinyl-spin" : ""
              }`}
            >
              <div className="absolute inset-1 rounded-full border border-slate-800" />
              <div className="absolute inset-2.5 rounded-full border border-slate-700" />
            </div>
            <img
              src={artwork}
              alt={title}
              className={`w-5 h-5 rounded-full object-cover border border-white/50 z-10 ${
                isPlaying ? "animate-vinyl-spin" : ""
              }`}
              draggable={false}
            />
          </div>
          <div className="leading-tight max-w-[130px] pointer-events-none">
            <p className="text-xs font-bold truncate text-amber-300">{title}</p>
            <p className="text-[10px] text-white/75 truncate">{artist}</p>
          </div>
          {renderEqualizer("bg-amber-400")}
          {isEditable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/20"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Theme 5: NEON (Glowing Glow Pill) */}
      {theme === "neon" && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-purple-900/90 via-indigo-950/90 to-rose-950/90 backdrop-blur-2xl border border-cyan-400/50 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]">
          <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
          <div className="leading-tight max-w-[140px] pointer-events-none">
            <p className="text-xs font-black truncate text-cyan-200 tracking-wide">{title}</p>
            <p className="text-[10px] text-purple-200 truncate">{artist}</p>
          </div>
          {renderEqualizer("bg-cyan-300")}
          {isEditable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/20"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
