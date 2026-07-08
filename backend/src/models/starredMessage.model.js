import mongoose from "mongoose";

const starredMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
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
    starredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

starredMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });
starredMessageSchema.index({ userId: 1, starredAt: -1 });

const StarredMessage = mongoose.model("StarredMessage", starredMessageSchema);
export default StarredMessage;
