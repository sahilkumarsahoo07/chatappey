/**
 * Platform Capabilities & Native Notification Feature Detection
 * Supports Android (Native & PWA), iOS (Native & PWA), Windows, macOS, Desktop Browsers
 */

export const detectPlatform = () => {
  if (typeof navigator === "undefined") {
    return { os: "unknown", isMobile: false, isPWA: false, supportsActions: false, supportsInlineReply: false };
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  const isPWA = Boolean(
    window.navigator?.standalone ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );

  const isMobile = isAndroid || isIOS;

  // Feature Detection
  const hasNotificationAPI = typeof window !== "undefined" && "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;

  // Action button support detection
  const supportsActions = Boolean(
    hasNotificationAPI &&
    ("actions" in Notification.prototype || "maxActions" in Notification.prototype || hasServiceWorker)
  );

  // Native Inline Text Reply support detection
  // Chrome on Android, Chromium on Desktop, and Desktop PWAs support type: "text" in notification actions.
  // Standard iOS Safari / Desktop Safari may not support inline text action inputs natively in basic Web Push.
  const isChromium = /Chrome|Chromium|Edg|OPR/i.test(ua);
  const supportsInlineReply = supportsActions && (isChromium || isAndroid || isWindows || isPWA);

  return {
    os: isAndroid ? "android" : isIOS ? "ios" : isWindows ? "windows" : isMac ? "mac" : isLinux ? "linux" : "other",
    isMobile,
    isPWA,
    isChromium,
    supportsActions,
    supportsInlineReply,
  };
};

/**
 * Returns platform-optimized Notification Actions array
 */
export const getPlatformNotificationActions = () => {
  const platform = detectPlatform();

  const actions = [];

  // If inline reply is supported by OS/browser
  if (platform.supportsInlineReply) {
    actions.push({
      action: "reply",
      title: "💬 Reply",
      type: "text",
      placeholder: "Type a reply...",
    });
  }

  // Always offer Mark as Read & Open Chat if actions are supported
  if (platform.supportsActions) {
    actions.push(
      {
        action: "mark_read",
        title: "✓ Mark as Read",
      },
      {
        action: "open_chat",
        title: "💬 Open Chat",
      }
    );
  }

  return actions;
};
