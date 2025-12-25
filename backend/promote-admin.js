import mongoose from 'mongoose';
import User from './src/models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();

const promoteToAdmin = async (email) => {
    try {
        const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
        if (!mongoUrl) {
            console.error("No MongoDB URL found");
            process.exit(1);
        }
        await mongoose.connect(mongoUrl);
        const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
        if (user) {
            console.log(`User ${email} promoted to admin successfully.`);
        } else {
            console.log(`User ${email} not found.`);
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

// Promote the first user if no email is provided, or specific if known.
promoteToAdmin('sahilkumarsahoo07@gmail.com'); 
