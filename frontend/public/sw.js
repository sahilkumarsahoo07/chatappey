// Service Worker — show notifications + seamless click (NO page reload)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
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

  event.waitUntil(
    self.registration.showNotification(data.title || "New Message", {
      body: data.body || "You have a new message",
      icon: data.icon || "/avatar.png",
      badge: "/avatar.png",
      tag: data.tag || "chat-message",
      requireInteraction: !!data.requireInteraction,
      silent: false,
      actions: [
        { action: "reply", title: "💬 Reply", type: "text", placeholder: "Type a reply..." },
      ],
      data: data.data || { url: data.url || "/" },
    })
  );
});

/**
 * Click → focus existing tab and postMessage only.
 * Never call client.navigate() — that reloads and freezes the UI.
 */
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

  // Handle inline notification reply directly in background — DO NOT OPEN BROWSER WINDOW
  if (userAction === "reply" && userReplyText) {
    event.waitUntil(
      (async () => {
        let sent = false;
        try {
          const endpoint = chatId
            ? `/api/messages/send/${encodeURIComponent(chatId)}`
            : groupId
              ? `/api/groups/${encodeURIComponent(groupId)}/messages`
              : null;

          if (endpoint) {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ text: userReplyText }),
            });
            if (res.ok) {
              sent = true;
            }
          }
        } catch (err) {
          console.error("Background notification reply failed:", err);
        }

        // Notify open window clients (if any exist) so they can update messages in background without taking focus
        const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        const originClients = windowClients.filter((c) => c.url.startsWith(self.location.origin));

        if (originClients.length > 0) {
          for (const client of originClients) {
            client.postMessage({
              type: "NOTIFICATION_REPLY_SENT",
              sent,
              chatId,
              groupId,
              replyText: userReplyText,
            });
          }
        }

        // If background send failed (e.g. session expired), fallback to opening/focusing window so user text is preserved
        if (!sent) {
          if (originClients.length > 0) {
            const target = originClients.find((c) => c.focused) || originClients[0];
            await target.focus();
            for (const client of originClients) {
              client.postMessage({
                type: "NOTIFICATION_CLICK",
                action: userAction,
                replyText: userReplyText,
                url: relativeUrl,
                chatId,
                groupId,
                peer: nData.peer,
                group: nData.group,
              });
            }
          } else if (clients.openWindow) {
            let openUrl = chatId
              ? new URL(`/?chat=${encodeURIComponent(chatId)}`, self.location.origin).href
              : groupId
                ? new URL(`/?group=${encodeURIComponent(groupId)}`, self.location.origin).href
                : urlToOpen;
            const u = new URL(openUrl);
            u.searchParams.set("replyText", userReplyText);
            await clients.openWindow(u.href);
          }
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
