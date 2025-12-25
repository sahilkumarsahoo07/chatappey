import mongoose from 'mongoose';
import User from './src/models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();

const promoteFirstUser = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
        if (!mongoUrl) {
            console.error("No MongoDB URL found");
            process.exit(1);
        }
        await mongoose.connect(mongoUrl);
        const firstUser = await User.findOne({});
        if (firstUser) {
            firstUser.role = 'admin';
            await firstUser.save();
            console.log(`User ${firstUser.email} (ID: ${firstUser._id}) promoted to admin successfully.`);
        } else {
            console.log("No users found in database.");
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

promoteFirstUser();
