import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import bcrypt from "bcryptjs";

// Helper to extract Cloudinary Public ID from URL
const getPublicId = (url) => {
    if (!url) return null;
    const parts = url.split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart.split(".")[0];
};

export const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalMessages = await Message.countDocuments();
        const verifiedUsers = await User.countDocuments({ isVerified: true });
        const bannedUsers = await User.countDocuments({ isBanned: true });

        res.status(200).json({
            totalUsers,
            totalMessages,
            verifiedUsers,
            bannedUsers,
        });
    } catch (error) {
        console.error("Error in getAdminStats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        console.error("Error in getAllUsers:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllMessages = async (req, res) => {
    try {
        const messages = await Message.find({})
            .populate("senderId", "fullName email profilePic")
            .populate("receiverId", "fullName email profilePic")
            .sort({ createdAt: -1 });
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error in getAllMessages:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateUserStatus = async (req, res) => {
    const { userId } = req.params;
    const { isBanned, blockedUntil } = req.body;

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { isBanned, blockedUntil },
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ message: "User status updated successfully", user });
    } catch (error) {
        console.error("Error in updateUserStatus:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const adminUpdatePassword = async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const user = await User.findByIdAndUpdate(
            userId,
            {
                password: hashedPassword,
            },
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Error in adminUpdatePassword:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 1. Delete Profile Pic from Cloudinary
        if (user.profilePic) {
            const publicId = getPublicId(user.profilePic);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        }

        // 2. Find all messages sent or received by this user
        const messages = await Message.find({
            $or: [{ senderId: userId }, { receiverId: userId }]
        });

        // 3. Delete Message Images from Cloudinary
        for (const msg of messages) {
            if (msg.image) {
                const publicId = getPublicId(msg.image);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }
        }

        // 4. Delete Messages from DB
        await Message.deleteMany({
            $or: [{ senderId: userId }, { receiverId: userId }]
        });

        // 5. Delete User from DB
        await User.findByIdAndDelete(userId);

        res.status(200).json({ message: "User and all associated data deleted successfully" });
    } catch (error) {
        console.error("Error in deleteUser:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const nuclearDelete = async (req, res) => {
    try {
        // This is a VERY dangerous operation.
        // In a real app, you'd want even more verification here.

        // 1. Clear Cloudinary (Best effort - this might hit rate limits if huge)
        // We'll delete images for messages and users
        const allUsers = await User.find({});
        for (const user of allUsers) {
            if (user.profilePic) {
                const publicId = getPublicId(user.profilePic);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }
        }

        const allMessages = await Message.find({});
        for (const msg of allMessages) {
            if (msg.image) {
                const publicId = getPublicId(msg.image);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }
        }

        // 2. Wipe DB Collections
        await Message.deleteMany({});
        // Note: We don't delete ALL users, otherwise the admin itself is deleted!
        // We delete all users EXCEPT the current admin
        await User.deleteMany({ _id: { $ne: req.user._id } });

        res.status(200).json({ message: "Nuclear wipe complete. All users (except you) and messages deleted." });
    } catch (error) {
        console.error("Error in nuclearDelete:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const promoteUser = async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await User.findByIdAndUpdate(userId, { role: "admin" }, { new: true });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json({ message: `User ${user.fullName} promoted to Admin successfully`, user });
    } catch (error) {
        console.error("Error in promoteUser:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const selectiveDelete = async (req, res) => {
    const { userId } = req.params;
    const { deleteMessages, deleteImages, deleteAccount } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 1. Handle Images deletion from Cloudinary
        if (deleteImages) {
            // User profile pic
            if (user.profilePic) {
                const publicId = getPublicId(user.profilePic);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }
            // All message images sent or received by this user
            const messagesWithImages = await Message.find({
                $or: [{ senderId: userId }, { receiverId: userId }],
                image: { $exists: true, $ne: null }
            });
            for (const msg of messagesWithImages) {
                const publicId = getPublicId(msg.image);
                if (publicId) await cloudinary.uploader.destroy(publicId);
            }
        }

        // 2. Handle Messages deletion from DB
        if (deleteMessages || deleteAccount) {
            await Message.deleteMany({
                $or: [{ senderId: userId }, { receiverId: userId }]
            });
        }

        // 3. Handle Account deletion from DB
        if (deleteAccount) {
            await User.findByIdAndDelete(userId);
        }

        res.status(200).json({ message: "Selective deletion completed successfully" });
    } catch (error) {
        console.error("Error in selectiveDelete:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteSingleMessage = async (req, res) => {
    const { messageId } = req.params;
    try {
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: "Message not found" });

        // Delete from Cloudinary if it has an image
        if (message.image) {
            const publicId = getPublicId(message.image);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        }

        await Message.findByIdAndDelete(messageId);
        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.error("Error in deleteSingleMessage:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
