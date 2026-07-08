import cron from "node-cron";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "./socket.js";
import { cleanupExpiredStatuses } from "../controllers/status.controllers.js";
import { clearExpiredMutes } from "../utils/chatPreference.utils.js";

const setupCronJobs = () => {
    // Check for scheduled messages every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();
            const scheduledMessages = await Message.find({
                status: "scheduled",
                scheduledFor: { $lte: now }
            });

            if (scheduledMessages.length > 0) {
                console.log(`Processing ${scheduledMessages.length} scheduled messages`);

                for (const message of scheduledMessages) {
                    message.status = "sent";
                    message.scheduledFor = undefined;
                    await message.save();

                    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
                    const senderSocketId = getReceiverSocketId(message.senderId.toString());

                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit("newMessage", message);
                        message.status = "delivered";
                        await message.save();
                    }

                    if (senderSocketId) {
                        io.to(senderSocketId).emit("messageUpdated", message);
                    }
                }
            }
        } catch (error) {
            console.error("Error processing scheduled messages:", error);
        }
    });

    // Purge expired WhatsApp-style statuses every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
        try {
            const removed = await cleanupExpiredStatuses();
            if (removed > 0) {
                console.log(`Cleaned up ${removed} expired statuses`);
            }
        } catch (error) {
            console.error("Error cleaning expired statuses:", error);
        }
    });
    // Clear expired chat mutes every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
        try {
            const cleared = await clearExpiredMutes();
            if (cleared > 0) {
                console.log(`Cleared ${cleared} expired chat mutes`);
            }
        } catch (error) {
            console.error("Error clearing expired mutes:", error);
        }
    });
};

export default setupCronJobs;
