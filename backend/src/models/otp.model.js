import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    fullName: {
        type: String, // Only used during signup
    },
    password: {
        type: String, // Only used during signup
    },
    type: {
        type: String,
        enum: ["signup", "reset"],
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: 300 } // Automatically delete after 5 minutes (300 seconds)
    }
});

const Otp = mongoose.model("Otp", otpSchema);

export default Otp;
