import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false // Optional for system messages
        },
        messageType: {
            type: String,
            enum: ["text", "system"],
            default: "text"
        },
        text: {
            type: String
        },
        image: {
            type: String
        },
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        deletedFor: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        isForwarded: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Index for efficient querying
groupMessageSchema.index({ groupId: 1, createdAt: -1 });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;
