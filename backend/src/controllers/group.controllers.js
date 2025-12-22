import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

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

        // Include admin in members list
        const allMembers = [...new Set([adminId.toString(), ...members])];

        const newGroup = new Group({
            name: name.trim(),
            description: description?.trim() || "",
            image: imageUrl,
            admin: adminId,
            members: allMembers
        });

        await newGroup.save();

        // Populate member details for response
        const populatedGroup = await Group.findById(newGroup._id)
            .populate("admin", "fullName profilePic")
            .populate("members", "fullName profilePic");

        // Notify all members via socket
        allMembers.forEach(memberId => {
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

        const groups = await Group.find({ members: userId })
            .populate("admin", "fullName profilePic")
            .populate("members", "fullName profilePic")
            .sort({ updatedAt: -1 });

        // Get unread count for each group
        const groupsWithUnread = await Promise.all(
            groups.map(async (group) => {
                const unreadCount = await GroupMessage.countDocuments({
                    groupId: group._id,
                    senderId: { $ne: userId },
                    readBy: { $ne: userId }
                });

                return {
                    ...group.toObject(),
                    unreadCount
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
            .populate("members", "fullName profilePic email");

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        // Check if user is a member
        if (!group.members.some(member => member._id.toString() === userId.toString())) {
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

        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Only admin can update group" });
        }

        let imageUrl = group.image;
        if (image && image !== group.image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        group.name = name?.trim() || group.name;
        group.description = description?.trim() ?? group.description;
        group.image = imageUrl;

        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members", "fullName profilePic");

        // Notify all members
        group.members.forEach(memberId => {
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:updated", updatedGroup);
            }
        });

        res.status(200).json(updatedGroup);
    } catch (error) {
        console.error("Error in updateGroup:", error.message);
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

        const memberIds = group.members.map(m => m.toString());

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

        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Only admin can add members" });
        }

        if (!memberIds || memberIds.length === 0) {
            return res.status(400).json({ error: "No members specified" });
        }

        // Add new members (avoid duplicates)
        const existingMembers = group.members.map(m => m.toString());
        const newMembers = memberIds.filter(id => !existingMembers.includes(id));

        if (newMembers.length === 0) {
            return res.status(400).json({ error: "All specified users are already members" });
        }

        group.members.push(...newMembers);
        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members", "fullName profilePic");

        // Notify all members (including new ones)
        updatedGroup.members.forEach(member => {
            const socketId = getReceiverSocketId(member._id.toString());
            if (socketId) {
                io.to(socketId).emit("group:memberAdded", {
                    group: updatedGroup,
                    newMembers: newMembers
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

        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Only admin can remove members" });
        }

        if (memberToRemove === group.admin.toString()) {
            return res.status(400).json({ error: "Admin cannot be removed" });
        }

        group.members = group.members.filter(m => m.toString() !== memberToRemove);
        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members", "fullName profilePic");

        // Notify remaining members
        updatedGroup.members.forEach(member => {
            const socketId = getReceiverSocketId(member._id.toString());
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

        group.members = group.members.filter(m => m.toString() !== userId.toString());
        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate("admin", "fullName profilePic")
            .populate("members", "fullName profilePic");

        // Notify remaining members
        updatedGroup.members.forEach(member => {
            const socketId = getReceiverSocketId(member._id.toString());
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

        if (!group.members.some(m => m.toString() === userId.toString())) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        const messages = await GroupMessage.find({ groupId })
            .populate("senderId", "fullName profilePic")
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
        const { text, image, isForwarded } = req.body;
        const senderId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.members.some(m => m.toString() === senderId.toString())) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const sender = await User.findById(senderId).select("fullName");

        const newMessage = new GroupMessage({
            groupId,
            senderId,
            text,
            image: imageUrl,
            readBy: [senderId],
            isForwarded: isForwarded || false
        });

        await newMessage.save();

        // Update group's lastMessage
        group.lastMessage = {
            text: text || (imageUrl ? "📷 Photo" : ""),
            senderId,
            senderName: sender.fullName,
            createdAt: newMessage.createdAt
        };
        await group.save();

        // Populate sender info
        const populatedMessage = await GroupMessage.findById(newMessage._id)
            .populate("senderId", "fullName profilePic");

        // Notify all group members via socket
        group.members.forEach(memberId => {
            const socketId = getReceiverSocketId(memberId.toString());
            if (socketId) {
                io.to(socketId).emit("group:newMessage", {
                    groupId,
                    message: populatedMessage
                });
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

        if (!group.members.some(m => m.toString() === userId.toString())) {
            return res.status(403).json({ error: "You are not a member of this group" });
        }

        // Mark all unread messages as read by this user
        await GroupMessage.updateMany(
            {
                groupId,
                senderId: { $ne: userId },
                readBy: { $ne: userId }
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
        group.members.forEach(memberId => {
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

