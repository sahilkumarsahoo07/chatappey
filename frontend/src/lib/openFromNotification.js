import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

/**
 * Seamlessly switch to a chat/group from a notification.
 * No page reload, no client.navigate(), no network fetch — Zustand only.
 */
export function openConversationFromNotification({
  chatId,
  groupId,
  url,
  peer,
  group,
} = {}) {
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

  if (!chatId && !groupId) return false;

  // Off home: soft SPA navigate (handled in App) — never location.assign
  if (window.location.pathname !== "/") {
    window.dispatchEvent(
      new CustomEvent("spa-go-home-open-chat", {
        detail: { chatId, groupId, peer, group },
      })
    );
    return true;
  }

  return applyConversationSwitch({ chatId, groupId, peer, group });
}

/** Instant store switch — sync, zero reload, zero hang */
export function applyConversationSwitch({ chatId, groupId, peer, group } = {}) {
  if (chatId) {
    const existing = useChatStore.getState().users.find((u) => u._id === chatId);
    const user = existing
      ? { ...existing, ...(peer || {}), chatDeletedForMe: false }
      : peer && peer._id
        ? { isFriend: true, profilePic: "/avatar.png", chatDeletedForMe: false, ...peer }
        : {
            _id: chatId,
            fullName: peer?.fullName || "Chat",
            profilePic: peer?.profilePic || "/avatar.png",
            isFriend: true,
            chatDeletedForMe: false,
          };

    // Opening chat (e.g. from notification) clears local "deleted" hide flag
    if (existing?.chatDeletedForMe) {
      useChatStore.setState({
        users: useChatStore.getState().users.map((u) =>
          u._id === chatId ? { ...u, chatDeletedForMe: false } : u
        ),
      });
    }

    useGroupStore.setState({
      selectedGroup: null,
      groupMessages: [],
      typingUsers: [],
    });
    useChatStore.getState().setSelectedUser(user);
    return true;
  }

  if (groupId) {
    const existing = useGroupStore.getState().groups.find((g) => g._id === groupId);
    const g = existing
      ? { ...existing, ...(group || {}) }
      : group && group._id
        ? { members: [], ...group }
        : {
            _id: groupId,
            name: group?.name || "Group",
            image: group?.image,
            members: group?.members || [],
          };

    useChatStore.setState({
      selectedUser: null,
      messages: [],
      isTyping: false,
    });
    useGroupStore.getState().setSelectedGroup(g);
    return true;
  }

  return false;
}

export function flushPendingNotificationOpen() {
  try {
    const raw = sessionStorage.getItem("pendingNotificationOpen");
    if (!raw) return false;
    sessionStorage.removeItem("pendingNotificationOpen");
    return applyConversationSwitch(JSON.parse(raw));
  } catch (_) {
    return false;
  }
}
