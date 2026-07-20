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
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const res = await axiosInstance.get("/notifications/vapid-public-key");
    const publicKey = res.data?.publicKey;
    if (!publicKey) return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    const convertedKey = urlBase64ToUint8Array(publicKey);
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    if (subscription) {
      await axiosInstance.post("/notifications/subscribe", { subscription });
    }
  } catch (err) {
    console.error("Web Push subscription error:", err);
  }
};

export const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

export const isStandalonePWA = () => {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.navigator.standalone ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
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
 */
export const requestNotificationPermission = async ({ showTest = false } = {}) => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    subscribeToWebPush().catch(() => {});
    return true;
  }
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      subscribeToWebPush().catch(() => {});
      if (showTest) {
        await showBrowserNotification("ChatAppey Notifications Enabled!", {
          body: "You will now receive message and call notifications",
          icon: DEFAULT_ICON,
          url: "/",
          requireInteraction: false,
        });
      }
    }
    return permission === "granted";
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

export const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const shouldShowNotificationPrompt = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return false;

  try {
    const dismissedUntil = localStorage.getItem("notification_prompt_dismissed_until");
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      return false;
    }
  } catch (_) {}

  return true;
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
export const syncStateWithServiceWorker = (customState = {}) => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const documentVisible = customState.documentVisible ?? (typeof document !== "undefined" ? document.visibilityState === "visible" : true);
  const windowFocused = customState.windowFocused ?? (typeof document !== "undefined" ? document.hasFocus() : true);
  const activeConversationId = customState.activeConversationId !== undefined ? customState.activeConversationId : null;

  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

  const payload = {
    type: "SYNC_ACTIVE_CONVERSATION",
    activeConversationId: activeConversationId ? String(activeConversationId) : null,
    documentVisible,
    windowFocused,
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
    if (isAppActive) {
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
      // App is backgrounded/blurred — ALWAYS clear activeConversationId
      syncStateWithServiceWorker({ activeConversationId: null });
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

  const isSameConversation =
    incomingConversationId != null &&
    activeConversationId != null &&
    sameEntityId(incomingConversationId, activeConversationId);

  const isHomePath = typeof window !== "undefined" ? window.location.pathname === "/" : true;

  // RULE 1: User is actively viewing the exact conversation where message arrived
  if (isSameConversation && documentVisible && windowFocused && isHomePath) {
    const decision = { show: false, action: "SUPPRESS", reason: "ACTIVE_CONVERSATION_VISIBLE" };
    if (import.meta.env?.DEV) {
      console.log("[NotificationDecision]", decision);
    }
    return decision;
  }

  // RULE 2: App is visible and focused, but user is looking at a different chat / screen
  if (documentVisible && windowFocused) {
    const decision = { show: true, action: "IN_APP_NOTIFICATION", reason: "DIFFERENT_CONVERSATION_FOCUSED" };
    if (import.meta.env?.DEV) {
      console.log("[NotificationDecision]", decision);
    }
    return decision;
  }

  // RULE 3: App is in background, tab hidden, window blurred, or user on different page
  const decision = { show: true, action: "SYSTEM_NOTIFICATION", reason: "APP_IN_BACKGROUND_OR_BLURRED" };
  if (import.meta.env?.DEV) {
    console.log("[NotificationDecision]", decision);
  }
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

