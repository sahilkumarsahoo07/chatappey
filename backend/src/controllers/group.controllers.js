import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

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

            // Notify all group members via socket
            group.members.forEach(member => {
                const memberId = member.user || member;
                const socketId = getReceiverSocketId(memberId.toString());
                if (socketId) {
                    io.to(socketId).emit("group:newMessage", {
                        groupId,
                        message: newMessage
                    });
                }
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

        res.status(200).json(groupsWithUnread);
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

        // Only show messages created AFTER the user joined the group
        const messages = await GroupMessage.find({
            groupId,
            createdAt: { $gte: memberInfo.joinedAt }
        })
            .populate("senderId", "fullName profilePic")
            .populate("readBy", "fullName profilePic")
            .populate("mentions", "fullName profilePic")
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error in getGroupMessages:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Send message to group
export const sendGroupMessage = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { text, image, isForwarded, mentions, poll } = req.body;
        const senderId = req.user._id;

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

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const sender = await User.findById(senderId).select("fullName");

        // Validate mentions - ensure all mentioned users are group members
        let validMentions = [];
        if (mentions && Array.isArray(mentions)) {
            const memberIds = group.members.map(m => (m.user?._id || m.user || m).toString());
            validMentions = mentions.filter(id => memberIds.includes(id.toString()));
        }

        const newMessage = new GroupMessage({
            groupId,
            senderId,
            text,
            image: imageUrl,
            readBy: [senderId],
            isForwarded: isForwarded || false,
            mentions: validMentions,
            poll: poll || undefined
        });

        await newMessage.save();

        // Update group's lastMessage
        group.lastMessage = {
            text: text || (imageUrl ? "📷 Photo" : poll ? "📊 Poll" : ""),
            senderId,
            senderName: sender.fullName,
            createdAt: newMessage.createdAt
        };
        await group.save();

        // Populate sender info and mentions
        const populatedMessage = await GroupMessage.findById(newMessage._id)
            .populate("senderId", "fullName profilePic")
            .populate("mentions", "fullName profilePic");

        // Notify all group members via socket
        group.members.forEach(member => {
            const memberId = member.user || member;
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:newMessage", {
                    groupId,
                    message: populatedMessage
                });

                // Send special mention notification to mentioned users
                if (validMentions.includes(memberId.toString())) {
                    io.to(socketId).emit("group:mentioned", {
                        groupId,
                        groupName: group.name,
                        message: populatedMessage,
                        mentionedBy: sender.fullName
                    });
                }
            }
        });

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error("Error in sendGroupMessage:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Mark group messages as read
export const markGroupMessagesAsRead = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.members.some(m => (m.user?._id || m.user || m).toString() === userId.toString())) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        const memberInfo = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const joinedAt = memberInfo?.joinedAt || new Date(0);

        // Mark all unread messages as read by this user
        await GroupMessage.updateMany(
            {
                groupId,
                senderId: { $ne: userId },
                readBy: { $ne: userId },
                createdAt: { $gte: joinedAt }
            },
            {
                $addToSet: { readBy: userId }
            }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error in markGroupMessagesAsRead:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete group message for everyone (sender only)
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

        // Only the sender can delete for everyone
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Only the sender can delete this message for everyone" });
        }

        // Update message to show as deleted
        message.text = "This message was deleted";
        message.image = null;
        await message.save();

        const group = await Group.findById(groupId);

        // Notify all group members via socket
        group.members.forEach(member => {
            const memberId = member.user || member;
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:messageDeleted", {
                    groupId,
                    messageId,
                    deletedForAll: true
                });
            }
        });

        res.status(200).json({ success: true, message: "Message deleted for everyone" });
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

        // Add user to deletedFor array
        if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            await message.save();
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
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        const isOwner = group.admin.toString() === userId.toString();
        const currentUserMember = group.members.find(m => (m.user?._id || m.user || m).toString() === userId.toString());
        const isAdmin = isOwner || currentUserMember?.role === "admin";

        if (!isAdmin) return res.status(403).json({ error: "Only admins can unpin messages" });

        group.pinnedMessage = null;
        await group.save();

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
