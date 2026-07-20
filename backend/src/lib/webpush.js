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

  // Server-side active conversation suppression check
  if (incomingConversationId && isUserActivelyViewingInSocket(userId, incomingConversationId)) {
    console.log(`[WebPush Suppressed] User ${userId} is actively chatting in conversation ${incomingConversationId}`);
    return;
  }
  try {
    const user = await User.findById(userId).select("pushSubscriptions");
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      return;
    }

    const pushPayload = JSON.stringify({
      title: payload.title || "ChatAppey",
      body: payload.body || "You have a new message",
      icon: payload.icon || "/avatar.png",
      badge: "/avatar.png",
      tag: payload.tag || "chat-message",
      requireInteraction: false,
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
        if (err.statusCode === 404 || err.statusCode === 410) {
          updated = true; // Mark to filter out dead subscription
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
