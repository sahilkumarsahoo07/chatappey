import Call from "../models/call.model.js";
import User from "../models/user.model.js";

// Save a new call record or update an existing one
export const saveCall = async (req, res) => {
    try {
        const { caller, receiver, callType, status, duration, startTime, endTime, roomID } = req.body;

        // Check if a call with this roomID already exists
        let call = await Call.findOne({ roomID });

        if (call) {
            // Update existing call
            call.status = status || call.status;
            call.duration = duration !== undefined ? duration : call.duration;
            call.startTime = startTime || call.startTime;
            call.endTime = endTime || call.endTime;
            await call.save();
        } else {
            // Create new call record
            call = await Call.create({
                caller,
                receiver,
                callType,
                status,
                duration: duration || 0,
                startTime,
                endTime,
                roomID,
            });
        }

        res.status(200).json(call);
    } catch (error) {
        console.error("Error in saveCall controller:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get call history for the authenticated user
export const getCallHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { filter = "all", page = 1, limit = 50 } = req.query;

        let query = {
            $or: [
                { caller: userId },
                { receiver: userId }
            ]
        };

        // Apply filter
        if (filter === "incoming") {
            query.receiver = userId;
        } else if (filter === "outgoing") {
            query.caller = userId;
        } else if (filter === "missed") {
            query.receiver = userId;
            query.status = { $in: ["missed", "unanswered", "rejected"] };
        }

        const skip = (page - 1) * limit;

        const calls = await Call.find(query)
            .populate("caller", "fullName profilePic")
            .populate("receiver", "fullName profilePic")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCalls = await Call.countDocuments(query);

        res.status(200).json({
            calls,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCalls / limit),
            totalCalls,
        });
    } catch (error) {
        console.error("Error in getCallHistory controller:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
