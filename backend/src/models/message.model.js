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
            type: String,
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
            enum: ["sent", "delivered", "read"],
            default: "sent"
        },
    },
    { timestamps: true }
)

const Message = mongoose.model("Message", messageSchema);
export default Message;