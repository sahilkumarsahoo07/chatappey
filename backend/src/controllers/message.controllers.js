import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

        // Get logged-in user's blocked users list
        const loggedInUser = await User.findById(loggedInUserId).select('blockedUsers');
        const myBlockedUsers = loggedInUser.blockedUsers.map(id => id.toString());

        // Get last message and block status for each user
        const usersWithLastMessage = await Promise.all(
            filteredUsers.map(async (user) => {
                const lastMessage = await Message.findOne({
                    $or: [
                        { senderId: loggedInUserId, receiverId: user._id },
                        { senderId: user._id, receiverId: loggedInUserId },
                    ],
                })
                    .sort({ createdAt: -1 })
                    .select('text image createdAt senderId status');

                // Count unread messages from this user
                const unreadCount = await Message.countDocuments({
                    senderId: user._id,
                    receiverId: loggedInUserId,
                    status: { $ne: 'read' }
                });

                // Check if I blocked this user
                const isBlockedByMe = myBlockedUsers.includes(user._id.toString());

                // Check if this user blocked me
                const userDoc = await User.findById(user._id).select('blockedUsers');
                const hasBlockedMe = userDoc.blockedUsers.some(
                    blockedId => blockedId.toString() === loggedInUserId.toString()
                );

                return {
                    ...user.toObject(),
                    lastMessage: lastMessage || null,
                    isBlockedByMe,
                    hasBlockedMe,
                    createdAt: user.createdAt, // Include createdAt for new user badge
                    unreadCount, // Include unread message count
                };
            })
        );

        res.status(200).json(usersWithLastMessage);
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ],
        });

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        // Check if sender is blocked by receiver
        const receiver = await User.findById(receiverId).select('blockedUsers');
        if (receiver && receiver.blockedUsers.some(blockedId => blockedId.toString() === senderId.toString())) {
            return res.status(403).json({
                error: "Cannot send message. You have been blocked by this user."
            });
        }

        // Check if receiver is blocked by sender
        const sender = await User.findById(senderId).select('blockedUsers');
        if (sender && sender.blockedUsers.some(blockedId => blockedId.toString() === receiverId.toString())) {
            return res.status(403).json({
                error: "Cannot send message. You have blocked this user."
            });
        }


        let imageUrl;
        if (image) {
            // Upload base64 image to cloudinary
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        // Check if receiver is online
        const receiverSocketId = getReceiverSocketId(receiverId);
        const initialStatus = receiverSocketId ? "delivered" : "sent";

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            status: initialStatus,
        });

        await newMessage.save();

        if (receiverSocketId) {
            // Send new message to receiver
            io.to(receiverSocketId).emit("newMessage", newMessage);

            // Notify sender that message was delivered
            const senderSocketId = getReceiverSocketId(senderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit("messageDelivered", {
                    messageId: newMessage._id,
                    status: "delivered"
                });
            }
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log("Error in sendMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const deleteForAllMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user._id;

    try {
        const message = await Message.findByIdAndUpdate(
            messageId,
            {
                $addToSet: { deletedFor: userId },
                text: "This message was deleted",
                image: null
            },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // ✅ Emit updated message to all clients
        io.emit("deleteMessageForAll", message);

        return res.status(200).json({
            success: true,
            message: "Message marked as deleted for everyone",
            updatedMessage: message
        });
    } catch (err) {
        console.error("Delete error:", err);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

export const forwardMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { receiverId } = req.body;
        const senderId = req.user._id;

        // Get the original message
        const originalMessage = await Message.findById(messageId);
        if (!originalMessage) {
            return res.status(404).json({ error: "Message not found" });
        }

        // Create a new forwarded message
        const forwardedMessage = new Message({
            senderId,
            receiverId,
            text: originalMessage.text,
            image: originalMessage.image,
            isForwarded: true,
            forwardedFrom: originalMessage.senderId,
            forwardedFromMessage: originalMessage._id
        });

        await forwardedMessage.save();

        // Notify the receiver via socket
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", forwardedMessage);
        }

        res.status(201).json(forwardedMessage);
    } catch (error) {
        console.log("Error in forwardMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const markMessagesAsRead = async (req, res) => {
    try {
        const { id: otherUserId } = req.params;
        const myId = req.user._id;

        // Get messages that need to be marked as read
        const messagesToUpdate = await Message.find({
            senderId: otherUserId,
            receiverId: myId,
            status: { $ne: "read" }
        }).select('_id');

        // Mark all messages from the other user as read
        const result = await Message.updateMany(
            {
                senderId: otherUserId,
                receiverId: myId,
                status: { $ne: "read" }
            },
            {
                $set: { status: "read" }
            }
        );

        // Notify sender via socket that messages were read
        const senderSocketId = getReceiverSocketId(otherUserId);
        if (senderSocketId && messagesToUpdate.length > 0) {
            io.to(senderSocketId).emit("messagesRead", {
                readBy: myId,
                chatWith: otherUserId,
                messageIds: messagesToUpdate.map(msg => msg._id.toString())
            });
        }

        res.status(200).json({
            success: true,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.log("Error in markMessagesAsRead controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
