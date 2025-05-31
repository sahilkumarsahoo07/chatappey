import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
        credentials: true
    },
});

export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // io.emit() is used to send events to all the connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("messageSeen", (message) => {
        const senderSocketId = getReceiverSocketId(message.senderId);
        io.emit("deleteMessageForMe", message);
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageSeen", message); // Notify sender
        }
    });

    // In your socket.io server code
    socket.on("blocked", (data) => {
        console.log(`User blocked: ${data.blockerId} blocked ${data.blockedId}`);
        
        // Notify both users
        io.to(getReceiverSocketId(data.blockerId)).emit("user-blocked", data);
        io.to(getReceiverSocketId(data.blockedId)).emit("user-blocked", data);
        
        // Update online users list
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });

    socket.on("unblocked", (data) => {
        console.log(`User unblocked: ${data.unblockedId} by ${data.unblockerId}`);
        
        io.to(getReceiverSocketId(data.unblockerId)).emit("unblocked", data);
        io.to(getReceiverSocketId(data.unblockedId)).emit("unblocked", data);

        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { io, app, server };