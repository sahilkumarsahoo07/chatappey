import mongoose from "mongoose";

const groupVibeReactionSchema = new mongoose.Schema(
  {
    vibeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupVibe",
      required: true,
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reaction: {
      type: String,
      required: true,
      enum: ["❤️", "😂", "🔥", "😍", "😮", "😢", "👏"],
    },
  },
  { timestamps: true }
);

// Prevent duplicate reaction records per user per vibe
groupVibeReactionSchema.index({ vibeId: 1, userId: 1 }, { unique: true });
groupVibeReactionSchema.index({ vibeId: 1 });

const GroupVibeReaction = mongoose.model("GroupVibeReaction", groupVibeReactionSchema);
export default GroupVibeReaction;
