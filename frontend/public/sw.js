// Service Worker — show notifications + seamless click (NO page reload)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

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

  let chatId = nData.chatId || null;
  let groupId = nData.groupId || null;
  if (!chatId && !groupId) {
    try {
      const params = new URL(urlToOpen).searchParams;
      chatId = params.get("chat");
      groupId = params.get("group");
    } catch (_) {
      /* ignore */
    }
  }

  const payload = {
    type: "NOTIFICATION_CLICK",
    url: relativeUrl,
    chatId,
    groupId,
    peer: nData.peer || null,
    group: nData.group || null,
  };

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      const matchingClient = windowClients.find((c) =>
        c.url.startsWith(self.location.origin)
      );

      if (matchingClient) {
        // Focus only — do NOT navigate (navigate = full reload + hang)
        await matchingClient.focus();
        matchingClient.postMessage(payload);
        return;
      }

      // App not open — open once (unavoidable cold start)
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
