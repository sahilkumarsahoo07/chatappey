import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId, joinUsersToGroupRoom, userSocketMap } from "../lib/socket.js";
import { sendPushNotification } from "../lib/webpush.js";
import { getPreferencesMap, isChatMuted, unarchiveGroupChatForMembers } from "../utils/chatPreference.utils.js";
import {
    annotateDeleteFlags,
    applyDeleteForEveryoneFields,
    canDeleteForEveryone,
    getDeleteOptions,
    DELETED_TEXT_EVERYONE,
} from "../utils/messageDelete.utils.js";
import { applyComputedStatus } from "../utils/groupMessageStatus.utils.js";
import { canUpgradeStatus, emitToUser } from "../utils/messageStatus.utils.js";
import { ackGroupMessagesDelivered } from "../utils/groupDelivery.utils.js";

// Helper to send system messages to groups
const sendSystemMessage = async (groupId, text) => {
    try {
        const newMessage = new GroupMessage({
            groupId,
            text,
            messageType: "system",
            readBy: [] // System messages can be special, or just standard readBy
        });

        await newMessage.save();

        // Update group's lastMessage
        const group = await Group.findById(groupId);
        if (group) {
            group.lastMessage = {
                text,
                senderName: "System",
                createdAt: newMessage.createdAt
            };
            await group.save();

            // Broadcast via room so all joined members receive it
            io.to(String(groupId)).emit("group:newMessage", {
                groupId: String(groupId),
                message: newMessage
            });
        }
        return newMessage;
    } catch (error) {
        console.error("Error sending system message:", error);
    }
};

// Create a new group
export const createGroup = async (req, res) => {
    try {
        const { name, description, image, members } = req.body;
        const adminId = req.user._id;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: "Group name is required" });
        }

        if (!members || members.length === 0) {
            return res.status(400).json({ error: "At least one member is required" });
        }

        let imageUrl = "";
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        // Include admin in members list with join dates and roles
        const allMemberIds = [...new Set([adminId.toString(), ...members])];
        const membersWithDates = allMemberIds.map(id => ({
            user: id,
            joinedAt: new Date(),
            role: id.toString() === adminId.toString() ? "admin" : "member"
        }));

        const newGroup = new Group({
            name: name.trim(),
            description: description?.trim() || "",
            image: imageUrl,
            admin: adminId,
            members: membersWithDates
        });

        await newGroup.save();

        // Join rooms before system message so live broadcast reaches online members
        joinUsersToGroupRoom(allMemberIds, newGroup._id);

        // Send system message
        const adminUser = await User.findById(adminId);
        await sendSystemMessage(newGroup._id, `${adminUser.fullName} created group "${name.trim()}"`);

        // Populate member details for response
        const populatedGroup = await Group.findById(newGroup._id)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic");

        // Notify all members via socket
        allMemberIds.forEach(memberId => {
            const socketId = getReceiverSocketId(memberId);
            if (socketId) {
                io.to(socketId).emit("group:created", populatedGroup);
            }
        });

        res.status(201).json(populatedGroup);
    } catch (error) {
        console.error("Error in createGroup:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get all groups for current user
export const getMyGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await Group.find({
            $or: [
                { "members.user": userId },
                { members: userId } // Support old structure
            ]
        })
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic")
            .populate("members", "fullName profilePic") // Also populate old structure
            .populate({
                path: "pinnedMessage",
                populate: { path: "senderId", select: "fullName profilePic" }
            })
            .populate({
                path: "pinnedMessages",
                populate: { path: "senderId", select: "fullName profilePic" }
            })
            .sort({ updatedAt: -1 });

        // Get unread count for each group
        const groupsWithUnread = await Promise.all(
            groups.map(async (group) => {
                const memberInfo = group.members.find(m =>
                    (m.user?._id || m.user || m).toString() === userId.toString()
                );
                const joinedAt = memberInfo?.joinedAt || new Date(0);

                const unreadCount = await GroupMessage.countDocuments({
                    groupId: group._id,
                    senderId: { $ne: userId },
                    readBy: { $ne: userId },
                    createdAt: { $gte: joinedAt }
                });

                return {
                    ...group.toObject(),
                    unreadCount,
                    lastMessage: (group.lastMessage?.createdAt && new Date(group.lastMessage.createdAt) >= joinedAt)
                        ? group.lastMessage
                        : null
                };
            })
        );

        const prefsMap = await getPreferencesMap(userId);
        const withPrefs = groupsWithUnread.map((group) => {
            const pref = prefsMap.get(`group:${group._id}`);
            return {
                ...group,
                isArchived: pref?.isArchived || false,
                isMuted: isChatMuted(pref),
                mutedUntil: pref?.mutedUntil || null,
                wallpaper: pref?.wallpaper || null,
            };
        });

        res.status(200).json(withPrefs.filter((g) => !g.isArchived));
    } catch (error) {
        console.error("Error in getMyGroups:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get group details
export const getGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId)
            .populate("admin", "fullName profilePic email")
            .populate("members.user", "fullName profilePic email")
            .populate("members", "fullName profilePic email")
            .populate({
                path: "pinnedMessage",
                populate: { path: "senderId", select: "fullName profilePic" }
            })
            .populate({
                path: "pinnedMessages",
                populate: { path: "senderId", select: "fullName profilePic" }
            });

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        // Check if user is a member
        if (!group.members.some(m => m.user._id.toString() === userId.toString())) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        res.status(200).json(group);
    } catch (error) {
        console.error("Error in getGroupDetails:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Update group (admin only)
export const updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description, image } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const isAdmin = group.admin.toString() === userId.toString() ||
            group.members.some(m => (m.user?._id || m.user || m).toString() === userId.toString() && m.role === "admin");

        if (!isAdmin) {
            return res.status(403).json({ error: "Only admins can update group" });
        }

        let imageUrl = group.image;
        if (image && image !== group.image) {
            try {
                // Check if the image is a base64 data URI or a URL
                const isBase64 = image.startsWith("data:");
                const isCloudinaryUrl = image.includes("cloudinary.com");

                if (isBase64) {
                    // Upload base64 image to Cloudinary
                    const uploadResponse = await cloudinary.uploader.upload(image, {
                        folder: "group_images",
                        resource_type: "auto"
                    });
                    imageUrl = uploadResponse.secure_url;
                } else if (isCloudinaryUrl) {
                    // Already a Cloudinary URL, use as-is
                    imageUrl = image;
                } else {
                    // For other URLs, try uploading the URL to Cloudinary
                    const uploadResponse = await cloudinary.uploader.upload(image, {
                        folder: "group_images",
                        resource_type: "auto"
                    });
                    imageUrl = uploadResponse.secure_url;
                }
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(400).json({
                    error: `Failed to upload image: ${uploadError.message || "Unknown error"}`
                });
            }
        }

        group.name = name?.trim() || group.name;
        group.description = description?.trim() ?? group.description;
        group.image = imageUrl;
        if (req.body.announcementOnly !== undefined) {
            group.announcementOnly = req.body.announcementOnly;
        }

        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic");

        // Notify all members
        group.members.forEach(member => {
            const memberId = member.user || member;
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:updated", updatedGroup);
            }
        });

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in updateGroup:", error.message, error.stack);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete group (admin only)
export const deleteGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Only admin can delete group" });
        }

        const memberIds = group.members.map(m => (m.user || m).toString());

        // Delete all group messages
        await GroupMessage.deleteMany({ groupId });

        // Delete the group
        await Group.findByIdAndDelete(groupId);

        // Notify all members
        memberIds.forEach(memberId => {
            const socketId = getReceiverSocketId(memberId);
            if (socketId) {
                io.to(socketId).emit("group:deleted", { groupId });
            }
        });

        res.status(200).json({ message: "Group deleted successfully" });
    } catch (error) {
        console.error("Error in deleteGroup:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Add members to group (admin only)
export const addMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { memberIds } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const isAdmin = group.admin.toString() === userId.toString() ||
            group.members.some(m => (m.user?._id || m.user || m).toString() === userId.toString() && m.role === "admin");

        if (!isAdmin) {
            return res.status(403).json({ error: "Only admins can add members" });
        }

        if (!memberIds || memberIds.length === 0) {
            return res.status(400).json({ error: "No members specified" });
        }

        // Add new members (avoid duplicates)
        const existingMemberIds = group.members.map(m => (m.user?._id || m.user || m).toString());
        const newMemberIds = memberIds.filter(id => !existingMemberIds.includes(id));

        if (newMemberIds.length === 0) {
            return res.status(400).json({ error: "All specified users are already members" });
        }

        const membersToAdd = newMemberIds.map(id => ({
            user: id,
            joinedAt: new Date()
        }));

        group.members.push(...membersToAdd);
        await group.save();

        // Join rooms before system messages so new members get live updates
        joinUsersToGroupRoom(newMemberIds, groupId);

        const adminUser = await User.findById(userId);
        for (const memberId of newMemberIds) {
            const addedUser = await User.findById(memberId);
            await sendSystemMessage(groupId, `${adminUser.fullName} added ${addedUser.fullName}`);
        }

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic");

        // Notify all members (including new ones)
        updatedGroup.members.forEach(member => {
            const socketId = getReceiverSocketId(member.user._id.toString());
            if (socketId) {
                io.to(socketId).emit("group:memberAdded", {
                    group: updatedGroup,
                    newMembers: newMemberIds
                });
            }
        });

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in addMembers:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Remove member from group (admin only)
export const removeMember = async (req, res) => {
    try {
        const { groupId, userId: memberToRemove } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const currentUserMember = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const targetMember = group.members.find(m => (m.user?._id || m.user || m).toString() === memberToRemove);

        const isOwner = group.admin.toString() === userId.toString();
        const isAdmin = isOwner || currentUserMember?.role === "admin";

        if (!isAdmin) {
            return res.status(403).json({ error: "Only admins can remove members" });
        }

        if (memberToRemove === group.admin.toString()) {
            return res.status(400).json({ error: "Group owner cannot be removed" });
        }

        // Only owner can remove other admins
        if (targetMember?.role === "admin" && !isOwner) {
            return res.status(403).json({ error: "Only group owner can remove other admins" });
        }

        group.members = group.members.filter(m => m.user.toString() !== memberToRemove);
        await group.save();

        const adminUser = await User.findById(userId);
        const removedUser = await User.findById(memberToRemove);
        await sendSystemMessage(groupId, `${adminUser.fullName} removed ${removedUser.fullName}`);

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic");

        // Notify remaining members
        updatedGroup.members.forEach(member => {
            const socketId = getReceiverSocketId(member.user._id.toString());
            if (socketId) {
                io.to(socketId).emit("group:memberRemoved", {
                    group: updatedGroup,
                    removedMember: memberToRemove
                });
            }
        });

        // Notify removed member
        const removedSocketId = getReceiverSocketId(memberToRemove);
        if (removedSocketId) {
            io.to(removedSocketId).emit("group:removed", { groupId });
        }

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in removeMember:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Leave group
export const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (group.admin.toString() === userId.toString()) {
            return res.status(400).json({
                error: "Admin cannot leave. Transfer admin role or delete the group."
            });
        }

        group.members = group.members.filter(m => m.user.toString() !== userId.toString());
        await group.save();

        const userWhoLeft = await User.findById(userId);
        await sendSystemMessage(groupId, `${userWhoLeft.fullName} left the group`);

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic");

        // Notify remaining members
        updatedGroup.members.forEach(member => {
            const socketId = getReceiverSocketId(member.user._id.toString());
            if (socketId) {
                io.to(socketId).emit("group:memberLeft", {
                    group: updatedGroup,
                    leftMember: userId
                });
            }
        });

        res.status(200).json({ message: "Left group successfully" });
    } catch (error) {
        console.error("Error in leaveGroup:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get group messages
export const getGroupMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const memberInfo = group.members.find(m =>
            (m.user?._id || m.user || m).toString() === userId.toString()
        );
        if (!memberInfo) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
        const before = req.query.before
          ? new Date(req.query.before)
          : req.query.cursor
            ? new Date(req.query.cursor)
            : null;
        const after = req.query.after ? new Date(req.query.after) : null;

        const baseQuery = {
            groupId,
            createdAt: { $gte: memberInfo.joinedAt },
            deletedFor: { $nin: [userId] },
        };

        if (after && !isNaN(after.getTime())) {
            baseQuery.createdAt = { $gte: memberInfo.joinedAt, $gt: after };
        } else if (before && !isNaN(before.getTime())) {
            baseQuery.createdAt = {
                $gte: memberInfo.joinedAt,
                $lt: before,
            };
        }

        let messages;
        let hasMore = false;

        if (after && !isNaN(after.getTime())) {
            messages = await GroupMessage.find(baseQuery)
                .populate("senderId", "fullName profilePic")
                .populate("readBy", "fullName profilePic")
                .populate("deliveredTo.userId", "fullName profilePic")
                .populate("readReceipts.userId", "fullName profilePic")
                .populate("mentions", "fullName profilePic")
                .sort({ createdAt: 1 })
                .limit(limit);
            hasMore = messages.length === limit;
        } else if (before && !isNaN(before.getTime())) {
            const batch = await GroupMessage.find(baseQuery)
                .populate("senderId", "fullName profilePic")
                .populate("readBy", "fullName profilePic")
                .populate("deliveredTo.userId", "fullName profilePic")
                .populate("readReceipts.userId", "fullName profilePic")
                .populate("mentions", "fullName profilePic")
                .sort({ createdAt: -1 })
                .limit(limit);
            hasMore = batch.length === limit;
            messages = batch.reverse();
        } else {
            const batch = await GroupMessage.find(baseQuery)
                .populate("senderId", "fullName profilePic")
                .populate("readBy", "fullName profilePic")
                .populate("deliveredTo.userId", "fullName profilePic")
                .populate("readReceipts.userId", "fullName profilePic")
                .populate("mentions", "fullName profilePic")
                .sort({ createdAt: -1 })
                .limit(limit);
            hasMore = batch.length === limit;
            messages = batch.reverse();
        }

        const oldestCursor = messages[0]?.createdAt || null;
        const newestCursor = messages[messages.length - 1]?.createdAt || null;
        res.status(200).json({
            messages: annotateDeleteFlags(messages, userId),
            hasMore,
            nextCursor: hasMore ? oldestCursor : null,
            oldestCursor,
            newestCursor,
        });
    } catch (error) {
        console.error("Error in getGroupMessages:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Send message to group
export const sendGroupMessage = async (req, res) => {
    try {
        const { groupId } = req.params;
        const {
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
        } = req.body;
        const senderId = req.user._id;

        if (clientMessageId) {
            const existing = await GroupMessage.findOne({ clientMessageId })
                .populate("senderId", "fullName profilePic")
                .populate("mentions", "fullName profilePic");
            if (existing) {
                const payload = typeof existing.toObject === "function"
                    ? { ...existing.toObject(), serverCreatedAt: existing.createdAt }
                    : existing;
                return res.status(200).json(payload);
            }
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const currentUserMember = group.members.find(m => (m.user?._id || m.user || m).toString() === senderId.toString());
        if (!currentUserMember) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        const isOwner = group.admin.toString() === senderId.toString();
        const isAdmin = isOwner || currentUserMember?.role === "admin";

        if (group.announcementOnly && !isAdmin) {
            return res.status(403).json({ error: "Only admins can send messages in this group" });
        }

        let imageUrl, audioUrl, fileUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }
        if (audio) {
            const uploadResponse = await cloudinary.uploader.upload(audio, { resource_type: "auto" });
            audioUrl = uploadResponse?.secure_url;
        }
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

        const sender = await User.findById(senderId).select("fullName");

        // Validate mentions - ensure all mentioned users are group members
        let validMentions = [];
        if (mentions && Array.isArray(mentions)) {
            const memberIds = group.members.map(m => (m.user?._id || m.user || m).toString());
            validMentions = mentions.filter(id => memberIds.includes(id.toString()));
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
            senderId,
            text,
            image: imageUrl,
            video: video || undefined,
            videoThumbnail: videoThumbnail || undefined,
            videoDuration: videoDuration || undefined,
            videoPublicId: videoPublicId || undefined,
            audio: audioUrl,
            file: fileUrl,
            fileName: fileName || undefined,
            readBy: [senderId],
            deliveredTo: [],
            readReceipts: [],
            status: "sent",
            isForwarded: isForwarded || false,
            mentions: validMentions,
            replyTo: validReplyTo,
            replyToMessage: replyToMessageData,
            clientMessageId: clientMessageId || null,
            poll: poll || undefined
        });

        await newMessage.save();

        const memberIds = group.members.map((m) => m.user?._id || m.user || m);
        await unarchiveGroupChatForMembers(groupId, memberIds);

        // Update group's lastMessage
        group.lastMessage = {
            text: text || (imageUrl ? "📷 Photo" : video ? "🎬 Video" : poll ? "📊 Poll" : ""),
            senderId,
            senderName: sender.fullName,
            createdAt: newMessage.createdAt
        };
        await group.save();

        // Populate sender info and mentions
        const populatedMessage = await GroupMessage.findById(newMessage._id)
            .populate("senderId", "fullName profilePic")
            .populate("mentions", "fullName profilePic");

        const payload =
            typeof populatedMessage.toObject === "function"
                ? {
                    ...populatedMessage.toObject(),
                    serverCreatedAt: populatedMessage.createdAt,
                    clientMessageId: clientMessageId || undefined,
                  }
                : populatedMessage;

        // Broadcast via group room (all devices that joined) + mention pings
        io.to(String(groupId)).emit("group:newMessage", {
            groupId: String(groupId),
            message: payload
        });

        // Send Web Push Notification to group members (outside browser / backgrounded)
        group.members.forEach((m) => {
            const memberId = (m.user?._id || m.user || m).toString();
            if (memberId !== senderId.toString()) {
                const bodyText = text || (imageUrl ? "📷 Photo" : video ? "🎬 Video" : audioUrl ? "🎤 Voice message" : poll ? "📊 Poll" : "📎 Attachment");
                sendPushNotification(memberId, {
                    title: `${group.name} (${sender.fullName})`,
                    body: bodyText,
                    icon: group.image || sender.profilePic || "/avatar.png",
                    tag: `group-${groupId}`,
                    data: {
                        url: `/?group=${groupId}`,
                        groupId: String(groupId),
                        group: { _id: String(groupId), name: group.name, image: group.image },
                    },
                }).catch((e) => console.error("Error sending REST Group Web Push notification:", e.message));
            }
        });

        if (validMentions.length > 0) {
            group.members.forEach(member => {
                const memberId = member.user || member;
                if (!validMentions.map(String).includes(memberId.toString())) return;
                const socketId = getReceiverSocketId(memberId.toString());
                if (socketId) {
                    io.to(socketId).emit("group:mentioned", {
                        groupId,
                        groupName: group.name,
                        message: payload,
                        mentionedBy: sender.fullName
                    });
                }
            });
        }

        res.status(201).json(payload);

        // Sender is active — deliver any pending messages addressed to them
        ackGroupMessagesDelivered({
            io,
            userSocketMap,
            groupId,
            userId: senderId,
        }).catch((e) => console.error("auto ack delivered (http):", e.message));
    } catch (error) {
        console.error("Error in sendGroupMessage:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Mark group messages as read
export const getGroupMessageInfo = async (req, res) => {
    try {
        const { groupId, messageId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: "Invalid message id" });
        }

        const group = await Group.findById(groupId).select("members");
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }
        if (
            !group.members.some(
                (m) => String(m.user?._id || m.user || m) === String(userId)
            )
        ) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        const message = await GroupMessage.findOne({ _id: messageId, groupId })
            .populate("senderId", "fullName profilePic")
            .populate("readBy", "fullName profilePic")
            .populate("deliveredTo.userId", "fullName profilePic")
            .populate("readReceipts.userId", "fullName profilePic");

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        const memberIds = group.members.map((m) => m.user?._id || m.user || m);
        const status = applyComputedStatus(message, memberIds);

        res.status(200).json({
            _id: message._id,
            groupId: message.groupId,
            senderId: message.senderId,
            text: message.text,
            image: message.image,
            video: message.video,
            audio: message.audio,
            createdAt: message.createdAt,
            status: message.status || status,
            deliveredTo: message.deliveredTo || [],
            readReceipts: message.readReceipts || [],
            readBy: message.readBy || [],
            isEdited: message.isEdited,
            deleted: message.deleted,
            deletedForEveryone: message.deletedForEveryone,
        });
    } catch (error) {
        console.error("Error in getGroupMessageInfo:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Mark group messages as read
export const markGroupMessagesAsRead = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        // Respect privacy: still mark delivered, but skip read receipts if disabled
        const skipReadReceipts = req.user.privacyReadReceipts === false;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.members.some(m => (m.user?._id || m.user || m).toString() === userId.toString())) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        const memberInfo = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const joinedAt = memberInfo?.joinedAt || new Date(0);
        const memberIds = group.members.map((m) => m.user?._id || m.user || m);

        // Always deliver pending messages while the chat is open
        await ackGroupMessagesDelivered({
            io,
            userSocketMap,
            groupId,
            userId,
        });

        if (skipReadReceipts) {
            return res.status(200).json({ success: true, skipped: true, delivered: true });
        }

        const unreadFilter = {
            groupId,
            senderId: { $ne: userId },
            readBy: { $ne: userId },
            createdAt: { $gte: joinedAt },
            messageType: { $ne: "system" },
        };

        const unreadMsgs = await GroupMessage.find(unreadFilter);
        if (unreadMsgs.length === 0) {
            return res.status(200).json({ success: true });
        }

        const reader = await User.findById(userId).select("fullName profilePic");
        const readAt = new Date();
        const statusUpdates = [];

        for (const message of unreadMsgs) {
            if (!message.readBy.some((id) => String(id) === String(userId))) {
                message.readBy.push(userId);
            }

            const hasReceipt = (message.readReceipts || []).some(
                (r) => String(r.userId) === String(userId)
            );
            if (!hasReceipt) {
                message.readReceipts = message.readReceipts || [];
                message.readReceipts.push({ userId, readAt });
            }

            const hasDelivered = (message.deliveredTo || []).some(
                (d) => String(d.userId) === String(userId)
            );
            if (!hasDelivered) {
                message.deliveredTo = message.deliveredTo || [];
                message.deliveredTo.push({ userId, deliveredAt: readAt });
            }

            const nextStatus = applyComputedStatus(message, memberIds);
            if (canUpgradeStatus(message.status, nextStatus) || !message.status) {
                message.status = nextStatus;
            }
            await message.save();
            statusUpdates.push({
                messageId: String(message._id),
                status: message.status,
            });
        }

        io.to(String(groupId)).emit("group:messagesRead", {
            groupId: String(groupId),
            messageIds: unreadMsgs.map((m) => String(m._id)),
            readBy: {
                _id: userId,
                fullName: reader?.fullName,
                profilePic: reader?.profilePic || "",
            },
            readAt,
            statusUpdates,
        });

        // Also notify each sender's user room for multi-device reliability
        for (const message of unreadMsgs) {
            const update = statusUpdates.find(
                (s) => s.messageId === String(message._id)
            );
            emitToUser(io, userSocketMap, message.senderId, "group:messagesRead", {
                groupId: String(groupId),
                messageIds: [String(message._id)],
                readBy: {
                    _id: userId,
                    fullName: reader?.fullName,
                    profilePic: reader?.profilePic || "",
                },
                readAt,
                statusUpdates: update ? [update] : [],
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error in markGroupMessagesAsRead:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete options for WhatsApp-style sheet
export const getGroupMessageDeleteOptions = async (req, res) => {
    try {
        const { groupId, messageId } = req.params;
        const userId = req.user._id;
        const message = await GroupMessage.findById(messageId);
        if (!message || message.groupId.toString() !== groupId) {
            return res.status(404).json({ error: "Message not found" });
        }
        return res.status(200).json(getDeleteOptions(message, userId));
    } catch (error) {
        console.error("getGroupMessageDeleteOptions:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Delete group message for everyone (sender only, within time window)
export const deleteGroupMessageForAll = async (req, res) => {
    try {
        const { groupId, messageId } = req.params;
        const userId = req.user._id;

        const message = await GroupMessage.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.groupId.toString() !== groupId) {
            return res.status(400).json({ error: "Message does not belong to this group" });
        }

        if (!message.senderId || message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Only the sender can delete this message for everyone" });
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

        const group = await Group.findById(groupId);
        const payload = {
            ...message.toObject(),
            canDeleteForEveryone: false,
        };

        if (
            group?.lastMessage?.createdAt &&
            message.createdAt &&
            new Date(group.lastMessage.createdAt).getTime() === new Date(message.createdAt).getTime()
        ) {
            group.lastMessage = {
                ...(group.lastMessage.toObject?.() ?? group.lastMessage),
                text: DELETED_TEXT_EVERYONE,
            };
            await group.save();
        }

        group.members.forEach((member) => {
            const memberId = member.user || member;
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:messageDeleted", {
                    groupId,
                    messageId,
                    deletedForAll: true,
                    updatedMessage: payload,
                });
            }
        });

        res.status(200).json({
            success: true,
            message: "Message deleted for everyone",
            updatedMessage: payload,
            canDeleteForEveryone: false,
        });
    } catch (error) {
        console.error("Error in deleteGroupMessageForAll:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete group message for me only
export const deleteGroupMessageForMe = async (req, res) => {
    try {
        const { groupId, messageId } = req.params;
        const userId = req.user._id;

        const message = await GroupMessage.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.groupId.toString() !== groupId) {
            return res.status(400).json({ error: "Message does not belong to this group" });
        }

        if (message.deletedForEveryone || message.deleted) {
            return res.status(400).json({ error: "Message already deleted" });
        }

        if (!message.deletedFor.some((id) => id.toString() === userId.toString())) {
            message.deletedFor.push(userId);
            await message.save();
        }

        const mySocketId = getReceiverSocketId(userId.toString());
        if (mySocketId) {
            io.to(mySocketId).emit("group:messageDeleted", {
                groupId,
                messageId,
                deletedForAll: false,
            });
        }

        res.status(200).json({ success: true, message: "Message deleted for you" });
    } catch (error) {
        console.error("Error in deleteGroupMessageForMe:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Update member role (admin only)
export const updateMemberRole = async (req, res) => {
    try {
        const { groupId, userId: targetUserId } = req.params;
        const { role } = req.body; // "admin" or "member"
        const userId = req.user._id;

        if (!["admin", "member"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        const isOwner = group.admin.toString() === userId.toString();
        const currentUserMember = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const isAdmin = isOwner || currentUserMember?.role === "admin";

        if (!isAdmin) {
            return res.status(403).json({ error: "Only admins can change roles" });
        }

        // Only owner can promote/demote other admins
        if (!isOwner && (role === "admin" || group.members.find(m => (m.user?._id || m.user || m).toString() === targetUserId)?.role === "admin")) {
            return res.status(403).json({ error: "Only group owner can promote/demote admins" });
        }

        if (targetUserId === group.admin.toString()) {
            return res.status(400).json({ error: "Cannot change role of group owner" });
        }

        const memberIndex = group.members.findIndex(m => (m.user?._id || m.user || m).toString() === targetUserId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: "Member not found in group" });
        }

        group.members[memberIndex].role = role;
        await group.save();

        const adminUser = await User.findById(userId);
        const targetUser = await User.findById(targetUserId);
        const actionText = role === "admin" ? "promoted to admin" : "dismissed as admin";
        await sendSystemMessage(groupId, `${adminUser.fullName} ${actionText} ${targetUser.fullName}`);

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic");

        // Notify all members
        updatedGroup.members.forEach(member => {
            const mId = member.user?._id || member.user || member;
            const socketId = getReceiverSocketId(mId.toString());
            if (socketId) {
                io.to(socketId).emit("group:updated", updatedGroup);
            }
        });

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in updateMemberRole:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
// Pin a message
export const pinMessage = async (req, res) => {
    try {
        const { groupId, messageId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        const isOwner = group.admin.toString() === userId.toString();
        const currentUserMember = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const isAdmin = isOwner || currentUserMember?.role === "admin";

        if (!isAdmin) return res.status(403).json({ error: "Only admins can pin messages" });

        const message = await GroupMessage.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });

        if (!group.pinnedMessages) {
            group.pinnedMessages = [];
        }
        group.pinnedMessages = group.pinnedMessages.filter(id => id.toString() !== messageId.toString());
        group.pinnedMessages.push(messageId);
        group.pinnedMessage = messageId;
        await group.save();

        const adminUser = await User.findById(userId);
        await sendSystemMessage(groupId, `${adminUser.fullName} pinned a message`);

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic")
            .populate({
                path: "pinnedMessage",
                populate: { path: "senderId", select: "fullName profilePic" }
            })
            .populate({
                path: "pinnedMessages",
                populate: { path: "senderId", select: "fullName profilePic" }
            });

        // Notify all members
        updatedGroup.members.forEach(member => {
            const mId = member.user?._id || member.user || member;
            const socketId = getReceiverSocketId(mId.toString());
            if (socketId) {
                io.to(socketId).emit("group:updated", updatedGroup);
            }
        });

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in pinMessage:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Unpin message
export const unpinMessage = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { messageId } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        const isOwner = group.admin.toString() === userId.toString();
        const currentUserMember = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const isAdmin = isOwner || currentUserMember?.role === "admin";

        if (!isAdmin) return res.status(403).json({ error: "Only admins can unpin messages" });

        if (messageId) {
            if (group.pinnedMessages) {
                group.pinnedMessages = group.pinnedMessages.filter(id => id.toString() !== messageId.toString());
            }
            if (group.pinnedMessage && group.pinnedMessage.toString() === messageId.toString()) {
                group.pinnedMessage = group.pinnedMessages && group.pinnedMessages.length > 0
                    ? group.pinnedMessages[group.pinnedMessages.length - 1]
                    : null;
            }
        } else {
            group.pinnedMessage = null;
            group.pinnedMessages = [];
        }
        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members.user", "fullName profilePic")
            .populate({
                path: "pinnedMessage",
                populate: { path: "senderId", select: "fullName profilePic" }
            })
            .populate({
                path: "pinnedMessages",
                populate: { path: "senderId", select: "fullName profilePic" }
            });

        // Notify all members
        updatedGroup.members.forEach(member => {
            const mId = member.user?._id || member.user || member;
            const socketId = getReceiverSocketId(mId.toString());
            if (socketId) {
                io.to(socketId).emit("group:updated", updatedGroup);
            }
        });

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in unpinMessage:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Vote on a poll in group message
export const voteGroupPoll = async (req, res) => {
    try {
        const { groupId, messageId } = req.params;
        const { optionIndex } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Check if user is a member
        const isMember = group.members.some(m => (m.user?._id || m.user || m).toString() === userId.toString());
        if (!isMember) return res.status(403).json({ error: "You are not a member of this group" });

        const message = await GroupMessage.findById(messageId);
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

        // Broadcast poll update to all group members
        group.members.forEach(member => {
            const memberId = member.user || member;
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:pollUpdated", {
                    groupId,
                    messageId,
                    poll: message.poll
                });
            }
        });

        res.status(200).json(message);
    } catch (error) {
        console.error("Error in voteGroupPoll:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
