// Notification utility — Windows + mobile, no page reload on click

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;

  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await showBrowserNotification("ChatAppey Notifications Enabled!", {
          body: "You will now receive message and call notifications",
          icon: "/avatar.png",
          url: "/",
          requireInteraction: false,
        });
      }
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }
  return false;
};

/**
 * Show system notification. Pass url + optional peer/group for seamless open.
 * data.peer / data.group avoid refetch when clicking the toast.
 */
export const showBrowserNotification = async (title, options = {}) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  const url = options.url || options.data?.url || "/";
  let chatId = options.chatId || options.data?.chatId || null;
  let groupId = options.groupId || options.data?.groupId || null;
  if (!chatId && !groupId && url.includes("?")) {
    try {
      const params = new URLSearchParams(url.split("?")[1]);
      chatId = params.get("chat");
      groupId = params.get("group");
    } catch (_) {
      /* ignore */
    }
  }

  const notificationOptions = {
    icon: options.icon || "/avatar.png",
    badge: "/avatar.png",
    body: options.body || "",
    tag: options.tag || "chat-message",
    requireInteraction: !!options.requireInteraction,
    silent: options.silent ?? false,
    data: {
      url,
      chatId,
      groupId,
      peer: options.peer || options.data?.peer || null,
      group: options.group || options.data?.group || null,
    },
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, notificationOptions);
      return null;
    } catch (err) {
      console.error("SW notification failed, fallback:", err);
    }
  }

  return showStandardNotification(title, notificationOptions);
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

      // Instant store switch — never location.assign
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
    console.error("Error creating notification:", error);
    return null;
  }
};

export const showInAppNotification = (message, sender, onClick) => {
  const notification = document.createElement("div");
  notification.className = "in-app-notification";
  notification.innerHTML = `
    <div class="flex items-center gap-3 p-4 bg-base-100 rounded-lg shadow-xl border border-base-300 cursor-pointer hover:shadow-2xl transition-all">
      <img src="${sender.profilePic || "/avatar.png"}" alt="${sender.fullName}" class="w-12 h-12 rounded-full object-cover border-2 border-primary" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-base-content truncate">${sender.fullName}</p>
        <p class="text-sm text-base-content/70 truncate">${message.text || "📷 Photo"}</p>
      </div>
    </div>
  `;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
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
document.head.appendChild(style);
