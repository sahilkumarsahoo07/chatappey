// Service Worker — show notifications + seamless click (NO page reload)

// Active conversation state synchronized from client app
let swActiveConversationId = null;
let swIsDocumentVisible = false;
let swIsWindowFocused = false;
let swLastSyncTimestamp = 0;
// After Quick Reply, ignore SYNC that would re-arm active chat until client is truly backgrounded.
let swIgnoreActiveConversationSync = false;

// Deduplication map for handled message notifications (by messageId ONLY)
const handledPushMessageKeys = new Set();

function notifTrace(stage, meta = {}) {
  const ts = new Date().toISOString().substring(11, 23);
  console.log(`[${ts}] ${stage}`, meta);
}

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

function clearSwActiveChatState(reason) {
  swActiveConversationId = null;
  swIsDocumentVisible = false;
  swIsWindowFocused = false;
  swLastSyncTimestamp = Date.now();
  swIgnoreActiveConversationSync = true;
  notifTrace("SW_ACTIVE_CHAT_CLEARED", { reason });
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
    const incomingActive = data.activeConversationId ? String(data.activeConversationId) : null;
    const docVisible = !!data.documentVisible;
    const winFocused = !!data.windowFocused;

    // After Quick Reply: only accept a re-arm when the client reports truly backgrounded
    // (clears the ignore latch). Never accept activeConversationId while ignore is set.
    if (swIgnoreActiveConversationSync) {
      if (!docVisible || !winFocused || !incomingActive) {
        swActiveConversationId = null;
        swIsDocumentVisible = false;
        swIsWindowFocused = false;
        swLastSyncTimestamp = data.timestamp || Date.now();
        if (!docVisible || !winFocused) {
          swIgnoreActiveConversationSync = false;
          notifTrace("SW_QR_IGNORE_LATCH_CLEARED", { docVisible, winFocused });
        }
      } else {
        notifTrace("SW_QR_SYNC_IGNORED", {
          attemptedActiveConversationId: incomingActive,
          docVisible,
          winFocused,
        });
        swLastSyncTimestamp = data.timestamp || Date.now();
      }
    } else {
      swActiveConversationId = incomingActive;
      swIsDocumentVisible = docVisible;
      swIsWindowFocused = winFocused;
      swLastSyncTimestamp = data.timestamp || Date.now();
    }

    if (data.authToken) {
      setStoredAuthToken(data.authToken);
    }
  }

  if (data.type === "MARK_NOTIFICATION_HANDLED" && data.messageKey) {
    markMessageHandled(data.messageKey);
  }

  if (data.type === "QUICK_REPLY_FORCE_CLEAR") {
    clearSwActiveChatState("client_force_clear");
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
  // Deduplicate ONLY by messageId / clientMessageId — never by conversationId alone
  const messageKey = payloadData.messageId || payloadData.clientMessageId;

  notifTrace("SW_PUSH_RECEIVED", {
    messageId: messageKey,
    conversationId: incomingId,
    tag: data.tag || null,
  });

  event.waitUntil(
    (async () => {
      // Check open window clients for active focus
      const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const originClients = windowClients.filter((c) => c.url.startsWith(self.location.origin));

      const activeClient = originClients.find((c) => c.focused || c.visibilityState === "visible");

      // Active Chat Suppression Rule:
      // Suppress ONLY when user is actively viewing this exact conversation in a focused browser tab.
      // Never suppress while Quick Reply ignore latch is set (QR is background-only).
      const syncFresh = swLastSyncTimestamp > 0 && (Date.now() - swLastSyncTimestamp) < 30000;
      const isViewingExactChat =
        !swIgnoreActiveConversationSync &&
        incomingId &&
        swActiveConversationId &&
        String(swActiveConversationId) === String(incomingId) &&
        syncFresh &&
        swIsDocumentVisible &&
        swIsWindowFocused &&
        activeClient &&
        activeClient.focused &&
        activeClient.visibilityState === "visible";

      notifTrace("SW_PUSH_DECISION", {
        messageId: messageKey,
        conversationId: incomingId,
        decision: isViewingExactChat ? "SUPPRESS" : "SHOW",
        swActiveConversationId,
        syncFresh,
        swIgnoreActiveConversationSync,
        clientFocused: !!(activeClient && activeClient.focused),
      });

      if (isViewingExactChat) {
        notifTrace("SW_PUSH_SUPPRESSED", {
          messageId: messageKey,
          conversationId: incomingId,
          reason: "ACTIVE_CONVERSATION_VISIBLE",
        });
        return;
      }

      // Deduplication check — messageId only
      if (messageKey && isMessageRecentlyHandled(messageKey)) {
        notifTrace("SW_PUSH_DEDUPE", {
          messageId: messageKey,
          conversationId: incomingId,
        });
        return;
      }
      if (messageKey) {
        markMessageHandled(messageKey);
      }

      // Conversation grouping tag (WhatsApp-style) — MUST renotify so Message 2 alerts
      // after Message 1 / Quick Reply instead of silently replacing.
      const notificationTag =
        data.tag ||
        (incomingChatId
          ? `chat-${incomingChatId}`
          : incomingGroupId
            ? `group-${incomingGroupId}`
            : "chat-message");
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
        messageId: payloadData.messageId || null,
        clientMessageId: payloadData.clientMessageId || null,
      };

      notifTrace("SHOW_NOTIFICATION", {
        messageId: messageKey,
        conversationId: incomingId,
        tag: notificationTag,
        renotify: true,
        messageCount,
      });

      await self.registration.showNotification(finalTitle, {
        body: finalBody,
        icon: data.icon || "/avatar.png",
        badge: "/avatar.png",
        tag: notificationTag,
        renotify: true,
        requireInteraction: !!data.requireInteraction,
        silent: false,
        timestamp: Date.now(),
        actions: [
          { action: "reply", title: "💬 Reply", type: "text", placeholder: "Type a reply..." },
          { action: "mark_read", title: "✓ Mark as Read" },
          { action: "open_chat", title: "💬 Open Chat" },
        ],
        data: updatedPayloadData,
      });

      notifTrace("NOTIFICATION_DISPLAYED", {
        messageId: messageKey,
        conversationId: incomingId,
        tag: notificationTag,
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
    clearSwActiveChatState("mark_read");

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
    notifTrace("QUICK_REPLY_STARTED", {
      conversationId: chatId || groupId,
      messageId: nData.messageId || null,
    });

    event.waitUntil(
      (async () => {
        // CRITICAL: Quick Reply is a background-only action.
        // Clear stale active conversation state IMMEDIATELY so that
        // subsequent push notifications are NEVER suppressed by leftover state.
        clearSwActiveChatState("quick_reply");

        const clientMessageId = "nr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        const originClients = windowClients.filter((c) => c.url.startsWith(self.location.origin));

        // 1. Fast Path: If client window is open, send via client session instantly
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
          notifTrace("QUICK_REPLY_MESSAGE_SENT", {
            path: "client_postMessage",
            conversationId: chatId || groupId,
            clientMessageId,
          });
          notifTrace("QUICK_REPLY_NOTIFICATION_CLOSED", {
            conversationId: chatId || groupId,
          });
          return;
        }

        // 2. Standalone Path: No client window open — perform direct SW background fetch
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

            const res = await fetch(endpoint, {
              method: "POST",
              headers,
              credentials: "include",
              body: JSON.stringify({
                text: userReplyText,
                clientMessageId,
                replyFromNotification: true,
              }),
            });
            notifTrace("QUICK_REPLY_MESSAGE_SENT", {
              path: "sw_fetch",
              conversationId: chatId || groupId,
              clientMessageId,
              status: res.status,
            });
            notifTrace(res.ok ? "QUICK_REPLY_SUCCESS" : "QUICK_REPLY_FAILED", {
              conversationId: chatId || groupId,
              clientMessageId,
              status: res.status,
            });
          }
        } catch (err) {
          console.error("Background notification reply fetch failed:", err);
          notifTrace("QUICK_REPLY_FAILED", {
            conversationId: chatId || groupId,
            error: String(err && err.message ? err.message : err),
          });
        }

        notifTrace("QUICK_REPLY_NOTIFICATION_CLOSED", {
          conversationId: chatId || groupId,
        });
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

// notificationclose must NOT suppress future notifications / change presence / start cooldowns
self.addEventListener("notificationclose", (event) => {
  const nData = (event.notification && event.notification.data) || {};
  notifTrace("NOTIFICATION_CLOSE", {
    messageId: nData.messageId || null,
    conversationId: nData.chatId || nData.groupId || null,
    // Explicitly no state mutation — close is informational only
  });
});
