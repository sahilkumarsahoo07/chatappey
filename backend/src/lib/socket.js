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

// Track active calls for updating call records
const activeCallsMap = {}; // { roomID: { caller, receiver, callType, startTime } }

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(`User ID ${userId} mapped to socket ${socket.id}`);

    // Notify the user that they're online (for updating pending messages to delivered)
    socket.emit("userOnline", { userId });

    // Notify all clients to refresh their user list (for new users to appear)
    io.emit("userListUpdate", { userId });
  }

  // Notify all clients about current online users
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Handle updating message status to delivered when receiver comes online
  socket.on("updatePendingMessages", (data) => {
    const { senderId, receiverId } = data;
    const senderSocketId = getReceiverSocketId(senderId);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesDelivered", {
        receiverId,
        senderId
      });
    }
  });

  socket.on("messageSeen", (message) => {
    const senderSocketId = getReceiverSocketId(message.senderId);
    io.emit("deleteMessageForMe", message);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageSeen", message);
    }
  });

  socket.on("blocked", (data) => {
    console.log(`User blocked: ${data.blockerId} blocked ${data.blockedId}`);
    io.to(getReceiverSocketId(data.blockerId)).emit("user-blocked", data);
    io.to(getReceiverSocketId(data.blockedId)).emit("user-blocked", data);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  socket.on("unblocked", (data) => {
    console.log(`User unblocked: ${data.unblockedId} by ${data.unblockerId}`);
    io.to(getReceiverSocketId(data.unblockerId)).emit("unblocked", data);
    io.to(getReceiverSocketId(data.unblockedId)).emit("unblocked", data);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // Call signaling events
  socket.on("call:initiate", async ({ to, from, fromData, callType, roomID }) => {
    console.log('=== CALL:INITIATE RECEIVED ON SERVER ===');
    console.log(`From: ${fromData?.fullName} (${from})`);
    console.log(`To: ${to}`);
    console.log(`Call Type: ${callType}`);
    console.log(`Room ID: ${roomID}`);

    const receiverSocketId = getReceiverSocketId(to);
    console.log(`Receiver socket ID: ${receiverSocketId}`);
    console.log(`Receiver online: ${receiverSocketId ? 'YES' : 'NO'}`);

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
      console.log('✅ Call record created in database');

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
      console.log(`✅ Emitting call:incoming to receiver socket ${receiverSocketId}`);
      io.to(receiverSocketId).emit("call:incoming", {
        from,
        fromData,
        callType,
        roomID
      });
      console.log('✅ call:incoming event emitted successfully');
    } else {
      console.log('❌ Receiver is not online or not connected');
    }
  });

  socket.on("call:answer", async ({ to, roomID }) => {
    console.log(`Call answered to ${to}, room: ${roomID}`);

    // Update call record with startTime and status
    try {
      const call = await Call.findOne({ roomID });
      if (call) {
        call.status = "completed";
        call.startTime = new Date();
        await call.save();
        console.log('✅ Call record updated with startTime');
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
    console.log(`Call rejected to ${to}`);

    // Update call record status to rejected
    try {
      const call = await Call.findOne({ roomID });
      if (call) {
        call.status = "rejected";
        await call.save();
        console.log('✅ Call record updated to rejected');
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
    console.log(`Call ended to ${to}, duration: ${duration}`);

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
        console.log('✅ Call record updated with endTime and duration');
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



  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
