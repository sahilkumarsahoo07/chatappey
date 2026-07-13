import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { _id: false }
);

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    messageType: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    text: { type: String },
    image: { type: String },
    video: { type: String },
    videoThumbnail: { type: String },
    videoDuration: { type: Number },
    videoPublicId: { type: String },
    audio: { type: String },
    file: { type: String },
    fileName: { type: String },
    /**
     * Legacy flat ObjectIds still work for unread queries.
     * Prefer deliveredTo / readReceipts for Message Info + timestamps.
     */
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deliveredTo: [receiptSchema],
    readReceipts: [receiptSchema],
    /** Aggregate sender tick: pending → sent → delivered → read */
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read"],
      default: "sent",
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deleted: { type: Boolean, default: false },
    deletedForEveryone: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isForwarded: { type: Boolean, default: false },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
    replyToMessage: {
      text: String,
      image: String,
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      senderName: String,
    },
    clientMessageId: { type: String, default: null },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: { type: String, required: true },
      },
    ],
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        },
      ],
    },
    scheduledFor: { type: Date },
  },
  { timestamps: true }
);

groupMessageSchema.index({ groupId: 1, createdAt: -1 });
groupMessageSchema.index({ groupId: 1, "deliveredTo.userId": 1 });
groupMessageSchema.index({ groupId: 1, "readReceipts.userId": 1 });
groupMessageSchema.index({ groupId: 1, status: 1, createdAt: -1 });
groupMessageSchema.index({ groupId: 1, clientMessageId: 1 }, { sparse: true });
groupMessageSchema.index({ clientMessageId: 1 }, { sparse: true });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;
