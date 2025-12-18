import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
    {
        caller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        callType: {
            type: String,
            enum: ["audio", "video"],
            required: true,
        },
        status: {
            type: String,
            enum: ["missed", "completed", "rejected", "unanswered"],
            default: "unanswered",
        },
        duration: {
            type: Number,
            default: 0, // in seconds
        },
        startTime: {
            type: Date,
            default: null,
        },
        endTime: {
            type: Date,
            default: null,
        },
        roomID: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

const Call = mongoose.model("Call", callSchema);
export default Call;
