import { useState, useMemo, useEffect } from "react";
import { Disc, Music, Sparkles, Volume2, Shuffle } from "lucide-react";
import MusicSticker from "./MusicSticker";

// 16 Modern Instagram Gradient Palettes
export const RANDOM_GRADIENTS = [
  { id: "purple_dream", bg: "from-purple-900 via-indigo-950 to-black", accent: "#a855f7" },
  { id: "sunset_vibe", bg: "from-rose-900 via-amber-900 to-slate-950", accent: "#f97316" },
  { id: "cyber_neon", bg: "from-fuchsia-950 via-pink-900 to-purple-950", accent: "#f43f5e" },
  { id: "emerald_aurora", bg: "from-emerald-950 via-teal-900 to-cyan-950", accent: "#10b981" },
  { id: "electric_blue", bg: "from-indigo-950 via-blue-900 to-slate-950", accent: "#38bdf8" },
  { id: "crimson_fire", bg: "from-red-950 via-rose-900 to-black", accent: "#ef4444" },
  { id: "midnight_spark", bg: "from-zinc-950 via-neutral-900 to-black", accent: "#a1a1aa" },
  { id: "pastel_violet", bg: "from-violet-900 via-pink-900 to-purple-950", accent: "#ec4899" },
  { id: "amber_golden", bg: "from-amber-950 via-yellow-900 to-slate-950", accent: "#eab308" },
  { id: "tropical_cyan", bg: "from-cyan-950 via-teal-900 to-indigo-950", accent: "#06b6d4" },
  { id: "twilight_rose", bg: "from-pink-950 via-purple-900 to-slate-950", accent: "#d946ef" },
  { id: "deep_ocean", bg: "from-blue-950 via-sky-950 to-slate-950", accent: "#0284c7" },
];

export const LAYOUT_STYLES = [
  { id: "style1", label: "Large Artwork" },
  { id: "style2", label: "Minimal Sticker" },
  { id: "style3", label: "Vinyl Record" },
  { id: "style4", label: "Floating Card" },
  { id: "style5", label: "Lyrics Card" },
];

// Helper to get a random gradient theme deterministically or randomly
function getRandomGradient(seed) {
  if (!seed) {
    return RANDOM_GRADIENTS[Math.floor(Math.random() * RANDOM_GRADIENTS.length)];
  }
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % RANDOM_GRADIENTS.length;
  return RANDOM_GRADIENTS[index];
}

export default function MusicStoryCanvas({
  music,
  editable = false,
  isPlaying = true,
  containerRef,
  onThemeChange,
  onLayoutChange,
}) {
  // Automatic random gradient generation (no manual color dots)
  const [gradientObj, setGradientObj] = useState(() => {
    if (music?.backgroundTheme && music.backgroundTheme.includes("from-")) {
      const match = RANDOM_GRADIENTS.find(g => g.bg === music.backgroundTheme);
      return match || getRandomGradient(music?.id || music?.title);
    }
    return getRandomGradient(music?.id || music?.title);
  });

  const [activeLayout, setActiveLayout] = useState(music?.layoutStyle || "style1");

  useEffect(() => {
    // Notify parent of the auto-assigned gradient class
    if (onThemeChange && gradientObj) {
      onThemeChange(gradientObj.bg);
    }
  }, [gradientObj]);

  const handleShuffleGradient = (e) => {
    if (e) e.stopPropagation();
    const available = RANDOM_GRADIENTS.filter((g) => g.id !== gradientObj.id);
    const next = available[Math.floor(Math.random() * available.length)];
    setGradientObj(next);
    if (onThemeChange) onThemeChange(next.bg);
  };

  const handleSelectLayout = (lId) => {
    setActiveLayout(lId);
    if (onLayoutChange) onLayoutChange(lId);
  };

  const currentLayout = music?.layoutStyle || activeLayout;
  const artworkUrl = music?.artwork || music?.thumbnail || "/avatar.png";

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[380px] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b ${gradientObj.bg} text-white select-none transition-all duration-700`}
    >
      {/* Ambient Animated Blurred Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-40 blur-3xl rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${gradientObj.accent} 0%, transparent 70%)`,
          }}
        />
        <img
          src={artworkUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-125 transition-all duration-700"
        />
      </div>

      {/* Main Centered Content Canvas Stage */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center text-center px-4 pt-10 pb-14 overflow-hidden">
        {/* Style 1: Large Artwork */}
        {currentLayout === "style1" && (
          <div className="flex flex-col items-center gap-3 max-w-[220px] animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative group">
              <img
                src={artworkUrl}
                alt={music?.title}
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover shadow-2xl border-2 border-white/20 transform hover:scale-105 transition duration-300"
              />
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/20 flex items-center gap-1 shadow-lg whitespace-nowrap">
                <Music className="w-3 h-3 text-primary animate-bounce" />
                <span>Music Story</span>
              </div>
            </div>

            <div className="space-y-0.5 mt-1 max-w-[200px]">
              <h3 className="font-bold text-sm sm:text-base tracking-tight line-clamp-1 drop-shadow-md text-white">
                {music?.title || "Unknown Track"}
              </h3>
              <p className="text-[11px] font-medium text-white/80 line-clamp-1 drop-shadow">
                {music?.artist || "Unknown Artist"}
              </p>
            </div>

            {/* Equalizer bars */}
            <div className="flex items-end gap-1 h-4 px-2.5 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/15">
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
          <div className="flex flex-col items-center gap-3.5 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-white/30 shadow-2xl animate-pulse">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-black/65 backdrop-blur-xl border border-white/20 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 max-w-[230px]">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-bold text-xs line-clamp-1 text-white">
                  {music?.title || "Music Story"}
                </p>
                <p className="text-[10px] text-white/70 line-clamp-1">
                  {music?.artist || "Audio Track"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Style 3: Vinyl Record Animation */}
        {currentLayout === "style3" && (
          <div className="flex flex-col items-center gap-2.5 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
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
                <div className="w-28 h-28 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center">
                    <img
                      src={artworkUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/80 shadow-md"
                    />
                  </div>
                </div>
              </div>
              <div className="absolute w-3 h-3 rounded-full bg-white border-2 border-black" />
            </div>

            <div className="space-y-0.5 max-w-[200px]">
              <h3 className="font-bold text-xs sm:text-sm line-clamp-1 text-white">{music?.title}</h3>
              <p className="text-[11px] text-white/70 line-clamp-1">{music?.artist}</p>
            </div>
          </div>
        )}

        {/* Style 4: Floating Music Card */}
        {currentLayout === "style4" && (
          <div className="w-full max-w-[210px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-2">
                <div className="text-left">
                  <p className="font-bold text-xs text-white line-clamp-1">
                    {music?.title}
                  </p>
                  <p className="text-[10px] text-white/80 line-clamp-1">
                    {music?.artist}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-white/70">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Instagram Music
              </span>
              <span className="font-mono text-[9px]">0:15</span>
            </div>
          </div>
        )}

        {/* Style 5: Lyric Style Card */}
        {currentLayout === "style5" && (
          <div className="flex flex-col items-center gap-2.5 max-w-[230px] text-center animate-[statusFadeIn_0.3s_ease-out]">
            <div className="bg-black/50 backdrop-blur-xl border border-white/15 p-3.5 rounded-2xl shadow-2xl space-y-2.5">
              <p className="font-serif italic text-xs sm:text-sm text-amber-200/90 leading-snug">
                "♫ {music?.title} — {music?.artist}"
              </p>
              <div className="flex items-center justify-center gap-2 pt-1.5 border-t border-white/10">
                <img
                  src={artworkUrl}
                  alt=""
                  className="w-7 h-7 rounded-md object-cover border border-white/20"
                />
                <div className="text-left">
                  <p className="font-bold text-[11px] text-white line-clamp-1">
                    {music?.title}
                  </p>
                  <p className="text-[9px] text-white/60 line-clamp-1">
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

      {/* Editor Layout Selector Toolbar (Clean, Scrollbar-Free, Random Gradient Button) */}
      {editable && (
        <div className="absolute bottom-2.5 left-0 right-0 z-30 px-3 flex items-center justify-center gap-2">
          {/* Layout Mode Selector Bar */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[85%] px-2 py-1 bg-black/80 backdrop-blur-md rounded-full border border-white/20 no-scrollbar shadow-xl scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {LAYOUT_STYLES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleSelectLayout(l.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                  currentLayout === l.id
                    ? "bg-white text-black shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* 🎲 Random Gradient Shuffle Button */}
          <button
            type="button"
            onClick={handleShuffleGradient}
            title="Random Gradient Background"
            className="p-2 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 active:scale-95 transition shadow-xl shrink-0"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400 animate-spin-once" />
          </button>
        </div>
      )}
    </div>
  );
}
