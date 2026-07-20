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

      // CRITICAL: Quick Reply is a background-only action.
      // Re-sync SW state with the ACTUAL current app visibility.
      // The user did NOT open the app — do NOT set activeConversationId.
      // This prevents stale state from suppressing future push notifications.
      import("./lib/notifications.js").then(({ syncStateWithServiceWorker }) => {
        // Sync with the real selectedUser/selectedGroup (NOT the replied-to conversation)
        const chatSel = useChatStore.getState().selectedUser;
        const groupSel = useGroupStore.getState().selectedGroup;
        const realActiveId = chatSel?._id || groupSel?._id || null;
        // Only pass the real active conversation if the app is actually visible + focused
        const isAppActuallyActive = document.visibilityState === "visible" && document.hasFocus();
        syncStateWithServiceWorker({
          activeConversationId: isAppActuallyActive ? realActiveId : null,
        });
      }).catch(() => {});

      if (chatId) {
        // Optimistic UI update: append immediately if this chat is open
        const sel = useChatStore.getState().selectedUser;
        const authUser = useChatStore.getState().authUser || (window.__INITIAL_AUTH_USER__);
        if (sel && String(sel._id) === String(chatId)) {
          const optimisticMsg = {
            _id: clientMessageId,
            clientMessageId,
            text: replyText,
            senderId: authUser?._id || "me",
            receiverId: chatId,
            createdAt: new Date().toISOString(),
            status: "sent",
            isOptimistic: true,
            pending: true,
          };
          useChatStore.setState((state) => ({
            messages: state.messages.concat(optimisticMsg),
          }));
        }

        axiosInstance.post(`/messages/send/${encodeURIComponent(chatId)}`, {
          text: replyText,
          clientMessageId,
          replyFromNotification: true,
        }).then((res) => {
          const currentSel = useChatStore.getState().selectedUser;
          if (currentSel && String(currentSel._id) === String(chatId) && res.data) {
            useChatStore.getState().getMessages?.(chatId, { reconcile: true, background: true });
          }
          useChatStore.getState().refreshUsers?.();
        }).catch((err) => console.error("Client side notification reply post error:", err));
      } else if (groupId) {
        axiosInstance.post(`/groups/${encodeURIComponent(groupId)}/messages`, {
          text: replyText,
          clientMessageId,
          replyFromNotification: true,
        }).then((res) => {
          const currentSel = useGroupStore.getState().selectedGroup;
          if (currentSel && String(currentSel._id) === String(groupId) && res.data) {
            useGroupStore.getState().getGroupMessages?.(groupId);
          }
        }).catch((err) => console.error("Client side group notification reply post error:", err));
      }
      return;
    }

    if (event.data?.type === "NOTIFICATION_REPLY_SENT") {
      const { chatId, groupId } = event.data;
      if (chatId) {
        const sel = useChatStore.getState().selectedUser;
        if (sel && String(sel._id) === String(chatId)) {
          useChatStore.getState().getMessages?.(chatId, { reconcile: true, background: true });
        } else {
          useChatStore.getState().refreshUsers?.();
        }
      } else if (groupId) {
        const sel = useGroupStore.getState().selectedGroup;
        if (sel && String(sel._id) === String(groupId)) {
          useGroupStore.getState().getGroupMessages?.(groupId);
        }
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
