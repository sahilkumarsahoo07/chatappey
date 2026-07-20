import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { openConversationFromNotification } from "./lib/openFromNotification.js";
import { axiosInstance } from "./lib/axios.js";
import { useChatStore } from "./store/useChatStore.js";
import { useGroupStore } from "./store/useGroupStore.js";

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
    if (event.data?.type === "EXECUTE_NOTIFICATION_REPLY") {
      const { chatId, groupId, replyText, clientMessageId } = event.data;
      if (!replyText) return;

      if (chatId) {
        axiosInstance.post(`/messages/send/${encodeURIComponent(chatId)}`, {
          text: replyText,
          clientMessageId,
          replyFromNotification: true,
        }).then(() => {
          const sel = useChatStore.getState().selectedUser;
          if (sel && String(sel._id) === String(chatId)) {
            useChatStore.getState().getMessages?.(chatId);
          } else {
            useChatStore.getState().refreshUsers?.();
          }
        }).catch((err) => console.error("Client side notification reply post error:", err));
      } else if (groupId) {
        axiosInstance.post(`/groups/${encodeURIComponent(groupId)}/messages`, {
          text: replyText,
          clientMessageId,
          replyFromNotification: true,
        }).then(() => {
          const sel = useGroupStore.getState().selectedGroup;
          if (sel && String(sel._id) === String(groupId)) {
            useGroupStore.getState().getGroupMessages?.(groupId);
          }
        }).catch((err) => console.error("Client side group notification reply post error:", err));
      }
      return;
    }

    if (event.data?.type === "NOTIFICATION_REPLY_SENT") {
      const { chatId, groupId } = event.data;
      if (chatId) {
        import("./store/useChatStore.js").then(({ useChatStore }) => {
          const sel = useChatStore.getState().selectedUser;
          if (sel && String(sel._id) === String(chatId)) {
            useChatStore.getState().getMessages?.(chatId);
          }
        });
      } else if (groupId) {
        import("./store/useGroupStore.js").then(({ useGroupStore }) => {
          const sel = useGroupStore.getState().selectedGroup;
          if (sel && String(sel._id) === String(groupId)) {
            useGroupStore.getState().getGroupMessages?.(groupId);
          }
        });
      }
      return;
    }

    if (event.data?.type === "NOTIFICATION_MARK_READ") {
      const { chatId, groupId } = event.data;
      if (chatId) {
        import("./store/useChatStore.js").then(({ useChatStore }) => {
          useChatStore.getState().markMessagesAsRead?.(chatId);
        });
      } else if (groupId) {
        import("./store/useGroupStore.js").then(({ useGroupStore }) => {
          useGroupStore.getState().markGroupMessagesAsRead?.(groupId);
        });
      }
      return;
    }

    if (event.data?.type !== "NOTIFICATION_CLICK") return;
    const opened = openConversationFromNotification({
      chatId: event.data.chatId,
      groupId: event.data.groupId,
      url: event.data.url,
      peer: event.data.peer,
      group: event.data.group,
      replyText: event.data.replyText,
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
            replyText: event.data.replyText,
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
    replyText: e.detail?.replyText,
  });
});
