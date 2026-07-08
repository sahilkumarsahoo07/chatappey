import mongoose from "mongoose";

const wallpaperSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["default", "solid", "gradient", "pattern", "image"],
      default: "default",
    },
    value: { type: String, default: "default" },
    blur: { type: Number, default: 0, min: 0, max: 20 },
    brightness: { type: Number, default: 100, min: 40, max: 140 },
  },
  { _id: false }
);

const chatPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chatType: {
      type: String,
      enum: ["dm", "group"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    isArchived: { type: Boolean, default: false },
    mutedUntil: { type: Date, default: null },
    wallpaper: { type: wallpaperSchema, default: () => ({}) },
  },
  { timestamps: true }
);

chatPreferenceSchema.index({ userId: 1, chatType: 1, targetId: 1 }, { unique: true });
chatPreferenceSchema.index({ userId: 1, isArchived: 1 });

const ChatPreference = mongoose.model("ChatPreference", chatPreferenceSchema);
export default ChatPreference;
