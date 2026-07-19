import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import {
  showBrowserNotification,
  showInAppNotification,
  playNotificationSound,
  shouldShowSystemNotification,
  isActivelyViewingConversation,
} from "../lib/notifications";
import { haptic } from "../lib/haptics";
import { sendOrQueueMessage, reactOrQueue } from "./useNetworkStore";
import {
  hydrateThread,
  writeThread,
  writeMemoryThread,
  readMemoryThread,
  mergeMessages,
  removeThread,
} from "../lib/messageCache";
import { upsertMessage, applyServerAck, nextClientSeq, withServerOrdering, sortMessages } from "../lib/messageSync";
import {
  applyOptimisticDeleteForEveryone,
  deletedSidebarPreview,
  DELETED_TEXT_EVERYONE,
} from "../lib/messageDelete";
import {
  makeClientMessageId,
  messageMatchesIds,
  upgradeStatus,
  sameId,
} from "../lib/messageStatus";

const PAGE_SIZE = 40;

const getInitialUsers = () => {
  try {
    const cached = localStorage.getItem("chat_users_list");
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  return [];
};

const persistUsersCache = (usersList) => {
  try {
    if (Array.isArray(usersList)) {
      localStorage.setItem("chat_users_list", JSON.stringify(usersList));
    }
  } catch (e) {}
};

const persistDmThread = (userId, messages, meta = {}) => {
  if (!userId || !messages?.length) return;
  const payload = {
    messages,
    hasMoreOlder: meta.hasMoreOlder ?? false,
    oldestCachedAt: messages[0]?.createdAt,
    newestAt: messages[messages.length - 1]?.createdAt,
    syncedAt: Date.now(),
  };
  writeMemoryThread("dm", userId, payload);
  writeThread("dm", userId, payload).catch(() => {});
};

const parseMessagesResponse = (data) => {
  if (Array.isArray(data)) {
    return {
      messages: data,
      hasMore: false,
      oldestCursor: data[0]?.createdAt || null,
      newestCursor: data[data.length - 1]?.createdAt || null,
    };
  }
  return {
    messages: data?.messages || [],
    hasMore: Boolean(data?.hasMore),
    oldestCursor: data?.oldestCursor || null,
    newestCursor: data?.newestCursor || null,
  };
};

const sameUserId = (a, b) =>
  a != null && b != null && String(a) === String(b);

function messagePreview(msg) {
  if (msg?.text) return msg.text;
  if (msg?.image) return "📷 Photo";
  if (msg?.video) return "🎬 Video";
  if (msg?.audio) return "🎤 Voice message";
  if (msg?.file) return "📎 File";
  return "New message";
}

export const useChatStore = create((set, get) => ({
  messages: [],
  messagesMeta: { hasMoreOlder: false, isSyncing: false, oldestCursor: null, newestCursor: null },
  isLoadingOlder: false,
  users: getInitialUsers(),
  discoverUsers: [],
  selectedUser: null,
  isUsersLoading: false,
  isDiscoverLoading: false,
  isMessagesLoading: false,
  friendRequests: [],
  sentRequests: [],
  isFriendRequestsLoading: false,
  replyingToMessage: null,
  isTyping: false, // New state
  _isSubscribedToMessages: false,

  // Sidebar friends / chats list only — never pass a search query here
  getUsers: async () => {
    // Only set isUsersLoading to true if we don't have any cached users
    if (!get().users || get().users.length === 0) {
      set({ isUsersLoading: true });
    }
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
      persistUsersCache(res.data);
      get().prefetchChats(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Global Discover People search — keeps sidebar `users` intact
  searchDiscoverUsers: async (searchQuery = "") => {
    const q = (searchQuery || "").trim();
    if (q.length < 2) {
      set({ discoverUsers: [], isDiscoverLoading: false });
      return;
    }
    set({ isDiscoverLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users", {
        params: { search: q },
      });
      set({ discoverUsers: Array.isArray(res.data) ? res.data : [] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Search failed");
      set({ discoverUsers: [] });
    } finally {
      set({ isDiscoverLoading: false });
    }
  },

  clearDiscoverUsers: () => set({ discoverUsers: [], isDiscoverLoading: false }),

  // Refresh users silently without loading state (for real-time updates)
  refreshUsers: async () => {
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
      persistUsersCache(res.data);
    } catch (error) {
      // Silently fail, don't show error toast for background refresh
      console.error("Error refreshing users:", error);
    }
  },

  getMessages: async (userId, options = {}) => {
    if (!userId) return;

    const { before, after, background = false, reconcile = false } = options;
    const isInitial = !before && !after && !reconcile;
    const isOlder = Boolean(before);
    const isDelta = Boolean(after);
    const isReconcile = Boolean(reconcile);
    const requestUserId = String(userId);

    const stillOnThisChat = () =>
      sameId(get().selectedUser?._id, requestUserId);

    if (isInitial && !background) {
      const hydrated = await hydrateThread("dm", userId);
      if (hydrated?.messages?.length) {
        // Stale hydrate — user already switched chats
        if (!stillOnThisChat()) return;
        set({
          messages: hydrated.messages,
          messagesMeta: {
            hasMoreOlder: hydrated.hasMoreOlder ?? true,
            isSyncing: true,
            oldestCursor: hydrated.oldestCachedAt || hydrated.messages[0]?.createdAt,
            newestCursor: hydrated.newestAt || hydrated.messages[hydrated.messages.length - 1]?.createdAt,
          },
          isMessagesLoading: false,
        });
        // WhatsApp: show cache instantly, then delta-sync only (never wipe older history)
        const newest =
          hydrated.newestAt ||
          hydrated.messages[hydrated.messages.length - 1]?.createdAt;
        if (newest) {
          await get().getMessages(userId, { after: newest, background: true });
        }
        // Cache can be stale on ticks — refresh recent page for sent/delivered/read
        if (stillOnThisChat()) {
          await get().getMessages(userId, { reconcile: true, background: true });
        }
        if (stillOnThisChat()) get().markMessagesAsRead(userId);
        return;
      }
      if (!get().messages.length && stillOnThisChat()) {
        set({ isMessagesLoading: true });
      }
    }

    if (isOlder) set({ isLoadingOlder: true });

    try {
      const params = { limit: PAGE_SIZE };
      if (before) params.before = before;
      if (after) params.after = after;
      // reconcile: latest page with no cursor — merge statuses into cache

      const res = await axiosInstance.get(`/messages/${userId}`, { params });

      // Critical: never apply chat A's response onto chat B
      if (!stillOnThisChat()) {
        set({ isMessagesLoading: false, isLoadingOlder: false });
        return;
      }

      const { messages: incoming, hasMore, oldestCursor, newestCursor } =
        parseMessagesResponse(res.data);

      let nextMessages;
      if (isOlder || isDelta || isReconcile) {
        nextMessages = mergeMessages(get().messages, incoming);
      } else {
        nextMessages = incoming;
      }

      const prevMeta = get().messagesMeta || {};
      let hasMoreOlder = prevMeta.hasMoreOlder ?? true;
      if (isOlder || isInitial) {
        // API hasMore = more messages older than this page
        hasMoreOlder = Boolean(hasMore);
      }
      // Delta / reconcile must NEVER clear hasMoreOlder

      const meta = {
        hasMoreOlder,
        isSyncing: false,
        oldestCursor:
          nextMessages[0]?.createdAt || oldestCursor || prevMeta.oldestCursor || null,
        newestCursor:
          nextMessages[nextMessages.length - 1]?.createdAt ||
          newestCursor ||
          prevMeta.newestCursor ||
          null,
      };

      set({
        messages: nextMessages,
        messagesMeta: meta,
        isMessagesLoading: false,
        isLoadingOlder: false,
      });

      persistDmThread(userId, nextMessages, { hasMoreOlder });

      // ACK delivery for any undelivered messages we just loaded (peer was offline)
      const authUser = useAuthStore.getState().authUser;
      const sock = useAuthStore.getState().socket;
      if (sock && authUser) {
        nextMessages.forEach((m) => {
          if (
            sameId(m.receiverId, authUser._id) &&
            (m.status === "sent" || m.status === "delivered")
          ) {
            // Only ACK "sent" → delivered; skip if already read
            if (m.status === "sent") {
              sock.emit("messageReceived", {
                messageId: m._id,
                clientMessageId: m.clientMessageId,
                senderId: m.senderId?._id || m.senderId,
              });
            }
          }
        });
      }

      if (isInitial && !background && stillOnThisChat()) {
        get().markMessagesAsRead(userId);
      }

      // Delta can return one page — keep catching up while still on this chat
      if (isDelta && hasMore && incoming.length > 0 && stillOnThisChat()) {
        const newest =
          nextMessages[nextMessages.length - 1]?.createdAt || newestCursor;
        if (newest) {
          await get().getMessages(userId, { after: newest, background: true });
        }
      }
    } catch (error) {
      if (!stillOnThisChat()) {
        set({ isMessagesLoading: false, isLoadingOlder: false });
        return;
      }
      set({
        isMessagesLoading: false,
        isLoadingOlder: false,
        messagesMeta: { ...get().messagesMeta, isSyncing: false },
      });
      if (!background && get().messages.length === 0) {
        toast.error(error.response?.data?.message || "Failed to load messages");
      }
    }
  },

  loadOlderMessages: async () => {
    const { selectedUser, messages, messagesMeta, isLoadingOlder } = get();
    if (!selectedUser || isLoadingOlder || !messagesMeta?.hasMoreOlder) return;
    const oldest = messages[0]?.createdAt || messagesMeta.oldestCursor;
    if (!oldest) return;
    await get().getMessages(selectedUser._id, { before: oldest, background: true });
  },

  prefetchChats: async (usersList) => {
    const list = usersList || get().users;
    const ids = list.slice(0, 5).map((u) => u._id).filter(Boolean);
    for (const id of ids) {
      const mem = readMemoryThread("dm", id);
      if (mem?.syncedAt && Date.now() - mem.syncedAt < 120000) continue;
      try {
        const res = await axiosInstance.get(`/messages/${id}`, {
          params: { limit: PAGE_SIZE },
        });
        const { messages, hasMore } = parseMessagesResponse(res.data);
        if (messages.length) {
          persistDmThread(id, messages, { hasMoreOlder: hasMore });
        }
      } catch {
        /* background prefetch — silent */
      }
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, users, replyingToMessage } = get();
    const authUser = useAuthStore.getState().authUser;
    const socket = useAuthStore.getState().socket;

    haptic("send");

    // Offline queue — preserve order and show pending
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const queued = await sendOrQueueMessage(selectedUser._id, {
        ...messageData,
        replyTo: messageData.replyTo !== undefined ? messageData.replyTo : (replyingToMessage?._id || null),
      });
      if (queued.queued) {
        const pendingId = makeClientMessageId();
        const clientSeq = nextClientSeq();
        const clientCreatedAt = new Date().toISOString();
        const pendingMsg = {
          _id: pendingId,
          optimisticId: pendingId,
          clientMessageId: pendingId,
          clientSeq,
          clientCreatedAt,
          text: messageData.text,
          image: messageData.image,
          video: messageData.video,
          audio: messageData.audio,
          file: messageData.file,
          senderId: authUser._id,
          receiverId: selectedUser._id,
          // Display only — NOT used for ordering vs confirmed messages
          createdAt: clientCreatedAt,
          serverCreatedAt: null,
          isOptimistic: true,
          pending: true,
          status: "pending",
        };
        set({ messages: upsertMessage(get().messages, pendingMsg) });
        return;
      }
    }

    if (!socket) {
      toast.error("Connection error. Please refresh the page.");
      return;
    }

    // Stable client id for optimistic UI ↔ ACK ↔ delivery matching
    const clientMessageId = makeClientMessageId();
    const clientSeq = nextClientSeq();
    const clientCreatedAt = messageData.scheduledFor
      ? new Date(messageData.scheduledFor).toISOString()
      : new Date().toISOString();
    const optimisticMessage = {
      _id: clientMessageId,
      optimisticId: clientMessageId,
      clientMessageId,
      clientSeq,
      clientCreatedAt,
      text: messageData.text,
      image: messageData.image,
      video: messageData.video,
      videoThumbnail: messageData.videoThumbnail,
      videoDuration: messageData.videoDuration,
      audio: messageData.audio,
      file: messageData.file,
      poll: messageData.poll || null,
      scheduledFor: messageData.scheduledFor,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      // Display clock only — ordering uses pending-at-end until server ACK
      createdAt: clientCreatedAt,
      serverCreatedAt: null,
      isOptimistic: true,
      pending: !messageData.scheduledFor,
      // Always start as sent (single ✓) — never fake delivered from onlineUsers
      status: messageData.scheduledFor ? "scheduled" : "sent",
      replyTo:
        messageData.replyTo !== undefined
          ? messageData.replyTo
          : replyingToMessage?._id || null,
      replyToMessage:
        messageData.replyToMessage !== undefined
          ? messageData.replyToMessage
          : replyingToMessage
            ? {
                text: replyingToMessage.text,
                image: replyingToMessage.image,
                senderId: replyingToMessage.senderId,
                senderName:
                  replyingToMessage.senderId === authUser._id
                    ? authUser.fullName
                    : selectedUser.fullName,
              }
            : null,
    };

    // Upsert+sort: pending stays after all confirmed (WhatsApp order)
    const optimisticList = upsertMessage(messages, optimisticMessage);
    set({ messages: optimisticList });
    persistDmThread(selectedUser._id, optimisticList, get().messagesMeta);

    socket.emit(
      "sendMessage",
      {
        receiverId: selectedUser._id,
        ...messageData,
        clientMessageId,
        replyTo: optimisticMessage.replyTo,
        replyToMessage: optimisticMessage.replyToMessage,
      },
      (response) => {
        if (response?.error) {
          const currentMessages = get().messages;
          set({
            messages: currentMessages.filter(
              (msg) => !messageMatchesIds(msg, { clientMessageId })
            ),
          });
          toast.error(response.error);
          return;
        }

        const newMessage = response.message;
        const updatedMessages = applyServerAck(
          get().messages,
          clientMessageId,
          newMessage
        );

        const currentUsers = get().users;
        const updatedUsers = currentUsers.map((user) => {
          if (!sameId(user._id, selectedUser._id)) return user;
          return {
            ...user,
            chatDeletedForMe: false,
            lastMessage: {
              _id: newMessage._id,
              text: newMessage.text,
              image: newMessage.image,
              audio: newMessage.audio,
              createdAt: newMessage.createdAt,
              senderId: newMessage.senderId,
              status:
                updatedMessages.find((m) =>
                  messageMatchesIds(m, { clientMessageId })
                )?.status || newMessage.status,
            },
          };
        });

        const sortedUsers = [...updatedUsers].sort((a, b) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        set({
          messages: updatedMessages,
          users: sortedUsers,
          replyingToMessage: null,
        });
        persistDmThread(selectedUser._id, updatedMessages, get().messagesMeta);
      }
    );
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.log("[Socket Debug] Socket not available for message subscription");
      return;
    }

    if (get()._isSubscribedToMessages) {
      console.log("[Socket Debug] Already subscribed to messages, skipping duplicate subscription");
      return;
    }
    set({ _isSubscribedToMessages: true });
    console.log("[Socket Debug] Subscribing to messages globally");

    // Listen for new messages
    socket.on("newMessage", (newMessage) => {
      const currentSelectedUser = get().selectedUser;
      const authUser = useAuthStore.getState().authUser;
      const users = get().users;
      const socketRef = useAuthStore.getState().socket;

      // Skip scheduled messages - they should never arrive via socket
      if (newMessage.status === "scheduled") {
        return;
      }

      // Instant delivery ACK → sender gets ✓✓ (WhatsApp-like)
      if (sameId(newMessage.receiverId, authUser._id) && socketRef) {
        socketRef.emit("messageReceived", {
          messageId: newMessage._id,
          clientMessageId: newMessage.clientMessageId,
          senderId: newMessage.senderId?._id || newMessage.senderId,
        });
      }

      const isMessageForCurrentChat =
        (sameId(newMessage.senderId, currentSelectedUser?._id) &&
          sameId(newMessage.receiverId, authUser._id)) ||
        (sameId(newMessage.senderId, authUser._id) &&
          sameId(newMessage.receiverId, currentSelectedUser?._id));

      // Upsert into open thread (peer messages + own multi-device / ACK races)
      // Confirmed messages insert by server time; pending stay at end
      if (isMessageForCurrentChat) {
        const nextMessages = upsertMessage(
          get().messages,
          withServerOrdering(newMessage)
        );
        set({ messages: nextMessages });
        const peerId = sameId(newMessage.senderId, authUser._id)
          ? newMessage.receiverId
          : newMessage.senderId?._id || newMessage.senderId;
        persistDmThread(peerId, nextMessages, get().messagesMeta);
      }

      // WhatsApp: notify only when NOT actively viewing this conversation
      const peerSenderId = newMessage.senderId?._id || newMessage.senderId;
      const viewingThisChat = isActivelyViewingConversation(
        peerSenderId,
        currentSelectedUser?._id
      );
      let shouldMarkRead = false;

      if (sameId(newMessage.receiverId, authUser._id)) {
        if (viewingThisChat) {
          // Message in open chat is the notification — no sound/toast/popup
          shouldMarkRead = true;
        } else {
          const senderUser = users.find((u) => sameId(u._id, newMessage.senderId));
          const senderMuted = senderUser?.isMuted;

          if (!senderMuted) {
            playNotificationSound();

            const senderForNotify = senderUser || {
              _id: newMessage.senderId,
              fullName: newMessage.senderName || "New Message",
              profilePic: newMessage.senderProfilePic || "/avatar.png",
            };

            const preview = messagePreview(newMessage);

            if (shouldShowSystemNotification()) {
              const peerId = newMessage.senderId?._id || newMessage.senderId;
              void showBrowserNotification(senderForNotify.fullName, {
                body: preview,
                icon: "/avatar.png",
                tag: `chat-${peerId}`,
                requireInteraction: false,
                silent: false,
                url: `/?chat=${peerId}`,
                chatId: peerId,
                peer: {
                  _id: senderForNotify._id?._id || senderForNotify._id || peerId,
                  fullName: senderForNotify.fullName,
                  profilePic: senderForNotify.profilePic,
                  isFriend: senderForNotify.isFriend !== false,
                },
              });
            } else {
              // In-app only when tab is focused but user is elsewhere in the app
              const peerId = newMessage.senderId?._id || newMessage.senderId;
              showInAppNotification(newMessage, senderForNotify, () => {
                import("../lib/openFromNotification.js").then(({ openConversationFromNotification }) => {
                  openConversationFromNotification({
                    chatId: peerId,
                    peer: {
                      _id: senderForNotify._id?._id || senderForNotify._id || peerId,
                      fullName: senderForNotify.fullName,
                      profilePic: senderForNotify.profilePic,
                      isFriend: senderForNotify.isFriend !== false,
                    },
                  });
                });
              });
            }
          }
        }
      }

      const senderId = sameId(newMessage.senderId, authUser._id)
        ? newMessage.receiverId
        : newMessage.senderId;
      const senderIndex = users.findIndex((u) => sameId(u._id, senderId));

      // Open + focused chat for this peer (covers own echoes in the open thread)
      const isChatAlreadyOpen = isActivelyViewingConversation(
        senderId,
        currentSelectedUser?._id
      );

      if (senderIndex !== -1) {
        const updatedUsers = [...users];
        const sender = updatedUsers[senderIndex];

        const shouldIncrementUnread =
          sameId(newMessage.receiverId, authUser._id) &&
          !isChatAlreadyOpen &&
          !shouldMarkRead;

        // Sidebar ticks must match bubble status.
        // Never force "read" on OUR outgoing messages just because the chat is open —
        // open chat only means WE read THEIR messages.
        const isOutgoing = sameId(newMessage.senderId, authUser._id);
        const lastMessageStatus = isOutgoing
          ? newMessage.status || "sent"
          : shouldMarkRead || isChatAlreadyOpen
            ? "read"
            : newMessage.status || "delivered";

        const updatedSender = {
          ...sender,
          chatDeletedForMe: false,
          lastMessage: {
            _id: newMessage._id,
            text: newMessage.text,
            image: newMessage.image,
            audio: newMessage.audio,
            createdAt: newMessage.createdAt,
            senderId: newMessage.senderId,
            status: lastMessageStatus,
          },
          unreadCount:
            shouldMarkRead || isChatAlreadyOpen
              ? 0
              : shouldIncrementUnread
                ? (sender.unreadCount || 0) + 1
                : sender.unreadCount,
        };

        updatedUsers.splice(senderIndex, 1);
        updatedUsers.unshift(updatedSender);
        set({ users: updatedUsers });
      } else if (sameId(newMessage.receiverId, authUser._id)) {
        get().refreshUsers();
      }

      // Mark as read only when actively viewing this conversation (WhatsApp)
      if (
        viewingThisChat &&
        isMessageForCurrentChat &&
        sameId(newMessage.receiverId, authUser._id)
      ) {
        get().markMessagesAsRead(currentSelectedUser._id);
      }
    });

    const handleActiveState = () => {
      const { selectedUser } = get();
      if (
        selectedUser &&
        isActivelyViewingConversation(selectedUser._id, selectedUser._id)
      ) {
        get().markMessagesAsRead(selectedUser._id);
        // Re-sync ticks in case we missed a read receipt while backgrounded
        get().getMessages(selectedUser._id, { reconcile: true, background: true });
      }
    };
    window.addEventListener("focus", handleActiveState);
    document.addEventListener("visibilitychange", handleActiveState);
    get()._cleanupVisibility = () => {
      window.removeEventListener("focus", handleActiveState);
      document.removeEventListener("visibilitychange", handleActiveState);
    };

    socket.on("deleteMessageForAll", (updatedMessage) => {
      const authUser = useAuthStore.getState().authUser;
      const { users, selectedUser, messages } = get();
      const otherUserId =
        String(updatedMessage.senderId) === String(authUser?._id)
          ? updatedMessage.receiverId
          : updatedMessage.senderId;

      const inOpenChat =
        selectedUser &&
        (String(selectedUser._id) === String(updatedMessage.senderId) ||
          String(selectedUser._id) === String(updatedMessage.receiverId));

      set({
        messages: inOpenChat
          ? messages.map((msg) =>
              String(msg._id) === String(updatedMessage._id)
                ? { ...msg, ...updatedMessage, canDeleteForEveryone: false }
                : msg
            )
          : messages,
        users: users.map((user) => {
          const lm = user.lastMessage;
          if (!lm) return user;
          const matchesId = lm._id && String(lm._id) === String(updatedMessage._id);
          const matchesPeer =
            String(user._id) === String(otherUserId) &&
            lm.createdAt &&
            updatedMessage.createdAt &&
            new Date(lm.createdAt).getTime() === new Date(updatedMessage.createdAt).getTime();
          if (!matchesId && !matchesPeer) return user;
          return {
            ...user,
            lastMessage: {
              ...lm,
              _id: updatedMessage._id,
              ...deletedSidebarPreview,
            },
          };
        }),
      });
    });

    socket.on("deleteMessageForMe", ({ messageId, chatUserId }) => {
      const { messages, users, selectedUser } = get();
      const inOpenChat =
        selectedUser && String(selectedUser._id) === String(chatUserId);

      set({
        messages: inOpenChat
          ? messages.filter((msg) => String(msg._id) !== String(messageId))
          : messages,
        users: users.map((user) => {
          if (String(user._id) !== String(chatUserId)) return user;
          const lm = user.lastMessage;
          if (!lm) return user;
          if (lm._id && String(lm._id) === String(messageId)) {
            return { ...user, lastMessage: null };
          }
          return user;
        }),
      });
    });

    socket.on("messageDelivered", ({ messageId, clientMessageId, status, deliveredAt }) => {
      const next = status || "delivered";
      set({
        messages: get().messages.map((msg) => {
          if (!messageMatchesIds(msg, { messageId, clientMessageId })) return msg;
          return {
            ...msg,
            status: upgradeStatus(msg.status, next),
            deliveredAt: deliveredAt || msg.deliveredAt,
          };
        }),
        users: get().users.map((user) => {
          const lm = user.lastMessage;
          if (!lm) return user;
          if (
            messageMatchesIds(lm, { messageId, clientMessageId }) ||
            (messageId && sameId(lm._id, messageId))
          ) {
            return {
              ...user,
              lastMessage: {
                ...lm,
                status: upgradeStatus(lm.status, next),
              },
            };
          }
          return user;
        }),
      });
    });

    socket.on("messagesDelivered", ({ receiverId, senderId }) => {
      const { messages, users } = get();
      const authUser = useAuthStore.getState().authUser;
      // We are the sender of those messages
      if (senderId != null && !sameId(senderId, authUser?._id)) return;

      set({
        messages: messages.map((msg) =>
          sameId(msg.senderId, authUser._id) &&
          sameId(msg.receiverId, receiverId) &&
          msg.status === "sent"
            ? { ...msg, status: "delivered", deliveredAt: new Date().toISOString() }
            : msg
        ),
        users: users.map((user) => {
          if (!sameId(user._id, receiverId)) return user;
          const lm = user.lastMessage;
          if (!lm) return user;
          if (!sameId(lm.senderId, authUser._id)) return user;
          if (lm.status !== "sent") return user;
          return {
            ...user,
            lastMessage: {
              ...lm,
              status: upgradeStatus(lm.status, "delivered"),
            },
          };
        }),
      });
    });

    socket.on("messagesRead", ({ readBy, chatWith, messageIds, readAt }) => {
      const { selectedUser, messages, users } = get();
      const authUser = useAuthStore.getState().authUser;
      if (!authUser || !readBy) return;

      // readBy = who read (the other user); chatWith = me (the sender of those messages)
      const iAmSender =
        chatWith == null || sameId(chatWith, authUser._id);
      if (!iAmSender) return;

      const idSet =
        Array.isArray(messageIds) && messageIds.length > 0
          ? new Set(messageIds.map(String))
          : null;

      const applyRead = (list) =>
        list.map((msg) => {
          if (!sameId(msg.senderId, authUser._id)) return msg;
          // Only messages in this peer conversation
          if (
            !sameId(msg.receiverId, readBy) &&
            !(selectedUser && sameId(selectedUser._id, readBy))
          ) {
            return msg;
          }

          const matchesId =
            !idSet ||
            idSet.has(String(msg._id)) ||
            idSet.has(String(msg.realId || "")) ||
            (msg.clientMessageId && idSet.has(String(msg.clientMessageId)));

          // Peer opened the chat — also upgrade in-flight optimistic msgs (id race)
          const pendingToPeer =
            Boolean(idSet) &&
            (msg.isOptimistic ||
              msg.pending ||
              String(msg._id || "").startsWith("temp-")) &&
            sameId(msg.receiverId, readBy);

          if (idSet && !matchesId && !pendingToPeer) return msg;
          if (msg.status === "read") return msg;
          return {
            ...msg,
            status: upgradeStatus(msg.status, "read"),
            readAt: readAt || new Date().toISOString(),
          };
        });

      const chatOpen = sameId(selectedUser?._id, readBy);
      const nextMessages = chatOpen ? applyRead(messages) : messages;

      if (!chatOpen) {
        const mem = readMemoryThread("dm", readBy);
        if (mem?.messages?.length) {
          writeMemoryThread("dm", readBy, {
            ...mem,
            messages: applyRead(mem.messages),
          });
        }
      } else {
        persistDmThread(readBy, nextMessages, get().messagesMeta);
      }

      const updatedUsers = users.map((user) => {
        if (!sameId(user._id, readBy)) return user;
        const lm = user.lastMessage;
        if (!lm) return user;
        if (!sameId(lm.senderId, authUser._id)) return user;
        if (
          idSet &&
          lm._id &&
          !idSet.has(String(lm._id)) &&
          !idSet.has(String(lm.realId || ""))
        ) {
          return user;
        }
        return {
          ...user,
          lastMessage: {
            ...lm,
            status: upgradeStatus(lm.status, "read"),
          },
        };
      });

      set({
        ...(chatOpen ? { messages: nextMessages } : {}),
        users: updatedUsers,
      });
    });

    const requestDeliveryUpgrade = (peerId) => {
      const authUser = useAuthStore.getState().authUser;
      const { messages, selectedUser } = get();
      if (!peerId || !authUser) return;
      if (selectedUser && sameId(peerId, selectedUser._id)) {
        const pending = messages.some(
          (msg) =>
            sameId(msg.senderId, authUser._id) &&
            sameId(msg.receiverId, peerId) &&
            msg.status === "sent"
        );
        if (pending) {
          socket.emit("updatePendingMessages", {
            senderId: authUser._id,
            receiverId: peerId,
          });
        }
      }
    };

    socket.on("userOnline", ({ userId }) => {
      requestDeliveryUpgrade(userId);
    });

    socket.on("peerOnline", ({ userId }) => {
      requestDeliveryUpgrade(userId);
    });

    // === NEW EVENTS ===
    socket.on("messageReaction", ({ messageId, reactions }) => {
      set({
        messages: get().messages.map(msg => msg._id === messageId ? { ...msg, reactions } : msg)
      });
    });

    socket.on("messageUpdated", (updatedMessage) => {
      set({
        messages: get().messages.map(msg => msg._id === updatedMessage._id ? { ...msg, ...updatedMessage } : msg)
      });
    });

    socket.on("messagePinned", ({ messageId, isPinned }) => {
      set({
        messages: get().messages.map(msg => msg._id === messageId ? { ...msg, isPinned } : msg)
      });
    });

    socket.on("pollUpdated", ({ messageId, poll }) => {
      set({
        messages: get().messages.map(msg => msg._id === messageId ? { ...msg, poll } : msg)
      });
    });

    socket.on("typing", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) {
        set({ isTyping: true });

        // Clear any existing timeout
        if (get()._typingTimeout) {
          clearTimeout(get()._typingTimeout);
        }

        // Auto-clear typing indicator after 2 seconds if no stopTyping event
        const timeout = setTimeout(() => {
          if (get().selectedUser?._id === senderId) {
            set({ isTyping: false, _typingTimeout: null });
          }
        }, 2000);

        set({ _typingTimeout: timeout });
      }
    });

    socket.on("stopTyping", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) {
        // Clear timeout if it exists
        if (get()._typingTimeout) {
          clearTimeout(get()._typingTimeout);
          set({ _typingTimeout: null });
        }
        set({ isTyping: false });
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("deleteMessageForAll");
      socket.off("deleteMessageForMe");
      socket.off("messageDelivered");
      socket.off("messagesDelivered");
      socket.off("messagesRead");
      socket.off("userOnline");
      socket.off("peerOnline");
      socket.off("messageReaction");
      socket.off("messageUpdated");
      socket.off("messagePinned");
      socket.off("pollUpdated");
      socket.off("typing");
      socket.off("stopTyping");
    }
    if (get()._cleanupVisibility) {
      get()._cleanupVisibility();
      set({ _cleanupVisibility: null });
    }
    set({ _isSubscribedToMessages: false });
    console.log("[Socket Debug] Unsubscribed from messages globally");
  },

  deleteForAllMessage: async (messageId) => {
    const authUser = useAuthStore.getState().authUser;
    const { messages, users, selectedUser } = get();
    const prevMessages = messages;
    const prevUsers = users;

    const optimistic = applyOptimisticDeleteForEveryone(
      messages.find((m) => m._id === messageId) || { _id: messageId },
      authUser?._id
    );

    const isLatestInOpenChat =
      selectedUser &&
      messages.length > 0 &&
      String(messages[messages.length - 1]._id) === String(messageId);

    set({
      messages: messages.map((msg) =>
        String(msg._id) === String(messageId) ? { ...msg, ...optimistic } : msg
      ),
      users: users.map((user) => {
        const lm = user.lastMessage;
        if (!lm) return user;
        const matchesId = lm._id && String(lm._id) === String(messageId);
        const matchesOpenChatLatest =
          isLatestInOpenChat && String(user._id) === String(selectedUser._id);
        const matchesByTime =
          selectedUser &&
          String(user._id) === String(selectedUser._id) &&
          optimistic.createdAt &&
          lm.createdAt &&
          new Date(lm.createdAt).getTime() === new Date(optimistic.createdAt).getTime();
        if (!matchesId && !matchesOpenChatLatest && !matchesByTime) return user;
        return {
          ...user,
          lastMessage: {
            ...lm,
            _id: messageId,
            ...deletedSidebarPreview,
            createdAt: lm.createdAt,
            senderId: lm.senderId,
            status: lm.status,
          },
        };
      }),
    });

    try {
      await axiosInstance.delete(`/messages/${messageId}/everyone`);
      toast.success("Message deleted for everyone");
    } catch (error) {
      set({ messages: prevMessages, users: prevUsers });
      toast.error(error.response?.data?.error || "Delete failed");
      throw error;
    }
  },

  deleteForMeMessage: async (messageId) => {
    const { messages, users, selectedUser } = get();
    const prevMessages = messages;
    const prevUsers = users;
    const deletedMsg = messages.find((m) => String(m._id) === String(messageId));

    set({
      messages: messages.filter((msg) => String(msg._id) !== String(messageId)),
      users: users.map((user) => {
        if (!selectedUser || String(user._id) !== String(selectedUser._id)) return user;
        const lm = user.lastMessage;
        if (!lm) return user;
        const matches =
          (lm._id && String(lm._id) === String(messageId)) ||
          (deletedMsg?.createdAt &&
            lm.createdAt &&
            new Date(lm.createdAt).getTime() === new Date(deletedMsg.createdAt).getTime());
        if (!matches) return user;
        // Best-effort: clear preview; next message send/refresh will restore
        const remaining = messages.filter((m) => String(m._id) !== String(messageId));
        const last = remaining[remaining.length - 1];
        return {
          ...user,
          lastMessage: last
            ? {
                _id: last._id,
                text: last.deletedForEveryone ? DELETED_TEXT_EVERYONE : last.text,
                image: last.image,
                audio: last.audio,
                createdAt: last.createdAt,
                senderId: last.senderId,
                status: last.status,
              }
            : null,
        };
      }),
    });

    try {
      await axiosInstance.delete(`/messages/${messageId}/me`);
      toast.success("Message deleted for you");
    } catch (error) {
      set({ messages: prevMessages, users: prevUsers });
      toast.error(error.response?.data?.error || "Delete failed");
      throw error;
    }
  },

  forwardMessage: async (messageId, receiverId) => {
    try {
      const res = await axiosInstance.post(`/messages/forward/${messageId}`, {
        receiverId,
      });

      const { selectedUser, messages } = get();
      if (selectedUser._id === receiverId) {
        set({ messages: [...messages, res.data] });
      }

      toast.success("Message forwarded successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward message");
      throw error;
    }
  },

  markMessagesAsRead: async (userId) => {
    const socket = useAuthStore.getState().socket;

    // INSTANTLY update unreadCount to 0 before sending to server (optimistic update)
    const { users } = get();
    const updatedUsers = users.map((user) =>
      sameId(user._id, userId) ? { ...user, unreadCount: 0 } : user
    );
    set({ users: updatedUsers });

    try {
      if (socket?.connected) {
        socket.emit("markMessagesAsRead", { userId });
      }
      // HTTP backup so read receipts persist even if the socket event drops
      await axiosInstance.put(`/messages/read/${userId}`);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  },

  sendFriendRequest: async (userId, message = "") => {
    try {
      const endpoint = message ? `/friends/request-message/${userId}` : `/friends/request/${userId}`;
      const res = await axiosInstance.post(endpoint, { message });
      toast.success("Friend request sent");
      // Update discover results instantly so button shows Pending
      set({
        discoverUsers: get().discoverUsers.map((u) =>
          u._id === userId
            ? { ...u, hasPendingRequest: true, pendingRequestSentByMe: true }
            : u
        ),
      });
      get().refreshUsers();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to send friend request");
      throw error;
    }
  },

  acceptFriendRequest: async (requestId) => {
    try {
      const res = await axiosInstance.put(`/friends/accept/${requestId}`);
      toast.success("Friend request accepted");
      get().fetchFriendRequests();
      get().refreshUsers();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to accept friend request");
      throw error;
    }
  },

  rejectFriendRequest: async (requestId) => {
    try {
      const res = await axiosInstance.put(`/friends/reject/${requestId}`);
      toast.success("Friend request rejected");
      get().fetchFriendRequests();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject friend request");
      throw error;
    }
  },

  fetchFriendRequests: async () => {
    set({ isFriendRequestsLoading: true });
    try {
      const res = await axiosInstance.get("/friends/requests");
      set({ friendRequests: res.data });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to fetch friend requests");
    } finally {
      set({ isFriendRequestsLoading: false });
    }
  },

  fetchSentRequests: async () => {
    try {
      const res = await axiosInstance.get("/friends/sent");
      set({ sentRequests: res.data });
    } catch (error) {
      console.error("Failed to fetch sent requests:", error);
    }
  },

  setSelectedUser: (selectedUser) => {
    const currentUser = get().selectedUser;
    const { messages, messagesMeta } = get();

    if (currentUser?._id && messages.length) {
      writeMemoryThread("dm", currentUser._id, {
        messages,
        hasMoreOlder: messagesMeta?.hasMoreOlder,
        oldestCachedAt: messages[0]?.createdAt,
        newestAt: messages[messages.length - 1]?.createdAt,
      });
    }

    // Closing chat — clear thread so it can't bleed into the next open
    if (!selectedUser) {
      set({
        selectedUser: null,
        messages: [],
        isTyping: false,
        isMessagesLoading: false,
        messagesMeta: {
          hasMoreOlder: true,
          isSyncing: false,
          oldestCursor: null,
          newestCursor: null,
        },
      });
      return;
    }

    const sameUser =
      currentUser && String(currentUser._id) === String(selectedUser._id);

    if (sameUser) {
      set({ selectedUser });
      return;
    }

    const mem = readMemoryThread("dm", selectedUser._id);
    set({
      selectedUser,
      isTyping: false,
      // Always swap thread atomically — never keep previous chat's messages
      messages: mem?.messages || [],
      messagesMeta: mem
        ? {
            hasMoreOlder: mem.hasMoreOlder ?? true,
            isSyncing: false,
            oldestCursor: mem.oldestCachedAt,
            newestCursor: mem.newestAt,
          }
        : { hasMoreOlder: true, isSyncing: false, oldestCursor: null, newestCursor: null },
      isMessagesLoading: !mem?.messages?.length,
      replyingToMessage: null,
    });
  },

  /**
   * Delete entire chat for me only — hides from chat list (friend still searchable).
   * Other person still has the messages.
   */
  deleteChatForMe: async (userId) => {
    try {
      await axiosInstance.delete(`/messages/chat/${userId}`);
      removeThread("dm", userId).catch(() => {});

      const { selectedUser, users } = get();
      set({
        users: users.map((u) =>
          u._id === userId
            ? {
                ...u,
                lastMessage: null,
                unreadCount: 0,
                chatDeletedForMe: true, // hide from Chats list until new msg / restart chat
              }
            : u
        ),
        ...(selectedUser?._id === userId
          ? { selectedUser: null, messages: [], isTyping: false, replyingToMessage: null }
          : {}),
      });

      // Don't leave /?chat=id in the address bar after delete
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("chat") === userId) {
          window.history.replaceState({}, document.title, "/");
        } else if (selectedUser?._id === userId && window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname || "/");
        }
      } catch (_) {
        /* ignore */
      }

      toast.success("Chat deleted for you");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete chat");
      return false;
    }
  },

  setReplyingToMessage: (message) => set({ replyingToMessage: message }),

  clearReplyingToMessage: () => set({ replyingToMessage: null }),

  // NEW ACTIONS
  sendReaction: async (messageId, emoji) => {
    try {
      haptic("react");
      const queued = await reactOrQueue(messageId, emoji);
      if (queued.queued) {
        set({
          messages: get().messages.map((msg) => {
            if (msg._id !== messageId) return msg;
            const reactions = [...(msg.reactions || [])];
            const myId = useAuthStore.getState().authUser?._id;
            const idx = reactions.findIndex(
              (r) => (r.userId?._id || r.userId) === myId
            );
            if (idx >= 0) {
              if (reactions[idx].emoji === emoji) reactions.splice(idx, 1);
              else reactions[idx] = { ...reactions[idx], emoji };
            } else reactions.push({ userId: myId, emoji });
            return { ...msg, reactions };
          }),
        });
        return;
      }
      const res = await axiosInstance.post(`/messages/${messageId}/reaction`, { emoji });
      set({
        messages: get().messages.map(msg => msg._id === messageId ? res.data : msg)
      });
    } catch (error) {
      toast.error("Failed to react");
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}/edit`, { text });
      set({ messages: get().messages.map(m => m._id === messageId ? res.data : m) });
      toast.success("Message edited");
    } catch (error) {
      toast.error("Failed to edit message");
    }
  },

  togglePinMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/pin`);
      set({ messages: get().messages.map(m => m._id === messageId ? res.data : m) });
      toast.success(res.data.isPinned ? "Message pinned" : "Message unpinned");
    } catch (error) {
      toast.error("Failed to pin message");
    }
  },

  votePoll: async (messageId, optionIndex) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/vote`, { optionIndex });
      set({ messages: get().messages.map(m => m._id === messageId ? res.data : m) });
    } catch (error) {
      toast.error("Failed to vote");
    }
  },

  setTyping: (isTyping) => {
    const socket = useAuthStore.getState().socket;
    const { selectedUser } = get();
    if (!socket || !selectedUser) return;

    if (isTyping) {
      socket.emit("typing", { receiverId: selectedUser._id });
    } else {
      socket.emit("stopTyping", { receiverId: selectedUser._id });
    }
  },

  reset: () => {
    get().unsubscribeFromMessages();
    set({
      messages: [],
      messagesMeta: { hasMoreOlder: false, isSyncing: false, oldestCursor: null, newestCursor: null },
      isLoadingOlder: false,
      users: [],
      discoverUsers: [],
      selectedUser: null,
      isUsersLoading: false,
      isDiscoverLoading: false,
      isMessagesLoading: false,
      friendRequests: [],
      sentRequests: [],
      isFriendRequestsLoading: false,
      replyingToMessage: null,
      isTyping: false,
    });
  }
}));
