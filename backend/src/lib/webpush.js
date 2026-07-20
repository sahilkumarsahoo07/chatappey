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

const notifTrace = (stage, meta = {}) => {
  const ts = new Date().toISOString().substring(11, 23);
  console.log(`[${ts}] ${stage}`, meta);
};

/**
 * Dispatch web push notification to a user's registered browser endpoints
 */
export const sendPushNotification = async (userId, payload = {}) => {
  if (!userId) return;
  const payloadData = payload.data || {};
  const incomingChatId = payloadData.chatId;
  const incomingGroupId = payloadData.groupId;
  const incomingConversationId = incomingChatId || incomingGroupId;
  const messageId = payloadData.messageId || payloadData.clientMessageId || null;
  const t0 = Date.now();

  notifTrace("NOTIF_ELIGIBILITY_START", {
    messageId,
    conversationId: incomingConversationId,
    recipientId: String(userId),
  });

  // Server-side active conversation suppression check.
  // isUserActivelyViewingInSocket already rejects BACKGROUND/OFFLINE/ONLINE_IDLE,
  // so Quick Reply (background-only) will NOT suppress here.
  const isActivelyViewing = incomingConversationId && isUserActivelyViewingInSocket(userId, incomingConversationId);

  notifTrace("PRESENCE_CHECKED", {
    messageId,
    conversationId: incomingConversationId,
    recipientId: String(userId),
    isActivelyViewing: !!isActivelyViewing,
  });

  notifTrace("PUSH_DECISION", {
    messageId,
    conversationId: incomingConversationId,
    recipientId: String(userId),
    decision: isActivelyViewing ? "SUPPRESS" : "SEND",
  });

  if (isActivelyViewing) {
    notifTrace("PUSH_SUPPRESSED", {
      messageId,
      conversationId: incomingConversationId,
      recipientId: String(userId),
      reason: "ACTIVE_CONVERSATION",
    });
    return;
  }
  try {
    const user = await User.findById(userId).select("pushSubscriptions");
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      notifTrace("PUSH_SKIPPED_NO_SUBSCRIPTION", {
        messageId,
        conversationId: incomingConversationId,
        recipientId: String(userId),
      });
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
    let successCount = 0;

    for (const sub of user.pushSubscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };
        notifTrace("PUSH_REQUEST_SENT", {
          messageId,
          conversationId: incomingConversationId,
          recipientId: String(userId),
          endpointTail: String(sub.endpoint || "").slice(-24),
        });
        await webpush.sendNotification(pushSubscription, pushPayload);
        successCount += 1;
        activeSubscriptions.push(sub);
        notifTrace("PUSH_PROVIDER_SUCCESS", {
          messageId,
          conversationId: incomingConversationId,
          recipientId: String(userId),
          elapsedMs: Date.now() - t0,
        });
      } catch (err) {
        // If status code is 404 or 410, subscription has expired/been revoked
        // 403 often means VAPID/auth mismatch — drop dead endpoint too
        if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 403) {
          updated = true;
          notifTrace("PUSH_PROVIDER_GONE", {
            messageId,
            recipientId: String(userId),
            statusCode: err.statusCode,
          });
        } else {
          activeSubscriptions.push(sub);
          notifTrace("PUSH_PROVIDER_ERROR", {
            messageId,
            recipientId: String(userId),
            error: err.message || String(err),
            statusCode: err.statusCode,
          });
          console.error(`Web push error for user ${userId}:`, err.message || err);
        }
      }
    }

    if (updated) {
      user.pushSubscriptions = activeSubscriptions;
      await user.save();
    }

    notifTrace("PUSH_DISPATCH_DONE", {
      messageId,
      conversationId: incomingConversationId,
      recipientId: String(userId),
      successCount,
      elapsedMs: Date.now() - t0,
    });
  } catch (error) {
    console.error(`Error in sendPushNotification for user ${userId}:`, error.message);
    notifTrace("PUSH_DISPATCH_FATAL", {
      messageId,
      recipientId: String(userId),
      error: error.message,
    });
  }
};
