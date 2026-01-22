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

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://chatappey.netlify.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// Used to store online users
const userSocketMap = {}; // { userId: socketId }

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
      const User = (await import("../models/user.model.js")).default;
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

    // 2. Now it is safe to add to the socket map
    userSocketMap[userId] = socket.id;

    // 3. Join user's groups (can remain async/background as it doesn't affect online status)
    (async () => {
      try {
        const Group = (await import("../models/group.model.js")).default;
        const userGroups = await Group.find({ 'members.user': userId }).select('_id');
        userGroups.forEach(group => {
          socket.join(group._id.toString());
        });
      } catch (error) {
        console.error("Error joining group rooms:", error);
      }
    })();

    // 4. Notify the user they are connected
    socket.emit("userOnline", { userId });

    // 5. Notify others ONLY if NOT incognito
    if (!incognitoUsers.has(userId.toString())) {
      io.emit("userListUpdate", { userId });
    }
  }

  // 6. Broadcast online users (Filtered)
  const visibleOnlineUsers = Object.keys(userSocketMap).filter(id => !incognitoUsers.has(id));
  io.emit("getOnlineUsers", visibleOnlineUsers);

  // Handle updating message status to delivered when receiver comes online
  socket.on("updatePendingMessages", (data) => {
    const { senderId, receiverId } = data;

    // If receiver is incognito, DO NOT send delivered receipt
    if (incognitoUsers.has(receiverId.toString())) return;

    const senderSocketId = getReceiverSocketId(senderId);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesDelivered", {
        receiverId,
        senderId
      });
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
      const User = (await import("../models/user.model.js")).default;
      const user = await User.findById(userId).select('fullName');

      // Broadcast to all group members except sender
      socket.to(groupId).emit("group:typing", {
        groupId,
        userId,
        userName: user?.fullName || "User"
      });
    } catch (error) {
      console.error("Error in group:typing:", error);
    }
  });

  socket.on("group:stopTyping", ({ groupId }) => {
    // Broadcast to all group members except sender
    socket.to(groupId).emit("group:stopTyping", {
      groupId,
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
      const { receiverId, text, image, audio, file, fileName, replyTo, poll, scheduledFor, isScheduled } = messageData;

      // Import models dynamically
      const User = (await import("../models/user.model.js")).default;
      const Message = (await import("../models/message.model.js")).default;
      const FriendRequest = (await import("../models/friendRequest.model.js")).default;
      const cloudinary = (await import("../lib/cloudinary.js")).default;

      // Check if users are friends
      const sender = await User.findById(userId).select('blockedUsers friends');
      const isFriend = sender.friends.some(friendId => friendId.toString() === receiverId.toString());

      if (!isFriend) {
        return callback?.({ error: "Cannot send message. You must be friends to chat." });
      }

      // Check if sender is blocked by receiver
      const receiver = await User.findById(receiverId).select('blockedUsers');
      if (receiver && receiver.blockedUsers.some(blockedId => blockedId.toString() === userId.toString())) {
        return callback?.({ error: "Cannot send message. You have been blocked by this user." });
      }

      // Check if receiver is blocked by sender
      if (sender && sender.blockedUsers.some(blockedId => blockedId.toString() === receiverId.toString())) {
        return callback?.({ error: "Cannot send message. You have blocked this user." });
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
        } else {
          console.error("Audio upload failed to Cloudinary");
        }
      }

      // Upload File
      if (file) {
        const uploadOptions = {
          resource_type: "raw"
        };

        if (fileName) {
          const sanitizedName = fileName.split('/').pop().split('\\').pop();
          const nameWithoutExt = sanitizedName.substring(0, sanitizedName.lastIndexOf('.')) || sanitizedName;
          uploadOptions.public_id = nameWithoutExt;
        }

        const uploadResponse = await cloudinary.uploader.upload(file, uploadOptions);
        fileUrl = uploadResponse.secure_url;
      }

      // Handle reply data if present
      let replyToMessageData = null;
      if (replyTo) {
        const originalMessage = await Message.findById(replyTo).populate('senderId', 'fullName');
        if (originalMessage) {
          replyToMessageData = {
            text: originalMessage.text,
            image: originalMessage.image,
            senderId: originalMessage.senderId._id,
            senderName: originalMessage.senderId.fullName
          };
        }
      }

      // Check if receiver is online
      const receiverSocketId = getReceiverSocketId(receiverId);

      // Determine status
      // If receiver is incognito, force status to 'sent' even if they are online
      let initialStatus = (receiverSocketId && !incognitoUsers.has(receiverId.toString())) ? "delivered" : "sent";

      // Check if message should be scheduled
      const shouldBeScheduled = isScheduled || !!scheduledFor;

      if (shouldBeScheduled) {
        initialStatus = "scheduled";
      }

      const newMessage = new Message({
        senderId: userId,
        receiverId,
        text,
        image: imageUrl,
        audio: audioUrl,
        file: fileUrl,
        fileName: fileName || null,
        status: initialStatus,
        replyTo: replyTo || null,
        replyToMessage: replyToMessageData,
        poll: poll ? {
          question: poll.question,
          options: poll.options.map(opt => ({ text: opt.text, votes: [] }))
        } : undefined,
        scheduledFor: shouldBeScheduled ? new Date(scheduledFor) : undefined
      });

      await newMessage.save();

      // Only emit if NOT scheduled
      if (!shouldBeScheduled) {
        if (receiverSocketId) {
          // Send new message to receiver (ALWAYS send to receiver so they get the msg)
          io.to(receiverSocketId).emit("newMessage", newMessage);

          // Notify sender that message was delivered
          // ONLY if receiver is NOT incognito
          if (!incognitoUsers.has(receiverId.toString())) {
            const senderSocketId = getReceiverSocketId(userId);
            if (senderSocketId) {
              io.to(senderSocketId).emit("messageDelivered", {
                messageId: newMessage._id,
                status: "delivered"
              });
            }
          }
        }
      }

      // Send success response to sender
      callback?.({ success: true, message: newMessage });
    } catch (error) {
      console.error("Error in sendMessage socket handler:", error.message);
      callback?.({ error: error.message || "Internal server error" });
    }
  });

  // WebSocket-based message sending for group messages
  socket.on("sendGroupMessage", async (messageData, callback) => {
    try {
      const { groupId, text, image, audio, file, fileName, isForwarded, mentions, poll } = messageData;

      // Import models dynamically
      const Group = (await import("../models/group.model.js")).default;
      const GroupMessage = (await import("../models/groupMessage.model.js")).default;
      const cloudinary = (await import("../lib/cloudinary.js")).default;

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

      const newMessage = new GroupMessage({
        groupId,
        senderId: userId,
        text,
        image: imageUrl,
        audio: audioUrl,
        file: fileUrl,
        fileName: fileName || null,
        isForwarded: isForwarded || false,
        mentions: mentions || [],
        poll: poll ? {
          question: poll.question,
          options: poll.options.map(opt => ({ text: opt.text, votes: [] }))
        } : undefined,
        readBy: [userId]
      });

      await newMessage.save();

      // Populate sender info
      await newMessage.populate('senderId', 'fullName profilePic');

      // Update group's lastMessage and updatedAt
      group.lastMessage = {
        text: text || "📷 Photo",
        senderId: userId,
        createdAt: newMessage.createdAt
      };
      group.updatedAt = new Date();
      await group.save();

      // Broadcast to all group members
      io.to(groupId).emit("group:newMessage", {
        groupId,
        message: newMessage
      });

      // Send success response to sender
      callback?.({ success: true, message: newMessage });
    } catch (error) {
      console.error("Error in sendGroupMessage socket handler:", error.message);
      callback?.({ error: error.message || "Internal server error" });
    }
  });

  // WebSocket-based mark messages as read
  socket.on("markMessagesAsRead", async ({ userId: otherUserId }) => {
    try {
      const myId = userId;

      // Import models dynamically
      const Message = (await import("../models/message.model.js")).default;
      const User = (await import("../models/user.model.js")).default;

      // Get messages that need to be marked as read
      const messagesToUpdate = await Message.find({
        senderId: otherUserId,
        receiverId: myId,
        status: { $ne: "read" }
      }).select('_id');

      // Mark all messages from the other user as read
      await Message.updateMany(
        {
          senderId: otherUserId,
          receiverId: myId,
          status: { $ne: "read" }
        },
        {
          $set: { status: "read" }
        }
      );

      // Get user's privacy settings for read receipts
      const user = await User.findById(myId).select('privacyReadReceipts isIncognito');

      // If user is incognito, DO NOT send read receipts
      if (user?.isIncognito || incognitoUsers.has(myId)) return;

      // Notify sender via socket that messages were read (if privacy allows)
      const senderSocketId = getReceiverSocketId(otherUserId);
      if (senderSocketId && messagesToUpdate.length > 0 && user?.privacyReadReceipts !== false) {
        io.to(senderSocketId).emit("messagesRead", {
          readBy: myId,
          chatWith: otherUserId,
          messageIds: messagesToUpdate.map(msg => msg._id.toString())
        });
      }
    } catch (error) {
      console.error("Error in markMessagesAsRead socket handler:", error.message);
    }
  });

  socket.on("disconnect", async () => {
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];

      // Check if user was incognito
      const isIncognito = incognitoUsers.has(userId.toString());

      // ONLY update lastLogout and emit event if user was NOT incognito
      if (!isIncognito) {
        try {
          const User = (await import("../models/user.model.js")).default;
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
