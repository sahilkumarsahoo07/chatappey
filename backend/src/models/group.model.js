import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50
        },
        description: {
            type: String,
            default: "",
            maxlength: 200
        },
        image: {
            type: String,
            default: ""
        },
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        lastMessage: {
            text: String,
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            senderName: String,
            createdAt: Date
        }
    },
    { timestamps: true }
);

const Group = mongoose.model("Group", groupSchema);
export default Group;
