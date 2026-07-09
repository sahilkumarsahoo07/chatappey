import { CHAT_WALLPAPERS } from "../constants/appearance";

const PATTERN_STYLES = {
  dots: {
    backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
    backgroundSize: "20px 20px",
  },
  stripes: {
    backgroundImage:
      "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 20px)",
  },
  geometric: {
    backgroundImage:
      "linear-gradient(30deg, rgba(0,0,0,0.04) 12%, transparent 12.5%, transparent 87%, rgba(0,0,0,0.04) 87.5%, rgba(0,0,0,0.04)), linear-gradient(150deg, rgba(0,0,0,0.04) 12%, transparent 12.5%, transparent 87%, rgba(0,0,0,0.04) 87.5%, rgba(0,0,0,0.04))",
    backgroundSize: "40px 70px",
  },
  waves: {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg width='100' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q25 0 50 10 T100 10' stroke='rgba(0,0,0,0.05)' fill='none'/%3E%3C/svg%3E\")",
    backgroundSize: "100px 20px",
  },
  doodle: {
    backgroundImage: null, // handled via getDoodleLayer
    backgroundSize: "412px 412px",
  },
};

/** WhatsApp-style doodle tile (simplified icon pattern) */
function getDoodleLayer(theme = "light") {
  const stroke = theme === "dark" ? "%23ffffff" : "%23000000";
  const opacity = theme === "dark" ? "0.07" : "0.055";
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="412" height="412" viewBox="0 0 412 412">
    <g fill="none" stroke="${stroke}" stroke-width="1.2" opacity="${opacity}">
      <circle cx="40" cy="40" r="8"/><rect x="90" y="30" width="16" height="16" rx="3"/>
      <path d="M150 35 L158 50 L142 50 Z"/><circle cx="210" cy="45" r="6"/>
      <path d="M260 32 Q270 42 260 52 Q250 42 260 32"/><rect x="310" y="34" width="14" height="18" rx="2"/>
      <circle cx="370" cy="38" r="7"/><path d="M30 100 L45 100 M37.5 92.5 L37.5 107.5"/>
      <rect x="85" y="92" width="20" height="14" rx="4"/><circle cx="155" cy="100" r="9"/>
      <path d="M200 95 L215 105 L200 115 Z"/><circle cx="270" cy="102" r="5"/>
      <rect x="320" y="96" width="12" height="12" rx="6"/><path d="M370 98 L382 110 L358 110 Z"/>
      <circle cx="50" cy="165" r="6"/><path d="M100 158 Q110 168 100 178"/><rect x="150" y="160" width="18" height="12" rx="2"/>
      <circle cx="220" cy="168" r="8"/><path d="M270 162 L285 178 L255 178 Z"/><circle cx="330" cy="165" r="5"/>
      <rect x="380" y="158" width="14" height="16" rx="3"/><circle cx="35" cy="230" r="7"/>
      <path d="M90 225 L105 240 L90 255 Z"/><circle cx="145" cy="235" r="6"/>
      <rect x="195" y="228" width="16" height="16" rx="4"/><path d="M255 230 Q265 240 255 250"/>
      <circle cx="315" cy="232" r="9"/><rect x="365" y="226" width="20" height="14" rx="3"/>
      <circle cx="55" cy="300" r="5"/><path d="M110 295 L125 310 L95 310 Z"/><circle cx="170" cy="305" r="7"/>
      <rect x="225" y="298" width="14" height="14" rx="2"/><path d="M280 300 Q290 310 280 320"/>
      <circle cx="340" cy="302" r="6"/><rect x="385" y="296" width="12" height="18" rx="2"/>
      <circle cx="45" cy="370" r="8"/><path d="M100 365 L115 380 L85 380 Z"/><circle cx="165" cy="372" r="5"/>
      <rect x="215" y="368" width="16" height="12" rx="3"/><circle cx="275" cy="375" r="7"/>
      <path d="M330 370 Q340 380 330 390"/><rect x="375" y="366" width="18" height="14" rx="4"/>
    </g>
  </svg>`);
  return `url("data:image/svg+xml,${svg}")`;
}

function isDarkWallpaper(wallpaper) {
  if (!wallpaper || wallpaper.type === "default") return false;
  if (wallpaper.doodleTheme === "dark") return true;
  if (wallpaper.type === "solid" || wallpaper.type === "pattern") {
    const darkIds = CHAT_WALLPAPERS.dark?.map((d) => d.value) || [];
    if (darkIds.includes(wallpaper.value)) return true;
    const v = wallpaper.value?.toLowerCase() || "";
    if (v === "#0b141a" || v === "#111b21" || v === "#1f2937" || v.startsWith("#0") || v.startsWith("#1")) {
      return v.length <= 7 && parseInt(v.slice(1, 3), 16) < 60;
    }
  }
  return false;
}

function buildBaseBackground(wallpaper) {
  if (!wallpaper || wallpaper.type === "default" || wallpaper.value === "default") {
    return { background: "", backgroundSize: undefined };
  }

  if (wallpaper.type === "solid") {
    return { background: wallpaper.value, backgroundSize: undefined };
  }
  if (wallpaper.type === "gradient") {
    return { background: wallpaper.value, backgroundSize: undefined };
  }
  if (wallpaper.type === "pattern") {
    const p = PATTERN_STYLES[wallpaper.value] || PATTERN_STYLES.dots;
    if (wallpaper.value === "doodle") {
      const theme = wallpaper.doodleTheme || "light";
      return {
        background: getDoodleLayer(theme),
        backgroundSize: p.backgroundSize,
      };
    }
    return { background: p.backgroundImage, backgroundSize: p.backgroundSize };
  }
  if (wallpaper.type === "image") {
    return { background: `url(${wallpaper.value}) center/cover no-repeat`, backgroundSize: undefined };
  }
  return { background: "", backgroundSize: undefined };
}

export function resolveWallpaperStyle(wallpaper) {
  if (!wallpaper || wallpaper.type === "default" || wallpaper.value === "default") {
    return {};
  }

  const blur = wallpaper.blur || 0;
  const brightness = (wallpaper.brightness ?? 100) / 100;
  const filter = [
    blur > 0 ? `blur(${blur}px)` : null,
    brightness !== 1 ? `brightness(${brightness})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const base = buildBaseBackground(wallpaper);
  let background = base.background;
  let backgroundSize = base.backgroundSize;

  const showDoodle =
    wallpaper.doodle &&
    wallpaper.type !== "pattern" &&
    wallpaper.type !== "image";

  if (showDoodle) {
    const theme = wallpaper.doodleTheme || (isDarkWallpaper(wallpaper) ? "dark" : "light");
    const doodle = getDoodleLayer(theme);
    const baseBg = background || wallpaper.value || "#efeae2";
    background = `${doodle}, ${baseBg}`;
    backgroundSize = `412px 412px, auto`;
  }

  return {
    background,
    backgroundSize,
    filter: filter || undefined,
  };
}

/** Preview style for picker UI */
export function resolveWallpaperPreviewStyle(wallpaper) {
  const style = resolveWallpaperStyle(wallpaper);
  if (!style.background && (!wallpaper || wallpaper.type === "default")) {
    return {
      background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))",
    };
  }
  return {
    background: style.background,
    backgroundSize: style.backgroundSize,
    filter: style.filter,
  };
}

export function getDefaultWallpaper() {
  return { type: "default", value: "default", blur: 0, brightness: 100, doodle: false };
}

export function isWallpaperDark(wallpaper) {
  return isDarkWallpaper(wallpaper);
}

export { CHAT_WALLPAPERS };
