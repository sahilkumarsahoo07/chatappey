import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
        requestMessage: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
friendRequestSchema.index({ senderId: 1, receiverId: 1 });
friendRequestSchema.index({ receiverId: 1, status: 1 });

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);
export default FriendRequest;
