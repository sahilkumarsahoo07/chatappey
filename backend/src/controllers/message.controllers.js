import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import FriendRequest from "../models/friendRequest.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

        // Get logged-in user's blocked users list and friends list
        const loggedInUser = await User.findById(loggedInUserId).select('blockedUsers friends');
        const myBlockedUsers = loggedInUser.blockedUsers.map(id => id.toString());
        const myFriends = loggedInUser.friends.map(id => id.toString());

        // Get last message and block status for each user
        const usersWithLastMessage = await Promise.all(
            filteredUsers.map(async (user) => {
                // Get last message, but exclude scheduled messages where I am the receiver
                const lastMessage = await Message.findOne({
                    $and: [
                        {
                            $or: [
                                { senderId: loggedInUserId, receiverId: user._id },
                                { senderId: user._id, receiverId: loggedInUserId },
                            ]
                        },
                        {
                            $or: [
                                { status: { $ne: 'scheduled' } },
                                { senderId: loggedInUserId, status: 'scheduled' } // I can see my own scheduled messages
                            ]
                        },
                        // Additional check: ensure scheduledFor time has passed
                        {
                            $or: [
                                { scheduledFor: { $exists: false } },
                                { scheduledFor: { $lte: new Date() } },
                                { senderId: loggedInUserId }
                            ]
                        }
                    ]
                })
                    .sort({ createdAt: -1 })
                    .select('text image createdAt senderId status');

                // Debug: Log if we found a scheduled message for this user
                if (lastMessage && lastMessage.status === 'scheduled') {
                    console.log(`⚠️ SIDEBAR: Found scheduled message for user ${user.fullName}:`, {
                        messageId: lastMessage._id,
                        status: lastMessage.status,
                        senderId: lastMessage.senderId,
                        loggedInUserId,
                        isSender: lastMessage.senderId.toString() === loggedInUserId.toString()
                    });
                }

                // Count unread messages from this user (exclude scheduled)
                const unreadCount = await Message.countDocuments({
                    senderId: user._id,
                    receiverId: loggedInUserId,
                    status: { $nin: ['read', 'scheduled'] }
                });

                // Check if I blocked this user
                const isBlockedByMe = myBlockedUsers.includes(user._id.toString());

                // Check if this user blocked me
                const userDoc = await User.findById(user._id).select('blockedUsers');
                const hasBlockedMe = userDoc.blockedUsers.some(
                    blockedId => blockedId.toString() === loggedInUserId.toString()
                );

                // Check if we are friends
                const isFriend = myFriends.includes(user._id.toString());

                // Check for pending friend request
                const pendingRequest = await FriendRequest.findOne({
                    $or: [
                        { senderId: loggedInUserId, receiverId: user._id, status: 'pending' },
                        { senderId: user._id, receiverId: loggedInUserId, status: 'pending' }
                    ]
                });

                return {
                    ...user.toObject(),
                    lastMessage: lastMessage || null,
                    isBlockedByMe,
                    hasBlockedMe,
                    isFriend,
                    hasPendingRequest: !!pendingRequest,
                    pendingRequestSentByMe: pendingRequest?.senderId.toString() === loggedInUserId.toString(),
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
            $and: [
                {
                    $or: [
                        { senderId: myId, receiverId: userToChatId },
                        { senderId: userToChatId, receiverId: myId },
                    ]
                },
                {
                    $or: [
                        { status: { $ne: 'scheduled' } },
                        { senderId: myId, status: 'scheduled' }
                    ]
                },
                // Additional check: even if status is not 'scheduled',
                // don't show messages with future scheduledFor times to receiver
                {
                    $or: [
                        { scheduledFor: { $exists: false } }, // Not a scheduled message
                        { scheduledFor: { $lte: new Date() } }, // Scheduled time has passed
                        { senderId: myId } // I'm the sender, so I can see my own scheduled messages
                    ]
                }
            ]
        });

        // Log any scheduled messages found
        const scheduledMessages = messages.filter(m => m.status === 'scheduled');
        if (scheduledMessages.length > 0) {
            console.log("WARNING: Found scheduled messages in results:");
            scheduledMessages.forEach(m => {
                console.log(`  - ID: ${m._id}, status: ${m.status}, scheduledFor: ${m.scheduledFor}, senderId: ${m.senderId}`);
            });
        }

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image, audio, file, fileName, replyTo, poll, scheduledFor, isScheduled } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        // Check if users are friends
        const sender = await User.findById(senderId).select('blockedUsers friends');
        const isFriend = sender.friends.some(friendId => friendId.toString() === receiverId.toString());

        if (!isFriend) {
            return res.status(403).json({
                error: "Cannot send message. You must be friends to chat."
            });
        }

        // Check if sender is blocked by receiver
        const receiver = await User.findById(receiverId).select('blockedUsers');
        if (receiver && receiver.blockedUsers.some(blockedId => blockedId.toString() === senderId.toString())) {
            return res.status(403).json({
                error: "Cannot send message. You have been blocked by this user."
            });
        }

        // Check if receiver is blocked by sender
        if (sender && sender.blockedUsers.some(blockedId => blockedId.toString() === receiverId.toString())) {
            return res.status(403).json({
                error: "Cannot send message. You have blocked this user."
            });
        }

        let imageUrl, audioUrl, fileUrl;

        // Upload Image
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        // Upload Audio (treated as video by Cloudinary for audio files)
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

        // Upload File (treated as raw) - preserve filename
        if (file) {
            const uploadOptions = {
                resource_type: "raw"
            };

            // If fileName is provided, use it as public_id to preserve the extension
            if (fileName) {
                // Remove any path components and sanitize
                const sanitizedName = fileName.split('/').pop().split('\\').pop();
                // Remove extension from public_id (Cloudinary adds it automatically)
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
        let initialStatus = receiverSocketId ? "delivered" : "sent";

        // CRITICAL: Ensure we check BOTH isScheduled AND scheduledFor
        const shouldBeScheduled = isScheduled || !!scheduledFor;

        if (shouldBeScheduled) {
            initialStatus = "scheduled";
        }

        const newMessage = new Message({
            senderId,
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

// DELETE ALL MESSAGES - Use with caution!
export const deleteAllMessages = async (req, res) => {
    try {
        // Check if this is an authorized request
        const confirmDelete = req.headers['x-confirm-delete'];

        if (confirmDelete !== 'YES_DELETE_ALL') {
            return res.status(403).json({
                error: "Unauthorized. Add header 'x-confirm-delete: YES_DELETE_ALL' to confirm deletion"
            });
        }

        // Delete all messages from the database
        const result = await Message.deleteMany({});

        res.status(200).json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} messages`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.log("Error in deleteAllMessages controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const addReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });

        // BLOCK SELF-REACTION
        if (message.senderId.toString() === userId.toString()) {
            return res.status(400).json({ error: "You cannot react to your own message" });
        }

        const existingReactionIndex = message.reactions.findIndex(r => r.userId.toString() === userId.toString());

        if (existingReactionIndex !== -1) {
            if (message.reactions[existingReactionIndex].emoji === emoji) {
                message.reactions.splice(existingReactionIndex, 1);
            } else {
                message.reactions[existingReactionIndex].emoji = emoji;
            }
        } else {
            message.reactions.push({ userId, emoji });
        }

        await message.save();

        const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
        const senderSocketId = getReceiverSocketId(message.senderId.toString());

        const payload = { messageId, reactions: message.reactions };
        if (receiverSocketId) io.to(receiverSocketId).emit("messageReaction", payload);
        if (senderSocketId) io.to(senderSocketId).emit("messageReaction", payload);

        res.status(200).json(message);
    } catch (error) {
        console.log("Error in addReaction: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });

        if (message.senderId.toString() !== userId.toString()) {
            console.log("Edit blocked: Ownership mismatch", { sender: message.senderId, user: userId });
            return res.status(403).json({ error: "Unauthorized" });
        }

        // 5 MINUTE EDIT LIMIT
        const fiveMinutesInMs = 5 * 60 * 1000;
        const timeElapsed = Date.now() - new Date(message.createdAt).getTime();

        console.log("Edit request check:", { timeElapsed, fiveMinutesInMs, createdAt: message.createdAt });

        if (timeElapsed > fiveMinutesInMs) {
            console.log("Edit blocked: Time limit exceeded", { timeElapsed, fiveMinutesInMs });
            return res.status(403).json({ error: "Edit time limit exceeded (5 minutes)" });
        }

        message.text = text;
        message.isEdited = true;
        await message.save();

        // Broadcast update
        const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
        const senderSocketId = getReceiverSocketId(message.senderId.toString());

        if (receiverSocketId) io.to(receiverSocketId).emit("messageUpdated", message);
        if (senderSocketId) io.to(senderSocketId).emit("messageUpdated", message);

        res.status(200).json(message);
    } catch (error) {
        console.log("Error in editMessage: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const togglePinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });

        message.isPinned = !message.isPinned;
        await message.save();

        // Broadcast update
        const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
        const senderSocketId = getReceiverSocketId(message.senderId.toString());

        const payload = { messageId, isPinned: message.isPinned };
        if (receiverSocketId) io.to(receiverSocketId).emit("messagePinned", payload);
        if (senderSocketId) io.to(senderSocketId).emit("messagePinned", payload);

        res.status(200).json(message);
    } catch (error) {
        console.log("Error in togglePinMessage: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const votePoll = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { optionIndex } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message || !message.poll) return res.status(404).json({ error: "Poll not found" });

        // Remove previous votes by this user
        message.poll.options.forEach(opt => {
            opt.votes = opt.votes.filter(id => id.toString() !== userId.toString());
        });

        // Add new vote
        if (optionIndex !== undefined && optionIndex >= 0 && optionIndex < message.poll.options.length) {
            message.poll.options[optionIndex].votes.push(userId);
        }

        await message.save();

        // Broadcast update
        const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
        const senderSocketId = getReceiverSocketId(message.senderId.toString());

        const payload = { messageId, poll: message.poll };
        if (receiverSocketId) io.to(receiverSocketId).emit("pollUpdated", payload);
        if (senderSocketId) io.to(senderSocketId).emit("pollUpdated", payload);

        res.status(200).json(message);
    } catch (error) {
        console.log("Error in votePoll: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

