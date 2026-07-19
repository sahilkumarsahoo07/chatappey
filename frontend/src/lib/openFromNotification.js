import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";

/** Normalize Mongo ids / populated refs to a plain string */
export function toEntityId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    const inner = value._id ?? value.id;
    if (inner == null) return null;
    return String(inner);
  }
  const s = String(value);
  return s === "[object Object]" ? null : s;
}

function sameEntityId(a, b) {
  const aa = toEntityId(a);
  const bb = toEntityId(b);
  return aa != null && bb != null && aa === bb;
}

function normalizeOpenPayload(raw = {}) {
  let { chatId, groupId, url, peer, group, replyText } = raw;

  if ((!chatId && !groupId) && url) {
    try {
      const search = url.includes("?") ? url.split("?")[1] : "";
      const params = new URLSearchParams(search);
      chatId = chatId || params.get("chat");
      groupId = groupId || params.get("group");
    } catch (_) {
      /* ignore */
    }
  }

  chatId = toEntityId(chatId);
  groupId = toEntityId(groupId);

  if (peer && typeof peer === "object") {
    peer = { ...peer, _id: toEntityId(peer._id) || chatId };
  }
  if (group && typeof group === "object") {
    group = { ...group, _id: toEntityId(group._id) || groupId };
  }

  return { chatId, groupId, url, peer, group, replyText };
}

/**
 * Seamlessly switch to a chat/group from a notification.
 * No page reload, no client.navigate() — Zustand + soft SPA home nav.
 */
export function openConversationFromNotification(raw = {}) {
  const payload = normalizeOpenPayload(raw);
  const { chatId, groupId, peer, group, replyText } = payload;

  if (!chatId && !groupId) return false;

  // Auth not ready yet (cold start / SW click before checkAuth) — retry after login
  if (!useAuthStore.getState().authUser) {
    try {
      sessionStorage.setItem("pendingNotificationOpen", JSON.stringify(payload));
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  // Off home: soft SPA navigate (handled in App) — never location.assign
  if (window.location.pathname !== "/") {
    try {
      sessionStorage.setItem("pendingNotificationOpen", JSON.stringify(payload));
    } catch (_) {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("spa-go-home-open-chat", {
        detail: payload,
      })
    );
    return true;
  }

  return applyConversationSwitch({ chatId, groupId, peer, group, replyText });
}

/** Instant store switch — sync, zero reload, zero hang */
export function applyConversationSwitch(raw = {}) {
  const { chatId, groupId, peer, group, replyText } = normalizeOpenPayload(raw);

  if (!chatId && !groupId) return false;

  if (chatId) {
    const existing = useChatStore
      .getState()
      .users.find((u) => sameEntityId(u._id, chatId));
    const user = existing
      ? { ...existing, ...(peer || {}), _id: chatId, chatDeletedForMe: false }
      : {
          isFriend: true,
          profilePic: "/avatar.png",
          chatDeletedForMe: false,
          fullName: peer?.fullName || "Chat",
          ...(peer || {}),
          _id: chatId,
        };

    // Opening chat clears local "deleted" hide flag
    if (existing?.chatDeletedForMe) {
      useChatStore.setState({
        users: useChatStore.getState().users.map((u) =>
          sameEntityId(u._id, chatId) ? { ...u, chatDeletedForMe: false } : u
        ),
      });
    }

    // Always clear group first so HomePage doesn't keep showing the group pane
    useGroupStore.setState({
      selectedGroup: null,
      groupMessages: [],
      groupMessagesMeta: {
        hasMoreOlder: true,
        isSyncing: false,
        oldestCursor: null,
        newestCursor: null,
      },
      typingUsers: [],
      isGroupMessagesLoading: false,
    });

    const prev = useChatStore.getState().selectedUser;
    useChatStore.getState().setSelectedUser(user);

    // If already on this DM, still refresh so notification feel is instant/up-to-date
    if (sameEntityId(prev?._id, chatId)) {
      useChatStore.getState().getMessages?.(chatId);
      useChatStore.getState().markMessagesAsRead?.(chatId);
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("focus-chat-input", { detail: { replyText } }));
    }, 100);

    return true;
  }

  if (groupId) {
    const existing = useGroupStore
      .getState()
      .groups.find((g) => sameEntityId(g._id, groupId));
    const g = existing
      ? { ...existing, ...(group || {}), _id: groupId }
      : {
          name: group?.name || "Group",
          image: group?.image,
          members: group?.members || [],
          ...(group || {}),
          _id: groupId,
        };

    // Clear DM selection so HomePage shows the group
    useChatStore.setState({
      selectedUser: null,
      messages: [],
      isTyping: false,
      isMessagesLoading: false,
    });

    const prev = useGroupStore.getState().selectedGroup;
    useGroupStore.getState().setSelectedGroup(g);

    if (sameEntityId(prev?._id, groupId)) {
      useGroupStore.getState().getGroupMessages?.(groupId);
      useGroupStore.getState().markGroupMessagesAsRead?.(groupId);
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("focus-chat-input", { detail: { replyText } }));
    }, 100);

    return true;
  }

  return false;
}

export function flushPendingNotificationOpen() {
  try {
    const raw = sessionStorage.getItem("pendingNotificationOpen");
    if (!raw) return false;
    if (!useAuthStore.getState().authUser) return false;
    sessionStorage.removeItem("pendingNotificationOpen");
    return applyConversationSwitch(JSON.parse(raw));
  } catch (_) {
    return false;
  }
}
