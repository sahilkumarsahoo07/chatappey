import { create } from "zustand";
import { detectNetwork, subscribeNetwork, NetworkTier } from "../lib/network";
import { resolveVideoQuality, getManualQuality, setManualQuality } from "../lib/mediaDelivery";
import {
  flushOfflineQueue,
  listQueue,
  enqueueOffline,
  QueueItemType,
  QueueItemStatus,
} from "../lib/offlineQueue";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useNetworkStore = create((set, get) => ({
  network: detectNetwork(),
  quality: resolveVideoQuality(),
  qualityMode: getManualQuality(),
  queue: [],
  isFlushing: false,
  _unsub: null,

  init: () => {
    if (get()._unsub) return;
    const unsub = subscribeNetwork((network) => {
      set({
        network,
        quality: get().qualityMode === "auto" ? resolveVideoQuality() : get().quality,
      });
      if (network.tier !== NetworkTier.OFFLINE) {
        get().flushQueue();
      }
    });
    set({ _unsub: unsub });
    get().refreshQueue();
    window.addEventListener("online", () => get().flushQueue());
  },

  setQualityMode: (mode) => {
    setManualQuality(mode);
    set({
      qualityMode: mode,
      quality: mode === "auto" ? resolveVideoQuality() : mode,
    });
  },

  refreshQueue: async () => {
    try {
      const queue = await listQueue();
      set({ queue });
    } catch {
      set({ queue: [] });
    }
  },

  enqueue: async (type, payload) => {
    const item = await enqueueOffline(type, payload);
    await get().refreshQueue();
    return item;
  },

  flushQueue: async () => {
    if (get().isFlushing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    set({ isFlushing: true });
    try {
      await flushOfflineQueue(async (item) => {
        if (item.type === QueueItemType.MESSAGE || item.type === QueueItemType.VIDEO_UPLOAD) {
          const { receiverId, messageData } = item.payload;
          const socket = useAuthStore.getState().socket;
          if (socket?.connected) {
            await new Promise((resolve, reject) => {
              socket.emit("sendMessage", { receiverId, ...messageData }, (res) => {
                if (res?.error) reject(new Error(res.error));
                else resolve(res);
              });
            });
          } else {
            await axiosInstance.post(`/messages/send/${receiverId}`, messageData);
          }
        } else if (item.type === QueueItemType.REACTION) {
          const { messageId, emoji } = item.payload;
          await axiosInstance.post(`/messages/${messageId}/reaction`, { emoji });
        } else if (item.type === QueueItemType.STATUS_UPLOAD) {
          if (!item.payload?.formReady) {
            throw new Error("Status upload must be retried from draft");
          }
        }
      });
      await get().refreshQueue();
    } catch (e) {
      console.error("Queue flush error", e);
    } finally {
      set({ isFlushing: false });
    }
  },
}));

export async function sendOrQueueMessage(receiverId, messageData) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await useNetworkStore.getState().enqueue(QueueItemType.MESSAGE, {
      receiverId,
      messageData,
    });
    const { default: toast } = await import("react-hot-toast");
    toast("Message queued — will send when online", { icon: "📤" });
    return { queued: true };
  }
  return { queued: false };
}

export async function reactOrQueue(messageId, emoji) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await useNetworkStore.getState().enqueue(QueueItemType.REACTION, { messageId, emoji });
    const { default: toast } = await import("react-hot-toast");
    toast("Reaction queued", { icon: "❤️" });
    return { queued: true };
  }
  return { queued: false };
}

export { QueueItemType, QueueItemStatus };
