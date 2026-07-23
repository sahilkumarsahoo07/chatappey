import mongoose from "mongoose";

const groupVibeSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["photo", "video", "text"],
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
    text: {
      type: String,
      default: "",
      maxlength: 500,
    },
    duration: {
      type: Number,
      default: 5,
    },
    /** Optional Music metadata */
    music: {
      songId: { type: String, default: "" },
      title: { type: String, default: "" },
      artist: { type: String, default: "" },
      artwork: { type: String, default: "" },
      audioUrl: { type: String, default: "" },
      sourceUrl: { type: String, default: "" },
      clipStart: { type: Number, default: 0 },
      clipDuration: { type: Number, default: 15 },
      originalAudioVolume: { type: Number, default: 100 },
      musicVolume: { type: Number, default: 100 },
      sticker: {
        x: { type: Number, default: 0.5 },
        y: { type: Number, default: 0.72 },
        scale: { type: Number, default: 1 },
        rotation: { type: Number, default: 0 },
        theme: {
          type: String,
          enum: ["classic", "dark", "neon", "minimal"],
          default: "classic",
        },
      },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

groupVibeSchema.index({ groupId: 1, expiresAt: 1, createdAt: -1 });
groupVibeSchema.index({ creatorId: 1, createdAt: -1 });

const GroupVibe = mongoose.model("GroupVibe", groupVibeSchema);
export default GroupVibe;
