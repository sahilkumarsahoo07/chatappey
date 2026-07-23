import mongoose from "mongoose";

const groupVibeViewSchema = new mongoose.Schema(
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
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Scalable unique view per user per vibe
groupVibeViewSchema.index({ vibeId: 1, userId: 1 }, { unique: true });
groupVibeViewSchema.index({ groupId: 1, vibeId: 1 });

const GroupVibeView = mongoose.model("GroupVibeView", groupVibeViewSchema);
export default GroupVibeView;
