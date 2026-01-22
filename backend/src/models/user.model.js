import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },
        fullName: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: false,
            minlength: 6,
        },
        profilePic: {
            type: String,
            default: "",
        },
        about: {
            type: String,
            default: ""
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        isBanned: {
            type: Boolean,
            default: false,
        },
        blockedUntil: {
            type: Date,
            default: null,
        },
        lastLogout: { type: Date },
        blockedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: []
            }
        ],
        friends: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: []
            }
        ],
        tokenVersion: {
            type: Number,
            default: 0,
        },
        privacyReadReceipts: {
            type: Boolean,
            default: true,
        },
        privacyLastSeen: {
            type: String,
            enum: ["everyone", "contacts", "none"],
            default: "everyone",
        },
        privacyProfilePic: {
            type: String,
            enum: ["everyone", "contacts", "none"],
            default: "everyone",
        },
        privacyAbout: {
            type: String,
            enum: ["everyone", "contacts", "none"],
            default: "everyone",
        },
        chatBackground: {
            type: String,
            default: "default", // Can be "default", color hex, or URL
        },
        fontSize: {
            type: String,
            enum: ["small", "standard", "large"],
            default: "standard",
        },
        bubbleStyle: {
            type: String,
            enum: ["sharp", "classic", "rounded", "smooth", "ultra", "pill"],
            default: "rounded",
        },
        isIncognito: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true
    }
);
const User = mongoose.model("User", userSchema);
export default User;