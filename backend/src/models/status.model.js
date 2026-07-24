import mongoose from "mongoose";

const viewerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    likedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      enum: ["❤️", "😂", "🔥", "😍", "👍", "👏", "😢", "😮"],
    },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const mentionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, default: "" },
    displayName: { type: String, default: "" },
    x: { type: Number, default: 0.5 },
    y: { type: Number, default: 0.5 },
    scale: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    style: { type: String, default: "default" },
  },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "music", "text", "restory"],
      required: true,
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    publicId: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 5,
      max: 60,
    },
    caption: {
      type: String,
      default: "",
      maxlength: 500,
    },
    /** Optional Instagram-style story soundtrack */
    music: {
      id: { type: String, default: "" },
      title: { type: String, default: "" },
      artist: { type: String, default: "" },
      thumbnail: { type: String, default: "" },
      artwork: { type: String, default: "" },
      audioUrl: { type: String, default: "" },
      duration: { type: Number, default: 0 },
      quality: { type: String, default: "" },
      sourceUrl: { type: String, default: "" },
      /** Clip selection (seconds) */
      startOffset: { type: Number, default: 0 },
      clipStart: { type: Number, default: 0 },
      clipDuration: { type: Number, default: 15 },
      backgroundTheme: { type: String, default: "purple" },
      stickerStyle: { type: String, default: "classic" },
      layoutStyle: { type: String, default: "style1" },
      /** Sticker layout */
      sticker: {
        x: { type: Number, default: 0.5 },
        y: { type: Number, default: 0.72 },
        scale: { type: Number, default: 1 },
        rotation: { type: Number, default: 0 },
        theme: {
          type: String,
          default: "classic",
        },
      },
    },
    viewers: {
      type: [viewerSchema],
      default: [],
    },
    likes: {
      type: [likeSchema],
      default: [],
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    mentions: {
      type: [mentionSchema],
      default: [],
    },
    restory: {
      originalStatusId: { type: mongoose.Schema.Types.ObjectId, ref: "Status" },
      originalUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      originalUsername: { type: String, default: "" },
      originalDisplayName: { type: String, default: "" },
      originalMediaUrl: { type: String, default: "" },
      originalMediaType: { type: String, default: "image" },
      originalThumbnailUrl: { type: String, default: "" },
    },
    privacy: {
      type: String,
      enum: ["everyone", "contacts", "contacts_except", "only_share_with"],
      default: "contacts",
    },
    excludedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    includedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

statusSchema.index({ expiresAt: 1, createdAt: -1 });
statusSchema.index({ userId: 1, expiresAt: 1, createdAt: -1 });
statusSchema.index({ "viewers.userId": 1 });

const Status = mongoose.model("Status", statusSchema);
export default Status;

export const STATUS_REACTION_EMOJIS = ["❤️", "😂", "🔥", "😍", "👍", "👏", "😢", "😮"];
