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
        video: {
            type: String,
        },
        videoThumbnail: {
            type: String,
        },
        videoDuration: {
            type: Number,
        },
        videoPublicId: {
            type: String,
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
        messageType: {
            type: String,
            enum: ["text", "image", "video", "audio", "file", "story_mention", "story_restory"],
            default: "text",
        },
        storyRef: {
            statusId: { type: mongoose.Schema.Types.ObjectId, ref: "Status" },
            mediaUrl: { type: String, default: "" },
            mediaType: { type: String, default: "image" },
            caption: { type: String, default: "" },
        },
        deletedFor: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "User",
        },
        deleted: {
            type: Boolean,
            default: false,
        },
        deletedForEveryone: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
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
        /** Client-generated id for optimistic UI ↔ server ACK matching */
        clientMessageId: {
            type: String,
            index: true,
        },
        sentAt: {
            type: Date,
        },
        deliveredAt: {
            type: Date,
        },
        readAt: {
            type: Date,
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
);

// Indexes to optimize last message lookup and unread counts
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, status: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;