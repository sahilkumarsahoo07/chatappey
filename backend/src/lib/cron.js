import cron from "node-cron";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "./socket.js";

const setupCronJobs = () => {
    // Check for scheduled messages every minute
    cron.schedule("* * * * *", async () => {
        // console.log("Cron Job Tick: Checking for scheduled messages..."); 
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
                    message.scheduledFor = undefined; // Clear schedule date
                    await message.save();

                    // Get socket IDs
                    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
                    const senderSocketId = getReceiverSocketId(message.senderId.toString());

                    // Emit to receiver if online
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit("newMessage", message);

                        // Update status to delivered since receiver is online
                        message.status = "delivered";
                        await message.save();
                    }

                    // ALWAYS emit full message update to sender to clear scheduledFor from UI
                    if (senderSocketId) {
                        io.to(senderSocketId).emit("messageUpdated", message);
                    }
                }
            }
        } catch (error) {
            console.error("Error processing scheduled messages:", error);
        }
    });
};

export default setupCronJobs;
