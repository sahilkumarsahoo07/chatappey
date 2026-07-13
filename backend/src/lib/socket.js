// import { Server } from "socket.io";
// import http from "http";
// import express from "express";

// const app = express();
// const server = http.createServer(app);

// const io = new Server(server, {
//     cors: {
//         origin: ["http://localhost:5173"],
//         credentials: true
//     },
// });

// export function getReceiverSocketId(userId) {
//     return userSocketMap[userId];
// }

// // used to store online users
// const userSocketMap = {}; // {userId: socketId}

// io.on("connection", (socket) => {
//     console.log("A user connected", socket.id);

//     const userId = socket.handshake.query.userId;
//     if (userId) userSocketMap[userId] = socket.id;

//     // io.emit() is used to send events to all the connected clients
//     io.emit("getOnlineUsers", Object.keys(userSocketMap));

//     socket.on("messageSeen", (message) => {
//         const senderSocketId = getReceiverSocketId(message.senderId);
//         io.emit("deleteMessageForMe", message);
//         if (senderSocketId) {
//             io.to(senderSocketId).emit("messageSeen", message); // Notify sender
//         }
//     });

//     // In your socket.io server code
//     socket.on("blocked", (data) => {
//         console.log(`User blocked: ${data.blockerId} blocked ${data.blockedId}`);

//         // Notify both users
//         io.to(getReceiverSocketId(data.blockerId)).emit("user-blocked", data);
//         io.to(getReceiverSocketId(data.blockedId)).emit("user-blocked", data);

//         // Update online users list
//         io.emit("getOnlineUsers", Object.keys(userSocketMap));
//     });

//     socket.on("unblocked", (data) => {
//         console.log(`User unblocked: ${data.unblockedId} by ${data.unblockerId}`);

//         io.to(getReceiverSocketId(data.unblockerId)).emit("unblocked", data);
//         io.to(getReceiverSocketId(data.unblockedId)).emit("unblocked", data);

//         io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
//     });

//     socket.on("disconnect", () => {
//         console.log("A user disconnected", socket.id);
//         delete userSocketMap[userId];
//         io.emit("getOnlineUsers", Object.keys(userSocketMap));
//     });
// });

// export { io, app, server };

import { Server } from "socket.io";
import http from "http";
import express from "express";
import Call from "../models/call.model.js";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import FriendRequest from "../models/friendRequest.model.js";
import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import cloudinary from "./cloudinary.js";
import { unarchiveDmChat } from "../utils/chatPreference.utils.js";
import { emitToUser, canUpgradeStatus } from "../utils/messageStatus.utils.js";
import { applyComputedStatus } from "../utils/groupMessageStatus.utils.js";
import { ackGroupMessagesDelivered, isValidObjectId } from "../utils/groupDelivery.utils.js";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://chatappey.onrender.com",
  "https://chatappey.netlify.app"
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
});

export function getReceiverSocketId(userId) {
  if (userId == null) return undefined;
  const key =
    typeof userId === "object" && userId._id != null
      ? String(userId._id)
      : String(userId);
  return userSocketMap[key];
}

/** Put online member sockets into a group room (covers create / add-member). */
export function joinUsersToGroupRoom(userIds, groupId) {
  if (!groupId || !userIds?.length) return;
  const room = String(groupId);
  for (const id of userIds) {
    if (id == null) continue;
    const uid =
      typeof id === "object" && id._id != null ? String(id._id) : String(id);
    io.in(`user:${uid}`).socketsJoin(room);
  }
}

// Used to store online users
export const userSocketMap = {}; // { userId: socketId }

// Track incognito users
const incognitoUsers = new Set();

// Helper to update incognito status (exported for controller use)
export const updateIncognitoStatus = (userId, status) => {
  const strUserId = userId.toString();
  if (status) {
    incognitoUsers.add(strUserId);
  } else {
    incognitoUsers.delete(strUserId);
  }

  // Immediately broadcast the updated online list to all clients
  const visibleOnlineUsers = Object.keys(userSocketMap).filter(id => !incognitoUsers.has(id));
  io.emit("getOnlineUsers", visibleOnlineUsers);
};

// Start cleaning incognito users interval (cleanup stale IDs)
setInterval(() => {
  // Optional: Verify active sockets for these IDs
  for (const userId of incognitoUsers) {
    if (!userSocketMap[userId]) {
      incognitoUsers.delete(userId);
    }
  }
}, 3600000); // 1 hour

// Track active calls for updating call records
const activeCallsMap = {}; // { roomID: { caller, receiver, callType, startTime } }

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    // 1. Immediately check DB for incognito status BEFORE adding to online map
    // This prevents the race condition where they appear online for a split second
    let userIsIncognito = false;
    try {
      const user = await User.findById(userId).select('isIncognito');
      userIsIncognito = !!user?.isIncognito;

      if (userIsIncognito) {
        incognitoUsers.add(userId.toString());
      } else {
        // Only remove if we are sure (though it shouldn't be there usually on new connect)
        incognitoUsers.delete(userId.toString());
      }
    } catch (err) {
      console.error("Error checking incognito status on connect:", err);
    }

    // CRITICAL: Check if socket disconnected during the DB check above
    // If we don't check this, we may add a "dead" socket to the map and never catch the disconnect
    if (!socket.connected) {
      console.log(`Socket ${socket.id} for user ${userId} disconnected during auth. Aborting setup.`);
      // Clean up incognito if we added it
      incognitoUsers.delete(userId.toString());
      return; // Exit early - do not add to userSocketMap or broadcast
    }

    // 2. Now it is safe to add to the socket map + join personal room (multi-device)
    userSocketMap[String(userId)] = socket.id;
    socket.join(`user:${String(userId)}`);

    // 3. Join group rooms BEFORE advertising online — avoids missing first group messages
    try {
      const userGroups = await Group.find({ "members.user": userId }).select("_id").lean();
      await Promise.all(
        userGroups.map((group) => socket.join(group._id.toString()))
      );
    } catch (error) {
      console.error("Error joining group rooms:", error);
    }

    // 4. Notify the user they are connected
    socket.emit("userOnline", { userId });

    // 5. Notify others ONLY if NOT incognito — peer came online (for delivery upgrades)
    if (!incognitoUsers.has(userId.toString())) {
      io.emit("userListUpdate", { userId });
      // Tell friends this user is online so they can upgrade pending ticks
      io.emit("peerOnline", { userId: String(userId) });
    }
  }

  // 6. Broadcast online users (Filtered)
  const visibleOnlineUsers = Object.keys(userSocketMap).filter(id => !incognitoUsers.has(id));
  io.emit("getOnlineUsers", visibleOnlineUsers);

  // Handle updating message status to delivered when receiver comes online
  socket.on("updatePendingMessages", async (data) => {
    try {
      const { senderId, receiverId } = data;
      if (!senderId || !receiverId) return;

      // If receiver is incognito, DO NOT send delivered receipt
      if (incognitoUsers.has(receiverId.toString())) return;

      const now = new Date();
      const result = await Message.updateMany(
        {
          senderId,
          receiverId,
          status: "sent",
        },
        {
          $set: { status: "delivered", deliveredAt: now },
        }
      );

      if (result.modifiedCount > 0) {
        emitToUser(io, userSocketMap, senderId, "messagesDelivered", {
          receiverId,
          senderId,
          status: "delivered",
          deliveredAt: now,
        });
      }
    } catch (err) {
      console.error("updatePendingMessages error:", err.message);
    }
  });

  socket.on("messageSeen", (message) => {
    // If reader (current socket user) is incognito, do NOT process seen receipt
    // logic: message.senderId is the person who Sent the message. 
    // We are the Reader (userId). The event comes from Reader.
    // If I am incognito, I don't want the sender to know I saw it.

    if (incognitoUsers.has(userId.toString())) return;

    const senderSocketId = getReceiverSocketId(message.senderId);
    io.emit("deleteMessageForMe", message);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageSeen", message);
    }
  });

  socket.on("blocked", (data) => {
    io.to(getReceiverSocketId(data.blockerId)).emit("user-blocked", data);
    io.to(getReceiverSocketId(data.blockedId)).emit("user-blocked", data);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  socket.on("unblocked", (data) => {
    io.to(getReceiverSocketId(data.unblockerId)).emit("unblocked", data);
    io.to(getReceiverSocketId(data.unblockedId)).emit("unblocked", data);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // Typing indicators
  socket.on("typing", (data) => {
    const receiverSocketId = getReceiverSocketId(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId: userId });
    }
  });

  socket.on("stopTyping", (data) => {
    const receiverSocketId = getReceiverSocketId(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { senderId: userId });
    }
  });

  // Group typing events
  socket.on("group:typing", async ({ groupId }) => {
    try {
      if (!groupId) return;
      const room = String(groupId);
      const user = await User.findById(userId).select('fullName');

      // Broadcast to all group members except sender
      socket.to(room).emit("group:typing", {
        groupId: room,
        userId,
        userName: user?.fullName || "User"
      });
    } catch (error) {
      console.error("Error in group:typing:", error);
    }
  });

  socket.on("group:stopTyping", ({ groupId }) => {
    if (!groupId) return;
    const room = String(groupId);
    // Broadcast to all group members except sender
    socket.to(room).emit("group:stopTyping", {
      groupId: room,
      userId
    });
  });

  // Call signaling events
  socket.on("call:initiate", async ({ to, from, fromData, callType, roomID }) => {
    const receiverSocketId = getReceiverSocketId(to);

    // Save initial call record
    try {
      await Call.create({
        caller: from,
        receiver: to,
        callType,
        status: "unanswered",
        roomID,
        duration: 0,
      });

      // Track active call
      activeCallsMap[roomID] = {
        caller: from,
        receiver: to,
        callType,
        initiatedAt: Date.now(),
      };
    } catch (error) {
      console.error('❌ Error creating call record:', error);
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:incoming", {
        from,
        fromData,
        callType,
        roomID
      });
    }
  });

  socket.on("call:answer", async ({ to, roomID }) => {
    // Update call record with startTime and status
    try {
      const call = await Call.findOne({ roomID });
      if (call) {
        call.status = "completed";
        call.startTime = new Date();
        await call.save();
      }
    } catch (error) {
      console.error('❌ Error updating call record:', error);
    }

    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call:answered", { roomID });
    }
  });

  socket.on("call:reject", async ({ to, roomID }) => {
    // Update call record status to rejected
    try {
      const call = await Call.findOne({ roomID });
      if (call) {
        call.status = "rejected";
        await call.save();
      }

      // Remove from active calls
      delete activeCallsMap[roomID];
    } catch (error) {
      console.error('❌ Error updating call record:', error);
    }

    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call:rejected");
    }
  });

  socket.on("call:end", async ({ to, roomID, duration }) => {
    // Update call record with endTime and duration
    try {
      const call = await Call.findOne({ roomID });
      if (call) {
        call.endTime = new Date();

        // If duration is provided, use it; otherwise calculate from startTime
        if (duration !== undefined) {
          call.duration = duration;
        } else if (call.startTime) {
          call.duration = Math.floor((call.endTime - call.startTime) / 1000);
        }

        // Set status based on whether call was answered
        if (call.status === "unanswered") {
          call.status = "missed";
        }

        await call.save();
      }

      // Remove from active calls
      delete activeCallsMap[roomID];
    } catch (error) {
      console.error('❌ Error updating call record:', error);
    }

    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:ended");
    }
  });

  // WebSocket-based message sending for direct messages
  socket.on("sendMessage", async (messageData, callback) => {
    try {
      const {
        receiverId,
        text,
        image,
        audio,
        file,
        fileName,
        video,
        videoThumbnail,
        videoDuration,
        videoPublicId,
        replyTo,
        replyToMessage,
        poll,
        scheduledFor,
        isScheduled,
        clientMessageId,
      } = messageData;

      // Fetch sender, receiver, and reply target (if valid) in parallel to optimize latency
      const fetchSender = User.findById(userId).select("blockedUsers friends");
      const fetchReceiver = User.findById(receiverId).select("blockedUsers");
      const fetchOriginalMessage =
        replyTo && mongoose.Types.ObjectId.isValid(replyTo)
          ? Message.findById(replyTo).populate("senderId", "fullName")
          : Promise.resolve(null);

      const [sender, receiver, originalMessage] = await Promise.all([
        fetchSender,
        fetchReceiver,
        fetchOriginalMessage,
      ]);

      if (!sender) {
        return callback?.({ error: "Sender not found." });
      }

      const isFriend = sender.friends.some(
        (friendId) => friendId.toString() === receiverId.toString()
      );

      if (!isFriend) {
        return callback?.({ error: "Cannot send message. You must be friends to chat." });
      }

      if (
        receiver &&
        receiver.blockedUsers.some((blockedId) => blockedId.toString() === userId.toString())
      ) {
        return callback?.({ error: "Cannot send message. You have been blocked by this user." });
      }

      if (
        sender.blockedUsers.some((blockedId) => blockedId.toString() === receiverId.toString())
      ) {
        return callback?.({ error: "Cannot send message. You have blocked this user." });
      }

      let imageUrl, audioUrl, fileUrl;

      if (image) {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      }

      if (audio) {
        const uploadResponse = await cloudinary.uploader.upload(audio, {
          resource_type: "auto",
        });
        if (uploadResponse) {
          audioUrl = uploadResponse.secure_url;
        }
      }

      if (file) {
        const uploadOptions = { resource_type: "raw" };
        if (fileName) {
          const sanitizedName = fileName.split("/").pop().split("\\").pop();
          const nameWithoutExt =
            sanitizedName.substring(0, sanitizedName.lastIndexOf(".")) || sanitizedName;
          uploadOptions.public_id = nameWithoutExt;
        }
        const uploadResponse = await cloudinary.uploader.upload(file, uploadOptions);
        fileUrl = uploadResponse.secure_url;
      }

      let replyToMessageData = replyToMessage || null;
      let validReplyTo = replyTo;

      if (replyTo) {
        if (mongoose.Types.ObjectId.isValid(replyTo)) {
          if (originalMessage) {
            replyToMessageData = {
              text: originalMessage.text,
              image: originalMessage.image,
              senderId: originalMessage.senderId._id,
              senderName: originalMessage.senderId.fullName,
            };
          }
        } else {
          validReplyTo = null;
        }
      }

      const shouldBeScheduled = isScheduled || !!scheduledFor;
      // Always start as "sent" — upgrade to delivered only when receiver ACKs (WhatsApp-like)
      let initialStatus = "sent";
      if (shouldBeScheduled) initialStatus = "scheduled";

      const now = new Date();
      const newMessage = new Message({
        senderId: userId,
        receiverId,
        text,
        image: imageUrl,
        video: video || undefined,
        videoThumbnail: videoThumbnail || undefined,
        videoDuration: videoDuration || undefined,
        videoPublicId: videoPublicId || undefined,
        audio: audioUrl,
        file: fileUrl,
        fileName: fileName || null,
        status: initialStatus,
        clientMessageId: clientMessageId || undefined,
        sentAt: shouldBeScheduled ? undefined : now,
        replyTo: validReplyTo || null,
        replyToMessage: replyToMessageData,
        poll: poll
          ? {
              question: poll.question,
              options: poll.options.map((opt) => ({ text: opt.text, votes: [] })),
            }
          : undefined,
        scheduledFor: shouldBeScheduled ? new Date(scheduledFor) : undefined,
      });

      await newMessage.save();
      // Don't block the ACK on unarchive
      unarchiveDmChat(userId, receiverId).catch(() => {});

      const payload = newMessage.toObject ? newMessage.toObject() : newMessage;
      payload.clientMessageId = clientMessageId || payload.clientMessageId;
      // Explicit server clock — clients MUST use this for ordering, never Date.now()
      payload.serverCreatedAt = payload.createdAt;

      // ACK sender immediately (status: sent) — ticks upgrade via delivery/read events
      callback?.({ success: true, message: payload });

      if (!shouldBeScheduled) {
        // Fan-out to all receiver devices via user room
        emitToUser(io, userSocketMap, receiverId, "newMessage", payload);
        // Echo to sender's OTHER devices (same room). Sending device merges via clientMessageId.
        emitToUser(io, userSocketMap, userId, "newMessage", payload);
      }
    } catch (error) {
      console.error("Error in sendMessage socket handler:", error.message);
      callback?.({ error: error.message || "Internal server error" });
    }
  });

  /**
   * Receiver confirms message reached their device → Delivered ✓✓
   */
  socket.on("messageReceived", async ({ messageId, clientMessageId, senderId }) => {
    try {
      if (!messageId && !clientMessageId) return;
      if (incognitoUsers.has(String(userId))) return;

      const query = messageId
        ? { _id: messageId }
        : { clientMessageId, receiverId: userId };

      const message = await Message.findOne(query);
      if (!message) return;
      if (String(message.receiverId) !== String(userId)) return;

      if (canUpgradeStatus(message.status, "delivered")) {
        message.status = "delivered";
        message.deliveredAt = new Date();
        await message.save();
      }

      const targetSender = senderId || message.senderId;
      emitToUser(io, userSocketMap, targetSender, "messageDelivered", {
        messageId: message._id,
        clientMessageId: message.clientMessageId || clientMessageId,
        status: message.status, // may already be "read" — never downgrade on client
        deliveredAt: message.deliveredAt,
      });
    } catch (err) {
      console.error("messageReceived error:", err.message);
    }
  });

  // WebSocket-based message sending for group messages
  socket.on("sendGroupMessage", async (messageData, callback) => {
    try {
      const {
        groupId,
        text,
        image,
        audio,
        file,
        fileName,
        video,
        videoThumbnail,
        videoDuration,
        videoPublicId,
        isForwarded,
        mentions,
        poll,
        replyTo,
        replyToMessage,
        clientMessageId,
      } = messageData;

      // Check if group exists and user is a member
      const group = await Group.findById(groupId);
      if (!group) {
        return callback?.({ error: "Group not found" });
      }

      const isMember = group.members.some(m =>
        (m.user?._id || m.user).toString() === userId.toString()
      );

      if (!isMember) {
        return callback?.({ error: "You are not a member of this group" });
      }

      // Check announcement-only restriction
      const memberInfo = group.members.find(m => (m.user?._id || m.user).toString() === userId.toString());
      if (group.announcementOnly && memberInfo?.role !== 'admin' && memberInfo?.role !== 'owner') {
        return callback?.({ error: "Only admins can send messages in this group" });
      }

      let imageUrl, audioUrl, fileUrl;

      // Upload Image
      if (image) {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      }

      // Upload Audio
      if (audio) {
        const uploadResponse = await cloudinary.uploader.upload(audio, {
          resource_type: "auto"
        });
        if (uploadResponse) {
          audioUrl = uploadResponse.secure_url;
        }
      }

      // Upload File
      if (file) {
        const uploadOptions = { resource_type: "raw" };
        if (fileName) {
          const sanitizedName = fileName.split('/').pop().split('\\').pop();
          const nameWithoutExt = sanitizedName.substring(0, sanitizedName.lastIndexOf('.')) || sanitizedName;
          uploadOptions.public_id = nameWithoutExt;
        }
        const uploadResponse = await cloudinary.uploader.upload(file, uploadOptions);
        fileUrl = uploadResponse.secure_url;
      }

      let validReplyTo = null;
      let replyToMessageData = replyToMessage || null;
      if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
        const original = await GroupMessage.findById(replyTo).populate("senderId", "fullName");
        if (original && original.groupId?.toString() === String(groupId)) {
          validReplyTo = original._id;
          replyToMessageData = {
            text: original.text || replyToMessage?.text || "",
            image: original.image || replyToMessage?.image || undefined,
            senderId: original.senderId?._id || original.senderId,
            senderName:
              replyToMessage?.senderName ||
              original.senderId?.fullName ||
              "Member",
          };
        }
      }

      const newMessage = new GroupMessage({
        groupId,
        senderId: userId,
        text,
        image: imageUrl,
        video: video || undefined,
        videoThumbnail: videoThumbnail || undefined,
        videoDuration: videoDuration || undefined,
        videoPublicId: videoPublicId || undefined,
        audio: audioUrl,
        file: fileUrl,
        fileName: fileName || null,
        isForwarded: isForwarded || false,
        mentions: mentions || [],
        replyTo: validReplyTo,
        replyToMessage: replyToMessageData,
        clientMessageId: clientMessageId || null,
        status: "sent",
        poll: poll ? {
          question: poll.question,
          options: poll.options.map(opt => ({ text: opt.text, votes: [] }))
        } : undefined,
        // Sender in readBy so unread counts exclude self; not shown in Message Info as reader
        readBy: [userId],
        deliveredTo: [],
        readReceipts: [],
      });

      await newMessage.save();

      // Populate sender info
      await newMessage.populate('senderId', 'fullName profilePic');

      const payload =
        typeof newMessage.toObject === "function"
          ? newMessage.toObject()
          : newMessage;
      payload.clientMessageId = clientMessageId || payload.clientMessageId;
      payload.serverCreatedAt = payload.createdAt;
      payload.status = "sent";

      // Update group's lastMessage and updatedAt (senderName required for sidebar)
      group.lastMessage = {
        text: text || (imageUrl ? "📷 Photo" : video ? "🎬 Video" : poll ? "📊 Poll" : "📷 Photo"),
        senderId: userId,
        senderName: newMessage.senderId?.fullName || "Member",
        createdAt: newMessage.createdAt,
      };
      group.updatedAt = new Date();
      await group.save();

      // Sender is active in this group — deliver any pending messages to them
      ackGroupMessagesDelivered({
        io,
        userSocketMap,
        groupId,
        userId,
      }).catch((e) => console.error("auto ack delivered:", e.message));

      // Broadcast to all group members
      io.to(String(groupId)).emit("group:newMessage", {
        groupId: String(groupId),
        message: payload
      });

      // Send success response to sender
      callback?.({ success: true, message: payload });
    } catch (error) {
      console.error("Error in sendGroupMessage socket handler:", error.message);
      callback?.({ error: error.message || "Internal server error" });
    }
  });

  /**
   * Recipient device ACK — WhatsApp grey ✓✓ when all members delivered.
   * Supports single message or bulk pending ack for a group.
   */
  socket.on("group:messageReceived", async ({ groupId, messageId, clientMessageId }) => {
    try {
      if (!groupId) return;
      if (incognitoUsers.has(String(userId))) return;

      if (messageId || clientMessageId) {
        let query = null;
        if (messageId && isValidObjectId(messageId) && !String(messageId).startsWith("temp-")) {
          query = { _id: messageId, groupId };
        } else if (clientMessageId) {
          query = { clientMessageId, groupId };
        }
        if (!query) return;

        const message = await GroupMessage.findOne(query).select("_id");
        if (!message) return;

        await ackGroupMessagesDelivered({
          io,
          userSocketMap,
          groupId,
          userId,
          messageIds: [message._id],
        });
        return;
      }

      // No messageId → bulk-ack pending deliveries in this group
      await ackGroupMessagesDelivered({
        io,
        userSocketMap,
        groupId,
        userId,
      });
    } catch (err) {
      console.error("group:messageReceived error:", err.message);
    }
  });

  /** Explicit bulk delivery ACK when opening / syncing a group */
  socket.on("group:ackDelivered", async ({ groupId }) => {
    try {
      if (!groupId) return;
      if (incognitoUsers.has(String(userId))) return;
      await ackGroupMessagesDelivered({
        io,
        userSocketMap,
        groupId,
        userId,
      });
    } catch (err) {
      console.error("group:ackDelivered error:", err.message);
    }
  });

  socket.on("group:recording", async ({ groupId, isRecording }) => {
    try {
      if (!groupId) return;
      const user = await User.findById(userId).select("fullName");
      socket.to(String(groupId)).emit("group:recording", {
        groupId: String(groupId),
        userId,
        userName: user?.fullName || "User",
        isRecording: !!isRecording,
      });
    } catch (err) {
      console.error("group:recording error:", err.message);
    }
  });

  // WebSocket-based mark messages as read
  socket.on("markMessagesAsRead", async ({ userId: otherUserId }) => {
    try {
      const myId = userId;
      if (!otherUserId) return;

      const now = new Date();
      const messagesToUpdate = await Message.find({
        senderId: otherUserId,
        receiverId: myId,
        status: { $ne: "read" },
      }).select("_id status");

      if (messagesToUpdate.length === 0) return;

      await Message.updateMany(
        {
          senderId: otherUserId,
          receiverId: myId,
          status: { $ne: "read" },
        },
        {
          $set: { status: "read", readAt: now },
        }
      );

      const user = await User.findById(myId).select("privacyReadReceipts isIncognito");

      if (user?.isIncognito || incognitoUsers.has(String(myId))) return;

      if (user?.privacyReadReceipts !== false) {
        emitToUser(io, userSocketMap, otherUserId, "messagesRead", {
          readBy: String(myId),
          chatWith: String(otherUserId),
          messageIds: messagesToUpdate.map((msg) => msg._id.toString()),
          readAt: now,
        });
      }
    } catch (error) {
      console.error("Error in markMessagesAsRead socket handler:", error.message);
    }
  });

  socket.on("disconnect", async () => {
    if (userId && userSocketMap[String(userId)] === socket.id) {
      delete userSocketMap[String(userId)];

      // Check if user was incognito
      const isIncognito = incognitoUsers.has(userId.toString());

      // ONLY update lastLogout and emit event if user was NOT incognito
      if (!isIncognito) {
        try {
          const logoutTime = new Date();
          const user = await User.findByIdAndUpdate(userId, { lastLogout: logoutTime }, { new: true }).select('privacyLastSeen friends');

          // Emit the user-logged-out event
          const lastLogoutPayload = (user?.privacyLastSeen === "none") ? null : logoutTime;

          io.emit("user-logged-out", { userId, lastLogout: lastLogoutPayload });
        } catch (error) {
          console.error("Error updating lastLogout on disconnect:", error);
        }
      } else {
        // If they were incognito, just remove them from the set (clean up)
        incognitoUsers.delete(userId.toString());
      }
    }
    const visibleOnlineUsers = Object.keys(userSocketMap).filter(id => !incognitoUsers.has(id));
    io.emit("getOnlineUsers", visibleOnlineUsers);
  });
});

export { io, app, server };
