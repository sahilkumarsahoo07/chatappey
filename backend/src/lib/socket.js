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
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;

    // Join user's groups for room-based communication
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



  socket.on("disconnect", async () => {
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];

      // Update lastLogout in database for accurate "last seen" timestamps
      try {
        const User = (await import("../models/user.model.js")).default;
        const logoutTime = new Date();
        await User.findByIdAndUpdate(userId, { lastLogout: logoutTime });

        // Emit the user-logged-out event so other clients update their UI
        io.emit("user-logged-out", { userId, lastLogout: logoutTime });
      } catch (error) {
        console.error("Error updating lastLogout on disconnect:", error);
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
