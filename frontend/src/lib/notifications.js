import { axiosInstance } from "./axios";

const DEFAULT_ICON = "/avatar.png";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeToWebPush = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "no_service_worker" };
  }
  if (!("PushManager" in window)) {
    return { ok: false, reason: "no_push_manager" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, reason: "permission_not_granted" };
  }
  // iOS Safari only delivers Web Push from a Home Screen installed PWA (iOS 16.4+)
  if (isIOSDevice() && !isStandalonePWA()) {
    return { ok: false, reason: "ios_install_required" };
  }

  try {
    const res = await axiosInstance.get("/notifications/vapid-public-key");
    const publicKey = res.data?.publicKey;
    if (!publicKey) return { ok: false, reason: "no_vapid" };

    const registration = await navigator.serviceWorker.ready;
    const convertedKey = urlBase64ToUint8Array(publicKey);

    let subscription = await registration.pushManager.getSubscription();

    // Always ensure server has the current subscription. If subscribe fails with
    // an existing (possibly stale/VAPID-mismatched) sub, drop and recreate.
    const saveSub = async (sub) => {
      await axiosInstance.post("/notifications/subscribe", { subscription: sub });
    };

    if (subscription) {
      try {
        await saveSub(subscription);
        console.log("[Push] Re-registered existing subscription");
        return { ok: true, subscription };
      } catch (err) {
        console.warn("[Push] Existing subscription rejected — recreating", err?.message || err);
        try {
          await subscription.unsubscribe();
        } catch (_) {}
        subscription = null;
      }
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    });
    await saveSub(subscription);
    console.log("[Push] New subscription saved");
    return { ok: true, subscription };
  } catch (err) {
    console.error("Web Push subscription error:", err);
    return { ok: false, reason: err?.message || "subscribe_failed" };
  }
};

export const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

export const isAndroidDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
};

export const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isStandalonePWA = () => {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.navigator.standalone ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
};

/** Whether this browser can receive background push like WhatsApp right now */
export const canReceiveBackgroundPush = () => {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (isIOSDevice() && !isStandalonePWA()) return false;
  return true;
};

const sameOriginIcon = (icon) => {
  try {
    const url = new URL(icon || DEFAULT_ICON, window.location.href);
    if (url.origin === window.location.origin) return url.href;
  } catch (_) {
    /* ignore */
  }
  return new URL(DEFAULT_ICON, window.location.href).href;
};

export const getNotificationPermission = () => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
};

/**
 * Request notification permission — MUST be called from a user click/tap (button).
 * Returns true only when permission is granted AND push subscription is saved (when possible).
 */
export const requestNotificationPermission = async ({ showTest = false } = {}) => {
  if (!("Notification" in window)) return false;

  // iOS: Web Push only works from Home Screen PWA — do not pretend Enable works in Safari tab
  if (isIOSDevice() && !isStandalonePWA()) {
    return false;
  }

  if (Notification.permission === "granted") {
    const sub = await subscribeToWebPush();
    if (showTest && sub?.ok) {
      await showBrowserNotification("ChatAppey Notifications Enabled!", {
        body: "You will now receive message alerts like WhatsApp — even when the app is closed.",
        icon: DEFAULT_ICON,
        url: "/",
        requireInteraction: false,
      });
    }
    return !!sub?.ok || Notification.permission === "granted";
  }
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const sub = await subscribeToWebPush();
      if (showTest) {
        await showBrowserNotification("ChatAppey Notifications Enabled!", {
          body: "You will now receive message alerts like WhatsApp — even when the app is closed.",
          icon: DEFAULT_ICON,
          url: "/",
          requireInteraction: false,
        });
      }
      refreshNotificationPermissionUI();
      return permission === "granted" && (sub?.ok !== false);
    }
    return false;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

export const refreshNotificationPermissionUI = () => {
  window.dispatchEvent(new Event("notification-permission-change"));
};

import { getPlatformNotificationActions } from "./platformNotifications.js";

const buildNotificationOptions = (options = {}) => {
  const toId = (value) => {
    if (value == null || value === "") return null;
    if (typeof value === "object") {
      const inner = value._id ?? value.id;
      if (inner == null) return null;
      return String(inner);
    }
    const s = String(value);
    return s === "[object Object]" ? null : s;
  };

  const url = options.url || options.data?.url || "/";
  let chatId = toId(options.chatId || options.data?.chatId);
  let groupId = toId(options.groupId || options.data?.groupId);
  if (!chatId && !groupId && url.includes("?")) {
    try {
      const params = new URLSearchParams(url.split("?")[1]);
      chatId = toId(params.get("chat"));
      groupId = toId(params.get("group"));
    } catch (_) {
      /* ignore */
    }
  }

  const peerRaw = options.peer || options.data?.peer || null;
  const groupRaw = options.group || options.data?.group || null;
  const peer = peerRaw
    ? { ...peerRaw, _id: toId(peerRaw._id) || chatId }
    : null;
  const group = groupRaw
    ? { ...groupRaw, _id: toId(groupRaw._id) || groupId }
    : null;

  return {
    icon: sameOriginIcon(options.icon),
    badge: sameOriginIcon(DEFAULT_ICON),
    body: options.body || "",
    tag: options.tag || (chatId ? `chat-${chatId}` : groupId ? `group-${groupId}` : "chat-message"),
    renotify: true,
    requireInteraction: !!options.requireInteraction,
    silent: options.silent ?? false,
    vibrate: options.vibrate || [200, 100, 200],
    timestamp: options.timestamp || Date.now(),
    actions: getPlatformNotificationActions(),
    data: {
      url:
        chatId
          ? `/?chat=${encodeURIComponent(chatId)}`
          : groupId
            ? `/?group=${encodeURIComponent(groupId)}`
            : url,
      chatId,
      groupId,
      messageId: options.messageId || options.data?.messageId || null,
      clientMessageId: options.clientMessageId || options.data?.clientMessageId || null,
      peer,
      group,
    },
  };
};

const showStandardNotification = (title, options) => {
  try {
    const notification = new Notification(title, options);

    notification.onclick = (event) => {
      event.preventDefault();
      notification.close();
      try {
        window.focus();
      } catch (_) {
        /* ignore */
      }

      import("./openFromNotification.js").then(({ openConversationFromNotification }) => {
        openConversationFromNotification({
          url: options.data?.url,
          chatId: options.data?.chatId,
          groupId: options.data?.groupId,
          peer: options.data?.peer,
          group: options.data?.group,
        });
      });
    };

    return notification;
  } catch (error) {
    console.error("[notify] Standard notification failed:", error);
    return null;
  }
};

export const shouldShowNotificationPrompt = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return false;
  // Full-screen NotificationPermissionBanner already gates login — don't stack a second modal
  return false;
};

export const dismissNotificationPromptLater = () => {
  try {
    const thirtyMinsLater = Date.now() + 30 * 60 * 1000;
    localStorage.setItem("notification_prompt_dismissed_until", String(thirtyMinsLater));
    refreshNotificationPermissionUI();
  } catch (e) {
    console.error("Error setting notification prompt snooze:", e);
  }
};

/**
 * Show system notification. Uses Service Worker for mobile (Android/iOS)
 * and tab hidden states, direct Notification API for desktop active window.
 */
export const showBrowserNotification = async (title, options = {}) => {
  if (!("Notification" in window)) {
    console.warn("[notify] Notification API not supported");
    return null;
  }
  if (Notification.permission !== "granted") {
    console.warn("[notify] Permission:", Notification.permission);
    return null;
  }

  const notificationOptions = buildNotificationOptions(options);
  // Prefer Service Worker showNotification whenever available so notification actions (reply text input) work
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions);
        return null;
      }
    } catch (err) {
      console.error("[notify] Service worker showNotification failed:", err);
    }
  }

  // Fallback if Service Worker is not registered
  return showStandardNotification(title, notificationOptions);
};

export const showInAppNotification = (message, sender, onClick) => {
  const notification = document.createElement("div");
  notification.className = "in-app-notification";
  notification.innerHTML = `
    <div class="flex items-center gap-3 p-4 bg-base-100 rounded-lg shadow-xl border border-base-300 cursor-pointer hover:shadow-2xl transition-all">
      <img src="${sender.profilePic || DEFAULT_ICON}" alt="${sender.fullName}" class="w-12 h-12 rounded-full object-cover border-2 border-primary" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-base-content truncate">${sender.fullName}</p>
        <p class="text-sm text-base-content/70 truncate">${message.text || "📷 Photo"}</p>
      </div>
    </div>
  `;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 99999;
    animation: slideInRight 0.3s ease-out; max-width: 350px;
  `;
  notification.onclick = () => {
    if (onClick) onClick();
    notification.remove();
  };
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  return notification;
};

export const playNotificationSound = () => {
  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (_) {
    /* ignore */
  }
};

const sameEntityId = (a, b) => {
  if (a == null || b == null) return false;
  const strA = typeof a === "object" ? String(a._id || a.id || "") : String(a);
  const strB = typeof b === "object" ? String(b._id || b.id || "") : String(b);
  if (!strA || !strB || strA === "[object Object]" || strB === "[object Object]") return false;
  return strA === strB;
};

// Notification Deduplication cache
const recentNotificationKeys = new Set();

export const isNotificationRecentlyShown = (key) => {
  if (!key) return false;
  return recentNotificationKeys.has(String(key));
};

export const recordNotificationShown = (key) => {
  if (!key) return;
  const strKey = String(key);
  recentNotificationKeys.add(strKey);
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "MARK_NOTIFICATION_HANDLED",
        messageKey: strKey,
      });
    }
  } catch (_) {}
  setTimeout(() => {
    recentNotificationKeys.delete(strKey);
  }, 10000);
};

/**
 * Service Worker active conversation state synchronization
 */
// After Quick Reply, block re-arming activeConversationId until the app is truly backgrounded.
let quickReplyGuardActive = false;

export const beginQuickReplyGuard = () => {
  quickReplyGuardActive = true;
  if (import.meta.env?.DEV) {
    console.log(`[${new Date().toISOString().substring(11, 23)}] QUICK_REPLY_GUARD_ON`);
  }
};

export const endQuickReplyGuardWhenBackgrounded = () => {
  const cleanup = () => {
    window.removeEventListener("visibilitychange", onBackground);
    window.removeEventListener("blur", onBackground);
    gestureEvts.forEach((e) => window.removeEventListener(e, onUserGesture));
  };

  const clearGuard = (reason) => {
    if (!quickReplyGuardActive) return;
    quickReplyGuardActive = false;
    if (import.meta.env?.DEV) {
      console.log(`[${new Date().toISOString().substring(11, 23)}] QUICK_REPLY_GUARD_OFF`, { reason });
    }
    cleanup();
  };

  const onBackground = () => {
    if (document.visibilityState === "hidden" || !document.hasFocus()) {
      clearGuard("background");
    }
  };

  // Real in-app interaction after QR — release guard so normal active-chat suppress resumes.
  // SW postMessage / axios will not fire these, so false wake from Quick Reply stays guarded.
  const onUserGesture = () => {
    if (document.visibilityState === "visible" && document.hasFocus()) {
      clearGuard("user_gesture");
    }
  };

  const gestureEvts = ["mousemove", "keydown", "touchstart", "click"];
  window.addEventListener("visibilitychange", onBackground);
  window.addEventListener("blur", onBackground);
  gestureEvts.forEach((e) => window.addEventListener(e, onUserGesture, { passive: true }));
  onBackground();
};

export const syncStateWithServiceWorker = (customState = {}) => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const documentVisible = customState.documentVisible ?? (typeof document !== "undefined" ? document.visibilityState === "visible" : true);
  const windowFocused = customState.windowFocused ?? (typeof document !== "undefined" ? document.hasFocus() : true);
  let activeConversationId = customState.activeConversationId !== undefined ? customState.activeConversationId : null;

  // Quick Reply guard: never re-arm active conversation while QR just ran
  if (quickReplyGuardActive) {
    activeConversationId = null;
  }

  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

  const payload = {
    type: "SYNC_ACTIVE_CONVERSATION",
    activeConversationId: activeConversationId ? String(activeConversationId) : null,
    documentVisible: quickReplyGuardActive ? false : documentVisible,
    windowFocused: quickReplyGuardActive ? false : windowFocused,
    authToken: token || null,
    timestamp: Date.now(),
  };

  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    }
  } catch (err) {
    console.error("[SW Sync Error]:", err);
  }
};

// Setup visibility & focus listeners to automatically sync SW state
if (typeof window !== "undefined") {
  const handleStateChange = () => {
    // When app goes to background/blurs, explicitly set activeConversationId to null
    // so the SW never retains stale state that could suppress notifications.
    const isAppActive = document.visibilityState === "visible" && document.hasFocus();
    if (isAppActive && !quickReplyGuardActive) {
      // App is active — sync real active conversation from stores
      Promise.all([
        import("../store/useChatStore.js"),
        import("../store/useGroupStore.js"),
      ]).then(([{ useChatStore }, { useGroupStore }]) => {
        const chatSel = useChatStore.getState()?.selectedUser;
        const groupSel = useGroupStore.getState()?.selectedGroup;
        syncStateWithServiceWorker({
          activeConversationId: chatSel?._id || groupSel?._id || null,
        });
      }).catch(() => {
        syncStateWithServiceWorker();
      });
    } else {
      // App is backgrounded/blurred OR Quick Reply guard — ALWAYS clear activeConversationId
      syncStateWithServiceWorker({ activeConversationId: null, documentVisible: false, windowFocused: false });
    }
  };
  window.addEventListener("visibilitychange", handleStateChange);
  window.addEventListener("focus", handleStateChange);
  window.addEventListener("blur", handleStateChange);
}

/**
 * Centralized Notification Decision Engine
 * Evaluates whether to SUPPRESS, show IN_APP_NOTIFICATION, or show SYSTEM_NOTIFICATION.
 */
export function shouldShowNotification({
  incomingConversationId,
  activeConversationId,
  documentVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true,
  windowFocused = typeof document !== "undefined" ? document.hasFocus() : true,
  senderId = null,
  currentUserId = null,
}) {
  // Never notify for messages sent by self
  if (senderId && currentUserId && sameEntityId(senderId, currentUserId)) {
    return { show: false, action: "SUPPRESS", reason: "SELF_MESSAGE" };
  }

  // Quick Reply just ran — treat as background. Do not suppress as "active chat".
  if (quickReplyGuardActive) {
    const decision = { show: true, action: "SYSTEM_NOTIFICATION", reason: "QUICK_REPLY_GUARD_BACKGROUND" };
    console.log(`[${new Date().toISOString().substring(11, 23)}] NOTIF_DECISION`, {
      conversationId: incomingConversationId,
      ...decision,
    });
    return decision;
  }

  const isSameConversation =
    incomingConversationId != null &&
    activeConversationId != null &&
    sameEntityId(incomingConversationId, activeConversationId);

  const isHomePath = typeof window !== "undefined" ? window.location.pathname === "/" : true;

  // RULE 1: User is actively viewing the exact conversation where message arrived
  if (isSameConversation && documentVisible && windowFocused && isHomePath) {
    const decision = { show: false, action: "SUPPRESS", reason: "ACTIVE_CONVERSATION_VISIBLE" };
    console.log(`[${new Date().toISOString().substring(11, 23)}] NOTIF_DECISION`, {
      conversationId: incomingConversationId,
      ...decision,
    });
    return decision;
  }

  // RULE 2: App is visible and focused, but user is looking at a different chat / screen
  if (documentVisible && windowFocused) {
    const decision = { show: true, action: "IN_APP_NOTIFICATION", reason: "DIFFERENT_CONVERSATION_FOCUSED" };
    console.log(`[${new Date().toISOString().substring(11, 23)}] NOTIF_DECISION`, {
      conversationId: incomingConversationId,
      ...decision,
    });
    return decision;
  }

  // RULE 3: App is in background, tab hidden, window blurred, or user on different page
  const decision = { show: true, action: "SYSTEM_NOTIFICATION", reason: "APP_IN_BACKGROUND_OR_BLURRED" };
  console.log(`[${new Date().toISOString().substring(11, 23)}] NOTIF_DECISION`, {
    conversationId: incomingConversationId,
    ...decision,
  });
  return decision;
}

export const isDocumentVisible = () => document.visibilityState === "visible";

/** Backgrounded or another window focused — use OS notification */
export const shouldShowSystemNotification = () =>
  document.hidden || !document.hasFocus();

/**
 * WhatsApp-style active chat check.
 */
export const isActivelyViewingConversation = (conversationId, selectedId) => {
  const decision = shouldShowNotification({
    incomingConversationId: conversationId,
    activeConversationId: selectedId,
  });
  return decision.action === "SUPPRESS";
};

const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
  .in-app-notification { font-family: inherit; }
`;
if (!document.getElementById("in-app-notification-styles")) {
  style.id = "in-app-notification-styles";
  document.head.appendChild(style);
}

