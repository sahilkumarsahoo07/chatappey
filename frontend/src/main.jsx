import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { openConversationFromNotification } from "./lib/openFromNotification.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Quiet update — don't force skipWaiting reload loops
      reg.update?.();
    }).catch(() => {});
  });

  // Seamless: switch chat in-place, zero reload
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "NOTIFICATION_CLICK") return;
    const opened = openConversationFromNotification({
      chatId: event.data.chatId,
      groupId: event.data.groupId,
      url: event.data.url,
      peer: event.data.peer,
      group: event.data.group,
    });
    // Auth / route not ready — keep pending for App flush
    if (!opened) {
      try {
        sessionStorage.setItem(
          "pendingNotificationOpen",
          JSON.stringify({
            chatId: event.data.chatId,
            groupId: event.data.groupId,
            url: event.data.url,
            peer: event.data.peer,
            group: event.data.group,
          })
        );
      } catch (_) {
        /* ignore */
      }
    }
  });
}

window.addEventListener("notification-open-chat", (e) => {
  openConversationFromNotification({
    chatId: e.detail?.chatId,
    groupId: e.detail?.groupId,
    url: e.detail?.url,
    peer: e.detail?.peer,
    group: e.detail?.group,
  });
});
