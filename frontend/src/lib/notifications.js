// Notification utility — Windows + mobile, no page reload on click

const DEFAULT_ICON = "/avatar.png";

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
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted" && showTest) {
      await showBrowserNotification("ChatAppey Notifications Enabled!", {
        body: "You will now receive message and call notifications",
        icon: DEFAULT_ICON,
        url: "/",
        requireInteraction: false,
      });
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
    tag: options.tag || "chat-message",
    renotify: true,
    requireInteraction: !!options.requireInteraction,
    silent: options.silent ?? false,
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
  const mobile = isMobileDevice();

  // On Mobile or backgrounded tab, Service Worker registration.showNotification is mandatory
  if (mobile || document.hidden) {
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
  }

  // Fallback or active desktop tab
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

export const isDocumentVisible = () => document.visibilityState === "visible";

/** Backgrounded or another window focused — use OS notification */
export const shouldShowSystemNotification = () =>
  document.hidden || !document.hasFocus();

/**
 * WhatsApp-style active chat check.
 * True only when this conversation is open on the chat screen AND the tab is
 * visible + focused. When true: append message only — no sound, toast, in-app,
 * or OS notification; unread stays 0; mark read immediately.
 */
export const isActivelyViewingConversation = (conversationId, selectedId) => {
  if (conversationId == null || selectedId == null) return false;
  const a =
    typeof conversationId === "object"
      ? String(conversationId._id ?? conversationId.id ?? "")
      : String(conversationId);
  const b =
    typeof selectedId === "object"
      ? String(selectedId._id ?? selectedId.id ?? "")
      : String(selectedId);
  if (!a || !b || a === "[object Object]" || b === "[object Object]") return false;
  if (a !== b) return false;
  try {
    // Chat UI only mounts on home; Settings/Calls/etc. must still notify
    if (window.location.pathname !== "/") return false;
  } catch (_) {
    return false;
  }
  if (shouldShowSystemNotification()) return false;
  return true;
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
