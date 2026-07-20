// Service Worker — show notifications + seamless click (NO page reload)

// Active conversation state synchronized from client app
let swActiveConversationId = null;
let swIsDocumentVisible = false;
let swIsWindowFocused = false;
let swLastSyncTimestamp = 0;

// Deduplication map for handled message notifications
const handledPushMessageKeys = new Set();

function isMessageRecentlyHandled(key) {
  if (!key) return false;
  return handledPushMessageKeys.has(String(key));
}

function markMessageHandled(key) {
  if (!key) return;
  const strKey = String(key);
  handledPushMessageKeys.add(strKey);
  setTimeout(() => {
    handledPushMessageKeys.delete(strKey);
  }, 15000);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

let swAuthToken = null;

async function getStoredAuthToken() {
  if (swAuthToken) return swAuthToken;
  try {
    const cache = await caches.open("sw-auth-cache");
    const res = await cache.match("/sw-token");
    if (res) {
      const token = await res.text();
      swAuthToken = token;
      return token;
    }
  } catch (_) {}
  return null;
}

// Pre-warm token in memory on Service Worker startup
getStoredAuthToken();

async function setStoredAuthToken(token) {
  if (!token) return;
  swAuthToken = token;
  try {
    const cache = await caches.open("sw-auth-cache");
    await cache.put("/sw-token", new Response(token));
  } catch (_) {}
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "SYNC_ACTIVE_CONVERSATION") {
    swActiveConversationId = data.activeConversationId ? String(data.activeConversationId) : null;
    swIsDocumentVisible = !!data.documentVisible;
    swIsWindowFocused = !!data.windowFocused;
    swLastSyncTimestamp = data.timestamp || Date.now();
    if (data.authToken) {
      setStoredAuthToken(data.authToken);
    }
  }

  if (data.type === "MARK_NOTIFICATION_HANDLED" && data.messageKey) {
    markMessageHandled(data.messageKey);
  }
});

function toEntityId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    const inner = value._id ?? value.id;
    if (inner == null) return null;
    return String(inner);
  }
  const s = String(value);
  return s === "[object Object]" ? null : s;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "New Message",
      body: event.data ? event.data.text() : "You have a new message",
    };
  }

  const payloadData = data.data || {};
  const incomingChatId = toEntityId(payloadData.chatId);
  const incomingGroupId = toEntityId(payloadData.groupId);
  const incomingId = incomingChatId || incomingGroupId;
  const messageKey = payloadData.messageId || payloadData.clientMessageId;

  event.waitUntil(
    (async () => {
      // Check open window clients for active focus
      const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const originClients = windowClients.filter((c) => c.url.startsWith(self.location.origin));

      const activeClient = originClients.find((c) => c.focused || c.visibilityState === "visible");

      // Active Chat Suppression Rule:
      // If user is actively viewing this exact conversation in browser tab, SUPPRESS Web Push notification
      const isViewingExactChat =
        incomingId &&
        swActiveConversationId &&
        String(swActiveConversationId) === String(incomingId) &&
        (swIsDocumentVisible || (activeClient && activeClient.visibilityState === "visible")) &&
        (swIsWindowFocused || (activeClient && activeClient.focused));

      if (isViewingExactChat) {
        console.log(`[SW Push Suppressed] User is actively viewing conversation ${incomingId}`);
        return;
      }

      // Deduplication check
      if (messageKey && isMessageRecentlyHandled(messageKey)) {
        return;
      }
      if (messageKey) {
        markMessageHandled(messageKey);
      }

      const notificationTag = data.tag || (incomingChatId ? `chat-${incomingChatId}` : incomingGroupId ? `group-${incomingGroupId}` : "chat-message");
      const currentTitle = data.title || "New Message";
      const currentBody = data.body || "You have a new message";

      let finalTitle = currentTitle;
      let finalBody = currentBody;
      let messageCount = 1;
      let messageHistory = [currentBody];

      // Bundling / Grouping multiple messages from the same conversation
      try {
        const existingNotifications = await self.registration.getNotifications({ tag: notificationTag });
        if (existingNotifications && existingNotifications.length > 0) {
          const prevNotif = existingNotifications[0];
          const prevData = prevNotif.data || {};
          const prevCount = prevData.count || 1;
          const prevHistory = Array.isArray(prevData.messages) ? prevData.messages : [prevNotif.body];

          messageCount = prevCount + 1;
          messageHistory = [...prevHistory, currentBody].slice(-5); // Keep last 5 preview lines

          finalTitle = currentTitle;
          finalBody = `${messageCount} new messages\n${messageHistory.join("\n")}`;
        }
      } catch (err) {
        console.error("Error grouping notifications:", err);
      }

      const updatedPayloadData = {
        ...payloadData,
        count: messageCount,
        messages: messageHistory,
      };

      await self.registration.showNotification(finalTitle, {
        body: finalBody,
        icon: data.icon || "/avatar.png",
        badge: "/avatar.png",
        tag: notificationTag,
        requireInteraction: !!data.requireInteraction,
        silent: false,
        actions: [
          { action: "reply", title: "💬 Reply", type: "text", placeholder: "Type a reply..." },
          { action: "mark_read", title: "✓ Mark as Read" },
          { action: "open_chat", title: "💬 Open Chat" },
        ],
        data: updatedPayloadData,
      });
    })()
  );
});

/**
 * Click → focus existing tab and postMessage only.
 * Never call client.navigate() — that reloads and freezes the UI.
 */
function getApiBaseUrl() {
  if (self.location.origin.includes(":5173") || self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    return "http://localhost:5001/api";
  }
  return "https://chatappey.onrender.com/api";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const nData = event.notification.data || {};
  const relativeUrl = nData.url || "/";
  const urlToOpen = new URL(relativeUrl, self.location.origin).href;
  const userAction = event.action;
  const userReplyText = event.reply ? String(event.reply).trim() : null;

  let chatId = toEntityId(nData.chatId);
  let groupId = toEntityId(nData.groupId);
  if (!chatId && !groupId) {
    try {
      const params = new URL(urlToOpen).searchParams;
      chatId = toEntityId(params.get("chat"));
      groupId = toEntityId(params.get("group"));
    } catch (_) {
      /* ignore */
    }
  }

  // Handle Mark as Read directly in background — DO NOT OPEN OR FOCUS BROWSER WINDOW
  if (userAction === "mark_read") {
    event.waitUntil(
      (async () => {
        try {
          const apiBase = getApiBaseUrl();
          const endpoint = chatId
            ? `${apiBase}/messages/read/${encodeURIComponent(chatId)}`
            : groupId
              ? `${apiBase}/groups/${encodeURIComponent(groupId)}/messages/read`
              : null;

          if (endpoint) {
            const token = await getStoredAuthToken();
            const headers = { "Content-Type": "application/json" };
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }

            await fetch(endpoint, {
              method: "POST",
              headers,
              credentials: "include",
            });
          }
        } catch (err) {
          console.error("Background mark_read failed:", err);
        }

        const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        const originClients = windowClients.filter((c) => c.url.startsWith(self.location.origin));

        for (const client of originClients) {
          client.postMessage({
            type: "NOTIFICATION_MARK_READ",
            chatId,
            groupId,
          });
        }
      })()
    );
    return;
  }

  // Handle inline notification reply directly in background — ABSOLUTELY NEVER OPEN OR FOCUS BROWSER WINDOW
  if (userReplyText) {
    event.waitUntil(
      (async () => {
        const clientMessageId = "nr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        const originClients = windowClients.filter((c) => c.url.startsWith(self.location.origin));

        // 1. Fast Path: If client window is open, send via client session instantly in 0ms delay
        if (originClients.length > 0) {
          for (const client of originClients) {
            client.postMessage({
              type: "EXECUTE_NOTIFICATION_REPLY",
              chatId,
              groupId,
              replyText: userReplyText,
              clientMessageId,
            });
          }
          return;
        }

        // 2. Standalone Path: No client window open — perform direct SW background fetch with pre-warmed token
        try {
          const apiBase = getApiBaseUrl();
          const endpoint = chatId
            ? `${apiBase}/messages/send/${encodeURIComponent(chatId)}`
            : groupId
              ? `${apiBase}/groups/${encodeURIComponent(groupId)}/messages`
              : null;

          if (endpoint) {
            const token = await getStoredAuthToken();
            const headers = { "Content-Type": "application/json" };
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }

            await fetch(endpoint, {
              method: "POST",
              headers,
              credentials: "include",
              body: JSON.stringify({
                text: userReplyText,
                clientMessageId,
                replyFromNotification: true,
              }),
            });
          }
        } catch (err) {
          console.error("Background notification reply fetch failed:", err);
        }
      })()
    );
    return;
  }

  const payload = {
    type: "NOTIFICATION_CLICK",
    action: userAction,
    url: relativeUrl,
    chatId,
    groupId,
    peer: nData.peer
      ? { ...nData.peer, _id: toEntityId(nData.peer._id) || chatId }
      : null,
    group: nData.group
      ? { ...nData.group, _id: toEntityId(nData.group._id) || groupId }
      : null,
  };

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      const originClients = windowClients.filter((c) =>
        c.url.startsWith(self.location.origin)
      );

      if (originClients.length > 0) {
        // Prefer focused / visible tab so the open lands in the active session
        const target =
          originClients.find((c) => c.focused) ||
          originClients.find((c) => c.visibilityState === "visible") ||
          originClients[0];

        await target.focus();
        // Message all origin clients — avoids missing the React app if focus pick is wrong
        for (const client of originClients) {
          client.postMessage(payload);
        }
        return;
      }

      // App not open — open home with deep link (notification click = user gesture)
      if (clients.openWindow) {
        const openUrl = chatId
          ? new URL(`/?chat=${encodeURIComponent(chatId)}`, self.location.origin).href
          : groupId
            ? new URL(`/?group=${encodeURIComponent(groupId)}`, self.location.origin).href
            : urlToOpen;

        return clients.openWindow(openUrl);
      }
    })
  );
});

