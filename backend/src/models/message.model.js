import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
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
        text: {
            type: String,
        },
        image: {
            type: String, // Image URL
        },
        audio: {
            type: String, // Audio URL
        },
        file: {
            type: String, // File URL
        },
        fileName: {
            type: String, // Original filename with extension
        },
        deletedFor: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "User",
        },
        isForwarded: {
            type: Boolean,
            default: false
        },
        forwardedFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        forwardedFromMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        },
        status: {
            type: String,
            enum: ["sent", "delivered", "read", "scheduled"],
            default: "sent"
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null
        },
        replyToMessage: {
            text: String,
            image: String,
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            senderName: String
        },
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
)

const Message = mongoose.model("Message", messageSchema);
export default Message;