import webpush from "web-push";
import User from "../models/user.model.js";
import { isUserActivelyViewingInSocket } from "./socket.js";

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BN6yldIGLIF3fbj-ToyKvtQXjykZrC907ERJmHDXLAurN23lKjOAnvx8iwBPTCk6DpVFxO3iqKZQjPVFP7SHR6s";
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "PTk63Tyrtvy5xJSqLtrDRAs7wa9DeOwDbPjnjsiBZR4";

try {
  webpush.setVapidDetails(
    "mailto:support@chatappey.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (err) {
  console.error("Error initializing VAPID details:", err.message);
}

/**
 * Dispatch web push notification to a user's registered browser endpoints
 */
export const sendPushNotification = async (userId, payload = {}) => {
  if (!userId) return;
  const payloadData = payload.data || {};
  const incomingChatId = payloadData.chatId;
  const incomingGroupId = payloadData.groupId;
  const incomingConversationId = incomingChatId || incomingGroupId;

  // Server-side active conversation suppression check.
  // isUserActivelyViewingInSocket already rejects BACKGROUND/OFFLINE/ONLINE_IDLE,
  // so Quick Reply (background-only) will NOT suppress here.
  const isActivelyViewing = incomingConversationId && isUserActivelyViewingInSocket(userId, incomingConversationId);
  if (isActivelyViewing) return;

  try {
    const user = await User.findById(userId).select("pushSubscriptions");
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      return;
    }

    const pushPayload = JSON.stringify({
      title: payload.title || "ChatAppey",
      body: payload.body || "You have a new message",
      // Always use same-origin icon — remote/CDN icons often fail on iOS Web Push
      icon: "/avatar.png",
      badge: "/avatar.png",
      tag: payload.tag || "chat-message",
      // Chat apps must renotify on same-tag replace (Message 2 after Message 1 / Quick Reply).
      renotify: true,
      requireInteraction: false,
      silent: false,
      timestamp: Date.now(),
      data: payload.data || { url: payload.url || "/" },
    });

    const activeSubscriptions = [];
    let updated = false;

    for (const sub of user.pushSubscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };
        await webpush.sendNotification(pushSubscription, pushPayload);
        activeSubscriptions.push(sub);
      } catch (err) {
        // If status code is 404 or 410, subscription has expired/been revoked
        // 403 often means VAPID/auth mismatch — drop dead endpoint too
        if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 403) {
          updated = true;
        } else {
          activeSubscriptions.push(sub);
          console.error(`Web push error for user ${userId}:`, err.message || err);
        }
      }
    }

    if (updated) {
      user.pushSubscriptions = activeSubscriptions;
      await user.save();
    }
  } catch (error) {
    console.error(`Error in sendPushNotification for user ${userId}:`, error.message);
  }
};
