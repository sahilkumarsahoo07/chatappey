import { useState, useMemo, useEffect } from "react";
import { Disc, Music, Sparkles, Volume2, Shuffle } from "lucide-react";
import MusicSticker from "./MusicSticker";

export const BACKGROUND_THEMES = [
  { id: "purple", name: "Purple Dream", bg: "from-purple-900 via-indigo-900 to-black", accent: "#a855f7" },
  { id: "blue", name: "Deep Ocean", bg: "from-blue-950 via-sky-900 to-slate-950", accent: "#38bdf8" },
  { id: "neon", name: "Cyber Neon", bg: "from-fuchsia-900 via-pink-900 to-purple-950", accent: "#f43f5e" },
  { id: "aurora", name: "Northern Lights", bg: "from-emerald-950 via-teal-900 to-cyan-950", accent: "#10b981" },
  { id: "sunset", name: "Vibrant Sunset", bg: "from-rose-900 via-amber-900 to-slate-950", accent: "#f97316" },
  { id: "dark", name: "Midnight Glow", bg: "from-zinc-950 via-neutral-900 to-black", accent: "#a1a1aa" },
  { id: "pastel", name: "Pastel Vibe", bg: "from-violet-900 via-pink-800 to-purple-950", accent: "#ec4899" },
  { id: "electric", name: "Electric Blue", bg: "from-indigo-950 via-blue-900 to-cyan-950", accent: "#60a5fa" },
  { id: "fire", name: "Crimson Flame", bg: "from-red-950 via-rose-900 to-orange-950", accent: "#ef4444" },
  { id: "gold", name: "Golden Hour", bg: "from-amber-950 via-yellow-900 to-slate-950", accent: "#eab308" },
];

export const LAYOUT_STYLES = [
  { id: "style1", label: "Large Artwork" },
  { id: "style2", label: "Minimal Sticker" },
  { id: "style3", label: "Vinyl Record" },
  { id: "style4", label: "Floating Card" },
  { id: "style5", label: "Lyrics Card" },
];

// Helper to derive a stable random gradient index from song ID/title
function getRandomThemeForSong(song) {
  if (!song) return BACKGROUND_THEMES[0];
  const str = String(song.id || song.title || "song");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % BACKGROUND_THEMES.length;
  return BACKGROUND_THEMES[index];
}

export default function MusicStoryCanvas({
  music,
  editable = false,
  isPlaying = true,
  containerRef,
  onThemeChange,
  onLayoutChange,
}) {
  // If no saved theme, pick deterministic random theme for this song
  const initialTheme = useMemo(() => {
    if (music?.backgroundTheme && music.backgroundTheme !== "purple") {
      return music.backgroundTheme;
    }
    return getRandomThemeForSong(music).id;
  }, [music]);

  const [activeTheme, setActiveTheme] = useState(initialTheme);
  const [activeLayout, setActiveLayout] = useState(music?.layoutStyle || "style1");

  useEffect(() => {
    if (music?.backgroundTheme) {
      setActiveTheme(music.backgroundTheme);
    }
  }, [music?.backgroundTheme]);

  const themeObj = useMemo(
    () =>
      BACKGROUND_THEMES.find((t) => t.id === activeTheme) ||
      BACKGROUND_THEMES[0],
    [activeTheme]
  );

  const currentLayout = music?.layoutStyle || activeLayout;
  const artworkUrl = music?.artwork || music?.thumbnail || "/avatar.png";

  const handleSelectTheme = (tId) => {
    setActiveTheme(tId);
    if (onThemeChange) onThemeChange(tId);
  };

  const handleRandomTheme = () => {
    const available = BACKGROUND_THEMES.filter((t) => t.id !== activeTheme);
    const randomObj = available[Math.floor(Math.random() * available.length)];
    if (randomObj) {
      handleSelectTheme(randomObj.id);
    }
  };

  const handleSelectLayout = (lId) => {
    setActiveLayout(lId);
    if (onLayoutChange) onLayoutChange(lId);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[360px] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b ${themeObj.bg} text-white select-none transition-all duration-700`}
    >
      {/* Background Animated Bokeh & Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-35 blur-3xl rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${themeObj.accent} 0%, transparent 70%)`,
          }}
        />
        <img
          src={artworkUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-125 transition-all duration-700"
        />
      </div>

      {/* Main Content Area - Centered with bottom padding to avoid control overlap */}
      <div className="relative z-10 w-full h-full px-4 pt-10 pb-28 flex flex-col items-center justify-center text-center">
        {/* Style 1: Large Artwork */}
        {currentLayout === "style1" && (
          <div className="flex flex-col items-center gap-3.5 max-w-xs animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative group">
              <img
                src={artworkUrl}
                alt={music?.title}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl object-cover shadow-2xl border-2 border-white/20 transform hover:scale-105 transition duration-300"
              />
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-3 py-0.5 rounded-full text-[11px] font-medium border border-white/15 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                <Music className="w-3 h-3 text-primary animate-bounce" />
                <span>Music Story</span>
              </div>
            </div>

            <div className="space-y-0.5 mt-1 max-w-[240px]">
              <h3 className="font-bold text-base sm:text-lg tracking-tight line-clamp-1 drop-shadow-md text-white">
                {music?.title || "Unknown Track"}
              </h3>
              <p className="text-xs font-medium text-white/80 line-clamp-1 drop-shadow">
                {music?.artist || "Unknown Artist"}
              </p>
            </div>

            {/* Animated Equalizer bars */}
            <div className="flex items-end gap-1 h-5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/15">
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
          <div className="flex flex-col items-center gap-4 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl animate-pulse">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-black/60 backdrop-blur-xl border border-white/20 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-[260px]">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Volume2 className="w-4 h-4 animate-pulse" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-bold text-xs line-clamp-1 text-white">
                  {music?.title || "Music Story"}
                </p>
                <p className="text-[11px] text-white/70 line-clamp-1">
                  {music?.artist || "Audio Track"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Style 3: Vinyl Record Animation */}
        {currentLayout === "style3" && (
          <div className="flex flex-col items-center gap-3 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
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
                <div className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center">
                    {/* Vinyl Center Art */}
                    <img
                      src={artworkUrl}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover border-2 border-amber-500/80 shadow-md"
                    />
                  </div>
                </div>
              </div>
              {/* Vinyl Center Hole */}
              <div className="absolute w-3 h-3 rounded-full bg-white border-2 border-black" />
            </div>

            <div className="space-y-0.5 max-w-[220px]">
              <h3 className="font-bold text-sm sm:text-base line-clamp-1 text-white">{music?.title}</h3>
              <p className="text-xs text-white/70 line-clamp-1">{music?.artist}</p>
            </div>
          </div>
        )}

        {/* Style 4: Floating Music Card */}
        {currentLayout === "style4" && (
          <div className="w-full max-w-[240px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2.5 animate-[statusFadeIn_0.3s_ease-out]">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg">
              <img
                src={artworkUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                <div className="text-left">
                  <p className="font-bold text-xs text-white line-clamp-1">
                    {music?.title}
                  </p>
                  <p className="text-[11px] text-white/80 line-clamp-1">
                    {music?.artist}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 text-[11px] text-white/70">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Instagram Music
              </span>
              <span className="font-mono text-[10px]">0:15</span>
            </div>
          </div>
        )}

        {/* Style 5: Lyric Style Card */}
        {currentLayout === "style5" && (
          <div className="flex flex-col items-center gap-3 max-w-[260px] text-center animate-[statusFadeIn_0.3s_ease-out]">
            <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-4 rounded-2xl shadow-2xl space-y-3">
              <p className="font-serif italic text-sm sm:text-base text-amber-200/90 leading-snug">
                "♫ {music?.title} — {music?.artist}"
              </p>
              <div className="flex items-center justify-center gap-2.5 pt-2 border-t border-white/10">
                <img
                  src={artworkUrl}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover border border-white/20"
                />
                <div className="text-left">
                  <p className="font-bold text-xs text-white line-clamp-1">
                    {music?.title}
                  </p>
                  <p className="text-[10px] text-white/60 line-clamp-1">
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

      {/* Editor Controls Toolbar for Theme & Layout Selection */}
      {editable && (
        <div className="absolute bottom-2 left-0 right-0 z-30 px-3 flex flex-col gap-2 items-center">
          {/* Layout Mode Selector Bar */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full px-2 py-1 bg-black/75 backdrop-blur-md rounded-full border border-white/20 no-scrollbar shadow-lg">
            {LAYOUT_STYLES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleSelectLayout(l.id)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                  currentLayout === l.id
                    ? "bg-white text-black shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Random Gradient Generator & Palette Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full px-2 py-1 bg-black/75 backdrop-blur-md rounded-full border border-white/20 no-scrollbar shadow-lg">
            {/* 🎲 Shuffle Random Theme Button */}
            <button
              type="button"
              onClick={handleRandomTheme}
              title="Random Background Gradient"
              className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-white transition transform active:scale-95 flex items-center justify-center mr-1"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Gradient Theme Dots */}
            {BACKGROUND_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTheme(t.id)}
                title={t.name}
                className={`w-5 h-5 rounded-full border-2 transition transform hover:scale-110 shrink-0 ${
                  activeTheme === t.id
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent opacity-75 hover:opacity-100"
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
