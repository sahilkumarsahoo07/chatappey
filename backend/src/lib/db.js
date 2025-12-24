import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
        if (!mongoUrl) {
            throw new Error("MongoDB connection string is missing! Check MONGODB_URL or MONGODB_URI in your environment variables.");
        }
        const conn = await mongoose.connect(mongoUrl);
        console.log(`MongoDB connected: ${conn.connection.host}`)
    } catch (error) {
        console.log("MongoDB connected error:", error)
    }
}