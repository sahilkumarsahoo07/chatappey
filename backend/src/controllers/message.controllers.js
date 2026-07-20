import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import FriendRequest from "../models/friendRequest.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io, userSocketMap } from "../lib/socket.js";
import { sendPushNotification } from "../lib/webpush.js";
import { emitToUser } from "../utils/messageStatus.utils.js";
import mongoose from "mongoose";
import { getPreferencesMap, isChatMuted, unarchiveDmChat } from "../utils/chatPreference.utils.js";
import {
    annotateDeleteFlags,
    applyDeleteForEveryoneFields,
    canDeleteForEveryone,
    getDeleteOptions,
    DELETED_TEXT_EVERYONE,
} from "../utils/messageDelete.utils.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const { search } = req.query;

        // Get logged-in user's blocked users list and friends list
        const loggedInUser = await User.findById(loggedInUserId).select('blockedUsers friends');
        const myBlockedUsers = loggedInUser?.blockedUsers ? loggedInUser.blockedUsers.map(id => id.toString()) : [];
        const myFriends = loggedInUser?.friends ? loggedInUser.friends.map(id => id.toString()) : [];

        let queryUsers;
        if (search) {
            const query = search.trim();
            if (query.length < 2) {
                return res.status(200).json([]);
            }
            // Escape regex special chars so "a.b" doesn't match everything
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Discover/Search mode: search all users except current user by name or email
            queryUsers = await User.find({
                _id: { $ne: loggedInUserId },
                $or: [
                    { fullName: { $regex: escaped, $options: "i" } },
                    { email: { $regex: escaped, $options: "i" } }
                ]
            })
                .select("-password")
                .limit(40)
                .sort({ fullName: 1 });
        } else {
            // Sidebar mode: only fetch friends to avoid loading the entire database
            queryUsers = await User.find({
                _id: { $in: myFriends }
            }).select("-password");
        }

        if (!queryUsers || queryUsers.length === 0) {
            return res.status(200).json([]);
        }

        const loggedInUserObjectId = new mongoose.Types.ObjectId(loggedInUserId);
        const queryUserObjectIds = queryUsers.map(user => new mongoose.Types.ObjectId(user._id));

        // Fetch last messages, unread counts, and pending requests in parallel
        const [lastMessagesAgg, unreadCountsAgg, pendingRequests] = await Promise.all([
            // 1. Bulk aggregate last messages for all queried users
            Message.aggregate([
                {
                    $match: {
                        $and: [
                            {
                                $or: [
                                    { senderId: loggedInUserObjectId, receiverId: { $in: queryUserObjectIds } },
                                    { receiverId: loggedInUserObjectId, senderId: { $in: queryUserObjectIds } }
                                ]
                            },
                            {
                                $or: [
                                    { status: { $ne: 'scheduled' } },
                                    { senderId: loggedInUserObjectId, status: 'scheduled' }
                                ]
                            },
                            {
                                $or: [
                                    { scheduledFor: { $exists: false } },
                                    { scheduledFor: { $lte: new Date() } },
                                    { senderId: loggedInUserObjectId }
                                ]
                            },
                            // Hide messages deleted for me
                            { deletedFor: { $nin: [loggedInUserObjectId] } }
                        ]
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $group: {
                        _id: {
                            $cond: [
                                { $eq: ["$senderId", loggedInUserObjectId] },
                                "$receiverId",
                                "$senderId"
                            ]
                        },
                        lastMessage: { $first: "$$ROOT" }
                    }
                }
            ]),
            // 2. Bulk aggregate unread message counts
            Message.aggregate([
                {
                    $match: {
                        receiverId: loggedInUserObjectId,
                        senderId: { $in: queryUserObjectIds },
                        status: { $nin: ['read', 'scheduled'] },
                        deletedFor: { $nin: [loggedInUserObjectId] }
                    }
                },
                {
                    $group: {
                        _id: "$senderId",
                        count: { $sum: 1 }
                    }
                }
            ]),
            // 3. Bulk fetch pending friend requests
            FriendRequest.find({
                $or: [
                    { senderId: loggedInUserObjectId, receiverId: { $in: queryUserObjectIds }, status: 'pending' },
                    { receiverId: loggedInUserObjectId, senderId: { $in: queryUserObjectIds }, status: 'pending' }
                ]
            })
        ]);

        // Map aggregation results to Maps for O(1) lookup
        const lastMessageMap = new Map();
        lastMessagesAgg.forEach(item => {
            if (item._id) {
                lastMessageMap.set(item._id.toString(), item.lastMessage);
            }
        });

        const unreadCountMap = new Map();
        unreadCountsAgg.forEach(item => {
            if (item._id) {
                unreadCountMap.set(item._id.toString(), item.count);
            }
        });

        const pendingRequestMap = new Map();
        pendingRequests.forEach(req => {
            const senderStr = req.senderId.toString();
            const receiverStr = req.receiverId.toString();
            const loggedInStr = loggedInUserId.toString();
            const otherId = senderStr === loggedInStr ? receiverStr : senderStr;
            pendingRequestMap.set(otherId, req);
        });

        const prefsMap = await getPreferencesMap(loggedInUserId);

        // Assemble the user payload
        const usersWithLastMessage = queryUsers.map((user) => {
            const userIdStr = user._id.toString();

            // Check if I blocked this user
            const isBlockedByMe = myBlockedUsers.includes(userIdStr);

            // Check if this user blocked me
            const hasBlockedMe = user.blockedUsers ? user.blockedUsers.some(
                blockedId => blockedId.toString() === loggedInUserId.toString()
            ) : false;

            // Check if we are friends
            const isFriend = myFriends.includes(userIdStr);

            // Privacy checks
            const privacyLastSeen = user.privacyLastSeen || "everyone";
            const privacyProfilePic = user.privacyProfilePic || "everyone";
            const privacyAbout = user.privacyAbout || "everyone";

            let showLastSeen = true;
            let showProfilePic = true;
            let showAbout = true;

            if (privacyLastSeen === "none") {
                showLastSeen = false;
            } else if (privacyLastSeen === "contacts") {
                showLastSeen = isFriend;
            }

            if (privacyProfilePic === "none") {
                showProfilePic = false;
            } else if (privacyProfilePic === "contacts") {
                showProfilePic = isFriend;
            }

            if (privacyAbout === "none") {
                showAbout = false;
            } else if (privacyAbout === "contacts") {
                showAbout = isFriend;
            }

            const pendingRequest = pendingRequestMap.get(userIdStr);
            const pref = prefsMap.get(`dm:${userIdStr}`);

            return {
                ...user.toObject(),
                profilePic: showProfilePic ? user.profilePic : null,
                about: showAbout ? user.about : null,
                lastLogout: showLastSeen ? user.lastLogout : null,
                lastMessage: lastMessageMap.get(userIdStr) || null,
                isBlockedByMe,
                hasBlockedMe,
                isFriend,
                hasPendingRequest: !!pendingRequest,
                pendingRequestSentByMe: pendingRequest?.senderId.toString() === loggedInUserId.toString(),
                createdAt: user.createdAt,
                unreadCount: unreadCountMap.get(userIdStr) || 0,
                isArchived: pref?.isArchived || false,
                isMuted: isChatMuted(pref),
                mutedUntil: pref?.mutedUntil || null,
                wallpaper: pref?.wallpaper || null,
            };
        });

        const result = search
            ? usersWithLastMessage
            : usersWithLastMessage.filter((u) => !u.isArchived);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

const buildDmMessageFilter = (myId, userToChatId) => ({
    $and: [
        {
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ],
        },
        {
            $or: [
                { status: { $ne: "scheduled" } },
                { senderId: myId, status: "scheduled" },
            ],
        },
        {
            $or: [
                { scheduledFor: { $exists: false } },
                { scheduledFor: { $lte: new Date() } },
                { senderId: myId },
            ],
        },
        { deletedFor: { $nin: [myId] } },
    ],
});

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.user._id;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
        const before = req.query.before
          ? new Date(req.query.before)
          : req.query.cursor
            ? new Date(req.query.cursor)
            : null;
        const after = req.query.after ? new Date(req.query.after) : null;

        const baseFilter = buildDmMessageFilter(myId, userToChatId);
        const dateFilter = {};

        if (after && !isNaN(after.getTime())) {
            dateFilter.createdAt = { $gt: after };
        } else if (before && !isNaN(before.getTime())) {
            dateFilter.createdAt = { $lt: before };
        }

        const query =
            Object.keys(dateFilter).length > 0
                ? { $and: [baseFilter, dateFilter] }
                : baseFilter;

        let messages;
        let hasMore = false;

        if (after && !isNaN(after.getTime())) {
            messages = await Message.find(query).sort({ createdAt: 1 }).limit(limit);
            hasMore = messages.length === limit;
        } else if (before && !isNaN(before.getTime())) {
            const batch = await Message.find(query).sort({ createdAt: -1 }).limit(limit);
            hasMore = batch.length === limit;
            messages = batch.reverse();
        } else {
            const batch = await Message.find(query).sort({ createdAt: -1 }).limit(limit);
            hasMore = batch.length === limit;
            messages = batch.reverse();
        }

        const scheduledMessages = messages.filter((m) => m.status === "scheduled");
        if (scheduledMessages.length > 0) {
            console.log("WARNING: Found scheduled messages in results:");
            scheduledMessages.forEach((m) => {
                console.log(
                    `  - ID: ${m._id}, status: ${m.status}, scheduledFor: ${m.scheduledFor}, senderId: ${m.senderId}`
                );
            });
        }

        const oldestCursor = messages[0]?.createdAt || null;
        const newestCursor = messages[messages.length - 1]?.createdAt || null;
        res.status(200).json({
            messages: annotateDeleteFlags(messages, myId),
            hasMore,
            // nextCursor = load older page (WhatsApp reverse infinite scroll)
            nextCursor: hasMore ? oldestCursor : null,
            oldestCursor,
            newestCursor,
        });
    } catch (error) {
        console.log("Error in getMessages controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image, audio, file, fileName, video, videoThumbnail, videoDuration, videoPublicId, replyTo, replyToMessage, poll, scheduledFor, isScheduled } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        // Fetch sender, receiver, and original message (for reply) in parallel
        const fetchSender = User.findById(senderId).select('blockedUsers friends');
        const fetchReceiver = User.findById(receiverId).select('blockedUsers');
        const fetchOriginalMessage = (replyTo && mongoose.Types.ObjectId.isValid(replyTo))
            ? Message.findById(replyTo).populate('senderId', 'fullName')
            : Promise.resolve(null);

        const [sender, receiver, originalMessage] = await Promise.all([
            fetchSender,
            fetchReceiver,
            fetchOriginalMessage
        ]);

        if (!sender) {
            return res.status(404).json({ error: "Sender not found." });
        }

        // Check if users are friends
        const isFriend = sender.friends.some(friendId => friendId.toString() === receiverId.toString());

        if (!isFriend) {
            return res.status(403).json({
                error: "Cannot send message. You must be friends to chat."
            });
        }

        // Check if sender is blocked by receiver
        if (receiver && receiver.blockedUsers.some(blockedId => blockedId.toString() === senderId.toString())) {
            return res.status(403).json({
                error: "Cannot send message. You have been blocked by this user."
            });
        }

        // Check if receiver is blocked by sender
        if (sender.blockedUsers.some(blockedId => blockedId.toString() === receiverId.toString())) {
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
        let replyToMessageData = req.body.replyToMessage || null;
        let validReplyTo = replyTo;
        
        if (replyTo) {
            if (mongoose.Types.ObjectId.isValid(replyTo)) {
                if (originalMessage) {
                    replyToMessageData = {
                        text: originalMessage.text,
                        image: originalMessage.image,
                        senderId: originalMessage.senderId._id,
                        senderName: originalMessage.senderId.fullName
                    };
                }
            } else {
                validReplyTo = null;
            }
        }

        // Deduplication by clientMessageId
        if (req.body.clientMessageId) {
            const existingMsg = await Message.findOne({ clientMessageId: req.body.clientMessageId });
            if (existingMsg) {
                return res.status(200).json(
                    typeof existingMsg.toObject === "function"
                        ? { ...existingMsg.toObject(), serverCreatedAt: existingMsg.createdAt }
                        : existingMsg
                );
            }
        }

        // CRITICAL: Ensure we check BOTH isScheduled AND scheduledFor
        const shouldBeScheduled = isScheduled || !!scheduledFor;
        let initialStatus = shouldBeScheduled ? "scheduled" : "sent";

        const newMessage = new Message({
            senderId: senderId,
            receiverId,
            text,
            clientMessageId: req.body.clientMessageId || undefined,
            image: imageUrl,
            video: video || undefined,
            videoThumbnail: videoThumbnail || undefined,
            videoDuration: videoDuration || undefined,
            videoPublicId: videoPublicId || undefined,
            audio: audioUrl,
            file: fileUrl,
            fileName: fileName || null,
            status: initialStatus,
            replyTo: validReplyTo || null,
            replyToMessage: replyToMessageData,
            poll: poll ? {
                question: poll.question,
                options: poll.options.map(opt => ({ text: opt.text, votes: [] }))
            } : undefined,
            scheduledFor: shouldBeScheduled ? new Date(scheduledFor) : undefined
        });

        await newMessage.save();

        // Unarchive for both participants when a new message is sent (WhatsApp-style)
        await unarchiveDmChat(senderId, receiverId);

        // Only emit if NOT scheduled
        if (!shouldBeScheduled) {
            const msgPayload = {
                ...(typeof newMessage.toObject === "function"
                    ? newMessage.toObject()
                    : newMessage),
                senderName: sender.fullName,
                senderProfilePic: sender.profilePic || "",
                serverCreatedAt: newMessage.createdAt,
            };

            if (receiverSocketId) {
                io.to(receiverSocketId).emit("newMessage", msgPayload);

                const senderSocketId = getReceiverSocketId(senderId.toString());
                if (senderSocketId) {
                    io.to(senderSocketId).emit("messageDelivered", {
                        messageId: newMessage._id,
                        status: "delivered"
                    });
                }
            }

            // Web Push Notification for receiver (outside browser / backgrounded)
            const bodyText = text || (imageUrl ? "📷 Photo" : video ? "🎬 Video" : audioUrl ? "🎤 Voice message" : poll ? "📊 Poll" : "📎 Attachment");
            sendPushNotification(receiverId, {
                title: sender.fullName || "New Message",
                body: bodyText,
                icon: sender.profilePic || "/avatar.png",
                tag: `chat-${senderId}`,
                data: {
                    url: `/?chat=${senderId}`,
                    chatId: String(senderId),
                    peer: sender,
                },
            }).catch((e) => console.error("Error sending REST Web Push notification:", e.message));
        }

        const responsePayload =
            typeof newMessage.toObject === "function"
                ? { ...newMessage.toObject(), serverCreatedAt: newMessage.createdAt }
                : newMessage;
        res.status(201).json(responsePayload);
    } catch (error) {
        console.log("Error in sendMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};


/**
 * Delete entire chat with a user for me only (hide all messages from my sidebar/chat).
 * Does not remove messages for the other person.
 */
export const deleteChatForMe = async (req, res) => {
    try {
        const myId = req.user._id;
        const { id: otherUserId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const result = await Message.updateMany(
            {
                $or: [
                    { senderId: myId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: myId },
                ],
            },
            { $addToSet: { deletedFor: myId } }
        );

        return res.status(200).json({
            success: true,
            message: "Chat deleted for you",
            modifiedCount: result.modifiedCount,
            userId: otherUserId,
        });
    } catch (error) {
        console.error("Error in deleteChatForMe:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/** WhatsApp-style: options for delete sheet (backend is source of truth) */
export const getMessageDeleteOptions = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }
        const participant =
            String(message.senderId) === String(userId) ||
            String(message.receiverId) === String(userId);
        if (!participant) {
            return res.status(403).json({ error: "Not allowed" });
        }
        return res.status(200).json(getDeleteOptions(message, userId));
    } catch (error) {
        console.error("getMessageDeleteOptions:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/** Delete for me only — hide from this user's view */
export const deleteForMeMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }
        const participant =
            String(message.senderId) === String(userId) ||
            String(message.receiverId) === String(userId);
        if (!participant) {
            return res.status(403).json({ error: "Not allowed" });
        }
        if (message.deletedForEveryone || message.deleted) {
            return res.status(400).json({ error: "Message already deleted" });
        }

        await Message.findByIdAndUpdate(messageId, {
            $addToSet: { deletedFor: userId },
        });

        const otherId =
            String(message.senderId) === String(userId)
                ? message.receiverId
                : message.senderId;

        // Only notify this user's other devices
        const mySocketId = getReceiverSocketId(userId.toString());
        if (mySocketId) {
            io.to(mySocketId).emit("deleteMessageForMe", {
                messageId,
                chatUserId: otherId,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Message deleted for you",
            messageId,
        });
    } catch (error) {
        console.error("deleteForMeMessage:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteForAllMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user._id;

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (String(message.senderId) !== String(userId)) {
            return res.status(403).json({ error: "You can only delete your own messages for everyone" });
        }

        if (message.deletedForEveryone || message.deleted) {
            return res.status(400).json({ error: "Message already deleted" });
        }

        if (!canDeleteForEveryone(message, userId)) {
            return res.status(403).json({
                error: "Delete for everyone is no longer available",
                canDeleteForEveryone: false,
            });
        }

        applyDeleteForEveryoneFields(message, userId);
        await message.save();

        const payload = {
            ...message.toObject(),
            canDeleteForEveryone: false,
        };

        // Notify both participants (and any other sockets)
        const senderSocket = getReceiverSocketId(message.senderId.toString());
        const receiverSocket = getReceiverSocketId(message.receiverId.toString());
        if (senderSocket) io.to(senderSocket).emit("deleteMessageForAll", payload);
        if (receiverSocket) io.to(receiverSocket).emit("deleteMessageForAll", payload);

        return res.status(200).json({
            success: true,
            message: "Message marked as deleted for everyone",
            updatedMessage: payload,
            canDeleteForEveryone: false,
        });
    } catch (err) {
        console.error("Delete error:", err);
        return res.status(500).json({
            success: false,
            error: err.message,
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
        const receiverSocketId = getReceiverSocketId(receiverId.toString());
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

        const now = new Date();

        // Mark all messages from the other user as read
        const result = await Message.updateMany(
            {
                senderId: otherUserId,
                receiverId: myId,
                status: { $ne: "read" }
            },
            {
                $set: { status: "read", readAt: now }
            }
        );

        // Notify sender on all devices (user room) when privacy allows
        if (messagesToUpdate.length > 0 && req.user.privacyReadReceipts !== false) {
            emitToUser(io, userSocketMap, otherUserId, "messagesRead", {
                readBy: String(myId),
                chatWith: String(otherUserId),
                messageIds: messagesToUpdate.map((msg) => msg._id.toString()),
                readAt: now,
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

