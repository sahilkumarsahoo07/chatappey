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
};

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

  let background = "";
  let backgroundSize = undefined;

  if (wallpaper.type === "solid") {
    background = wallpaper.value;
  } else if (wallpaper.type === "gradient") {
    background = wallpaper.value;
  } else if (wallpaper.type === "pattern") {
    const p = PATTERN_STYLES[wallpaper.value] || PATTERN_STYLES.dots;
    background = p.backgroundImage;
    backgroundSize = p.backgroundSize;
  } else if (wallpaper.type === "image") {
    background = `url(${wallpaper.value}) center/cover no-repeat`;
  }

  return {
    background,
    backgroundSize,
    filter: filter || undefined,
  };
}

export function getDefaultWallpaper() {
  return { type: "default", value: "default", blur: 0, brightness: 100 };
}

export { CHAT_WALLPAPERS };
