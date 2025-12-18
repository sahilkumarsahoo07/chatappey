import FriendRequest from "../models/friendRequest.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Send a friend request
export const sendFriendRequest = async (req, res) => {
    try {
        const { id: receiverId } = req.params;
        const { message } = req.body;
        const senderId = req.user._id;

        // Check if trying to send request to self
        if (senderId.toString() === receiverId) {
            return res.status(400).json({ error: "Cannot send friend request to yourself" });
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if already friends
        const sender = await User.findById(senderId).select("friends");
        const isFriend = sender.friends.some(friendId => friendId.toString() === receiverId);
        if (isFriend) {
            return res.status(400).json({ error: "Already friends with this user" });
        }

        // Check if there's already a pending request
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { senderId, receiverId, status: "pending" },
                { senderId: receiverId, receiverId: senderId, status: "pending" }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({ error: "Friend request already pending" });
        }

        // Create new friend request
        const friendRequest = new FriendRequest({
            senderId,
            receiverId,
            requestMessage: message || "",
        });

        await friendRequest.save();

        // Create notification for receiver
        const notification = new Notification({
            userId: receiverId,
            type: message ? "request_message" : "friend_request",
            fromUserId: senderId,
            friendRequestId: friendRequest._id,
            message: message || "",
        });

        await notification.save();

        // Populate sender info for notification
        await notification.populate("fromUserId", "fullName profilePic email");

        // Send real-time notification via socket
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("friendRequestSent", {
                notification,
                friendRequest,
            });
        }

        res.status(201).json({
            message: "Friend request sent successfully",
            friendRequest,
        });
    } catch (error) {
        console.error("Error in sendFriendRequest:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Accept a friend request
export const acceptFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;

        // Find the friend request
        const friendRequest = await FriendRequest.findById(requestId);
        if (!friendRequest) {
            return res.status(404).json({ error: "Friend request not found" });
        }

        // Verify that the current user is the receiver
        if (friendRequest.receiverId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized to accept this request" });
        }

        // Check if already accepted
        if (friendRequest.status === "accepted") {
            return res.status(400).json({ error: "Friend request already accepted" });
        }

        // Update friend request status
        friendRequest.status = "accepted";
        await friendRequest.save();

        // Add both users to each other's friends list
        await User.findByIdAndUpdate(friendRequest.senderId, {
            $addToSet: { friends: friendRequest.receiverId }
        });
        await User.findByIdAndUpdate(friendRequest.receiverId, {
            $addToSet: { friends: friendRequest.senderId }
        });

        // Create notification for sender
        const notification = new Notification({
            userId: friendRequest.senderId,
            type: "request_accepted",
            fromUserId: userId,
            friendRequestId: friendRequest._id,
        });

        await notification.save();
        await notification.populate("fromUserId", "fullName profilePic email");

        // Send real-time notification to sender
        const senderSocketId = getReceiverSocketId(friendRequest.senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("friendRequestAccepted", {
                notification,
                friendRequest,
            });
        }

        res.status(200).json({
            message: "Friend request accepted",
            friendRequest,
        });
    } catch (error) {
        console.error("Error in acceptFriendRequest:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Reject a friend request
export const rejectFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;

        // Find the friend request
        const friendRequest = await FriendRequest.findById(requestId);
        if (!friendRequest) {
            return res.status(404).json({ error: "Friend request not found" });
        }

        // Verify that the current user is the receiver
        if (friendRequest.receiverId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized to reject this request" });
        }

        // Update friend request status
        friendRequest.status = "rejected";
        await friendRequest.save();

        // Create notification for sender (optional)
        const notification = new Notification({
            userId: friendRequest.senderId,
            type: "request_rejected",
            fromUserId: userId,
            friendRequestId: friendRequest._id,
        });

        await notification.save();
        await notification.populate("fromUserId", "fullName profilePic email");

        // Send real-time notification to sender
        const senderSocketId = getReceiverSocketId(friendRequest.senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("friendRequestRejected", {
                notification,
                friendRequest,
            });
        }

        res.status(200).json({
            message: "Friend request rejected",
            friendRequest,
        });
    } catch (error) {
        console.error("Error in rejectFriendRequest:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get all friend requests received by the user
export const getFriendRequests = async (req, res) => {
    try {
        const userId = req.user._id;

        const friendRequests = await FriendRequest.find({
            receiverId: userId,
            status: "pending",
        })
            .populate("senderId", "fullName profilePic email about")
            .sort({ createdAt: -1 });

        res.status(200).json(friendRequests);
    } catch (error) {
        console.error("Error in getFriendRequests:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get all friend requests sent by the user
export const getSentRequests = async (req, res) => {
    try {
        const userId = req.user._id;

        const sentRequests = await FriendRequest.find({
            senderId: userId,
        })
            .populate("receiverId", "fullName profilePic email about")
            .sort({ createdAt: -1 });

        res.status(200).json(sentRequests);
    } catch (error) {
        console.error("Error in getSentRequests:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Send a request message (after rejection or new request)
export const sendRequestMessage = async (req, res) => {
    try {
        const { id: receiverId } = req.params;
        const { message } = req.body;
        const senderId = req.user._id;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Message is required" });
        }

        // Check if trying to send request to self
        if (senderId.toString() === receiverId) {
            return res.status(400).json({ error: "Cannot send friend request to yourself" });
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if already friends
        const sender = await User.findById(senderId).select("friends");
        const isFriend = sender.friends.some(friendId => friendId.toString() === receiverId);
        if (isFriend) {
            return res.status(400).json({ error: "Already friends with this user" });
        }

        // Check for existing pending request
        const existingPendingRequest = await FriendRequest.findOne({
            senderId,
            receiverId,
            status: "pending"
        });

        if (existingPendingRequest) {
            return res.status(400).json({ error: "You already have a pending request to this user" });
        }

        // Create new friend request with message
        const friendRequest = new FriendRequest({
            senderId,
            receiverId,
            requestMessage: message,
        });

        await friendRequest.save();

        // Create notification for receiver
        const notification = new Notification({
            userId: receiverId,
            type: "request_message",
            fromUserId: senderId,
            friendRequestId: friendRequest._id,
            message: message,
        });

        await notification.save();
        await notification.populate("fromUserId", "fullName profilePic email");

        // Send real-time notification via socket
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newRequestMessage", {
                notification,
                friendRequest,
            });
        }

        res.status(201).json({
            message: "Request message sent successfully",
            friendRequest,
        });
    } catch (error) {
        console.error("Error in sendRequestMessage:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
