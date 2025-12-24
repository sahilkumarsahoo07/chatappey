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
        audio: {
            type: String // Audio URL
        },
        file: {
            type: String // File URL
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
        },
        mentions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        // NEW FEATURES
        reactions: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                emoji: {
                    type: String,
                    required: true
                }
            }
        ],
        isEdited: {
            type: Boolean,
            default: false
        },
        isPinned: {
            type: Boolean,
            default: false
        },
        poll: {
            question: String,
            options: [
                {
                    text: String,
                    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
                }
            ]
        },
        scheduledFor: {
            type: Date
        }
    },
    { timestamps: true }
);

// Index for efficient querying
groupMessageSchema.index({ groupId: 1, createdAt: -1 });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;
