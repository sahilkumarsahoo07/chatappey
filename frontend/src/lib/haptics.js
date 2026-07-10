/**
 * Native-like haptic patterns via Vibration API.
 * Falls back silently when unsupported (desktop, iOS Safari limitations, etc.).
 */

const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** Named patterns — keep short to avoid fatigue */
export const HapticPatterns = {
  light: [10],
  medium: [18],
  heavy: [30],
  success: [12, 40, 12],
  warning: [20, 30, 20],
  error: [40, 50, 40],
  selection: [8],
  send: [14],
  react: [12, 24, 12],
  doubleTap: [10, 30, 16],
  longPress: [22],
  delete: [25, 40, 25],
  upload: [12, 35, 12],
  download: [10, 30, 10],
  storyNav: [8],
  storyLike: [14, 28, 14],
  archive: [16],
  mute: [14],
  recordStart: [16],
  recordLock: [12, 28, 12],
  recordCancel: [30, 40, 20],
  recordSend: [14],
};

export function haptic(pattern = "light") {
  try {
    if (!canVibrate()) return false;
    const seq = Array.isArray(pattern)
      ? pattern
      : HapticPatterns[pattern] || HapticPatterns.light;
    navigator.vibrate(seq);
    return true;
  } catch {
    return false;
  }
}

export function hapticCancel() {
  try {
    if (canVibrate()) navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}

export default haptic;
