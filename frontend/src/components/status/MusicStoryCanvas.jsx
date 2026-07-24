import { useState, useMemo } from "react";
import { Disc, Music, Sparkles, Volume2, Play } from "lucide-react";
import MusicSticker from "./MusicSticker";

export const BACKGROUND_THEMES = [
  { id: "purple", name: "Purple", bg: "from-purple-900 via-indigo-900 to-black", accent: "#a855f7" },
  { id: "blue", name: "Ocean", bg: "from-blue-900 via-sky-900 to-slate-950", accent: "#38bdf8" },
  { id: "neon", name: "Neon", bg: "from-fuchsia-900 via-pink-900 to-purple-950", accent: "#f43f5e" },
  { id: "aurora", name: "Aurora", bg: "from-emerald-900 via-teal-900 to-cyan-950", accent: "#10b981" },
  { id: "sunset", name: "Sunset", bg: "from-amber-900 via-rose-900 to-slate-950", accent: "#f97316" },
  { id: "dark", name: "Midnight", bg: "from-zinc-900 via-neutral-900 to-black", accent: "#a1a1aa" },
  { id: "pastel", name: "Vibe", bg: "from-violet-800 via-pink-800 to-purple-900", accent: "#ec4899" },
];

export const LAYOUT_STYLES = [
  { id: "style1", label: "Large Artwork" },
  { id: "style2", label: "Minimal Sticker" },
  { id: "style3", label: "Vinyl Record" },
  { id: "style4", label: "Floating Card" },
  { id: "style5", label: "Lyrics Card" },
];

export default function MusicStoryCanvas({
  music,
  editable = false,
  isPlaying = true,
  containerRef,
  onThemeChange,
  onLayoutChange,
  onStickerChange,
}) {
  const [activeTheme, setActiveTheme] = useState(
    music?.backgroundTheme || "purple"
  );
  const [activeLayout, setActiveLayout] = useState(
    music?.layoutStyle || "style1"
  );

  const themeObj = useMemo(
    () =>
      BACKGROUND_THEMES.find((t) => t.id === (music?.backgroundTheme || activeTheme)) ||
      BACKGROUND_THEMES[0],
    [music?.backgroundTheme, activeTheme]
  );

  const currentLayout = music?.layoutStyle || activeLayout;
  const artworkUrl = music?.artwork || music?.thumbnail || "/avatar.png";

  const handleSelectTheme = (tId) => {
    setActiveTheme(tId);
    if (onThemeChange) onThemeChange(tId);
  };

  const handleSelectLayout = (lId) => {
    setActiveLayout(lId);
    if (onLayoutChange) onLayoutChange(lId);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[380px] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b ${themeObj.bg} text-white select-none transition-all duration-500`}
    >
      {/* Background Animated Bokeh & Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-30 blur-3xl rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${themeObj.accent} 0%, transparent 70%)`,
          }}
        />
        <img
          src={artworkUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-125"
        />
      </div>

      {/* Main Layout Rendering */}
      <div className="relative z-10 w-full px-6 flex flex-col items-center justify-center text-center gap-4 py-8">
        {/* Style 1: Large Artwork */}
        {currentLayout === "style1" && (
          <div className="flex flex-col items-center gap-5 max-w-xs animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative group">
              <img
                src={artworkUrl}
                alt={music?.title}
                className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl object-cover shadow-2xl border-2 border-white/20 transform hover:scale-105 transition duration-300"
              />
              <div className="absolute -bottom-3 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium border border-white/10 flex items-center gap-1.5 shadow-lg">
                <Music className="w-3.5 h-3.5 text-primary animate-bounce" />
                <span>Music Story</span>
              </div>
            </div>

            <div className="space-y-1 mt-2">
              <h3 className="font-bold text-xl sm:text-2xl tracking-tight line-clamp-1 drop-shadow-md">
                {music?.title || "Unknown Track"}
              </h3>
              <p className="text-sm font-medium text-white/80 line-clamp-1 drop-shadow">
                {music?.artist || "Unknown Artist"}
              </p>
            </div>

            {/* Equalizer bars */}
            <div className="flex items-end gap-1 h-6 px-4 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
              {[40, 75, 100, 50, 90, 30, 80, 60].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full transition-all duration-300"
                  style={{
                    height: isPlaying ? `${h}%` : "30%",
                    animation: isPlaying ? `storyEqualizer 0.8s ease-in-out infinite alternate ${i * 0.1}s` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Style 2: Minimal Sticker Mode */}
        {currentLayout === "style2" && (
          <div className="flex flex-col items-center gap-6 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl animate-pulse">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-black/50 backdrop-blur-xl border border-white/20 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Volume2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <p className="font-bold text-base line-clamp-1 text-white">
                  {music?.title || "Music Story"}
                </p>
                <p className="text-xs text-white/70 line-clamp-1">
                  {music?.artist || "Audio Track"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Style 3: Vinyl Record Animation */}
        {currentLayout === "style3" && (
          <div className="flex flex-col items-center gap-6 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
              {/* Vinyl Record */}
              <div
                className={`w-full h-full rounded-full bg-zinc-950 border-4 border-zinc-800 shadow-2xl flex items-center justify-center ${
                  isPlaying ? "animate-[spin_6s_linear_infinite]" : ""
                }`}
                style={{
                  backgroundImage:
                    "radial-gradient(circle, #18181b 30%, #09090b 60%, #18181b 100%)",
                }}
              >
                {/* Vinyl Grooves */}
                <div className="w-44 h-44 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center">
                    {/* Vinyl Center Art */}
                    <img
                      src={artworkUrl}
                      alt=""
                      className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/80 shadow-md"
                    />
                  </div>
                </div>
              </div>
              {/* Vinyl Hole */}
              <div className="absolute w-4 h-4 rounded-full bg-white border-2 border-black" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-xl line-clamp-1">{music?.title}</h3>
              <p className="text-xs text-white/70 line-clamp-1">{music?.artist}</p>
            </div>
          </div>
        )}

        {/* Style 4: Floating Music Card */}
        {currentLayout === "style4" && (
          <div className="w-full max-w-xs bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                <div className="text-left">
                  <p className="font-bold text-lg text-white line-clamp-1">
                    {music?.title}
                  </p>
                  <p className="text-xs text-white/80 line-clamp-1">
                    {music?.artist}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 text-xs text-white/70">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Instagram Music
              </span>
              <span className="font-mono">0:15</span>
            </div>
          </div>
        )}

        {/* Style 5: Lyric Style Card */}
        {currentLayout === "style5" && (
          <div className="flex flex-col items-center gap-5 max-w-xs text-center animate-[statusFadeIn_0.3s_ease-out]">
            <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-6 rounded-3xl shadow-2xl space-y-4">
              <p className="font-serif italic text-lg sm:text-xl text-amber-200/90 leading-relaxed">
                "♫ Playing: {music?.title} — {music?.artist}"
              </p>
              <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10">
                <img
                  src={artworkUrl}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover border border-white/20"
                />
                <div className="text-left">
                  <p className="font-bold text-xs text-white line-clamp-1">
                    {music?.title}
                  </p>
                  <p className="text-[11px] text-white/60 line-clamp-1">
                    {music?.artist}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Interactive Music Sticker if present */}
        {music?.sticker && !editable && (
          <MusicSticker
            music={music}
            playing={isPlaying}
            editable={false}
          />
        )}
      </div>

      {/* Editor Controls for Theme & Layout Selection */}
      {editable && (
        <div className="absolute bottom-3 left-0 right-0 z-30 px-4 flex flex-col gap-2.5 items-center">
          {/* Layout Picker */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full p-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/15 no-scrollbar">
            {LAYOUT_STYLES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleSelectLayout(l.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  currentLayout === l.id
                    ? "bg-white text-black shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Theme Color Picker */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full p-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/15 no-scrollbar">
            {BACKGROUND_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTheme(t.id)}
                title={t.name}
                className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 ${
                  activeTheme === t.id
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent opacity-80"
                }`}
                style={{ backgroundColor: t.accent }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
