import Message from "../models/message.model.js";
import Call from "../models/call.model.js";
import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

/**
 * GET /api/insights/relationship/:userId
 * Score interaction strength with a friend.
 */
export const getRelationshipScore = async (req, res) => {
  try {
    const myId = req.user._id;
    const otherId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const myOid = new mongoose.Types.ObjectId(myId);
    const otherOid = new mongoose.Types.ObjectId(otherId);

    const dmMatch = {
      $or: [
        { senderId: myOid, receiverId: otherOid },
        { senderId: otherOid, receiverId: myOid },
      ],
      deletedFor: { $nin: [myOid] },
    };

    let calls = 0;
    let videoCalls = 0;
    try {
      calls = await Call.countDocuments({
        $or: [
          { caller: myOid, receiver: otherOid },
          { caller: otherOid, receiver: myOid },
        ],
      });
      videoCalls = await Call.countDocuments({
        $or: [
          { caller: myOid, receiver: otherOid },
          { caller: otherOid, receiver: myOid },
        ],
        callType: "video",
      });
    } catch {
      calls = 0;
      videoCalls = 0;
    }

    const [
      totalMessages,
      voiceNotes,
      sharedMedia,
      reactionsGiven,
      replies,
      activeDaysAgg,
      otherUser,
      storyViews,
      storyLikes,
    ] = await Promise.all([
      Message.countDocuments(dmMatch),
      Message.countDocuments({ ...dmMatch, audio: { $exists: true, $ne: "" } }),
      Message.countDocuments({
        ...dmMatch,
        $or: [
          { image: { $exists: true, $ne: "" } },
          { video: { $exists: true, $ne: "" } },
          { file: { $exists: true, $ne: "" } },
        ],
      }),
      Message.countDocuments({
        ...dmMatch,
        "reactions.userId": myOid,
      }),
      Message.countDocuments({
        ...dmMatch,
        replyTo: { $ne: null },
      }),
      Message.aggregate([
        { $match: dmMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
          },
        },
        { $count: "days" },
      ]),
      User.findById(otherId).select("fullName profilePic"),
      Status.countDocuments({
        userId: otherOid,
        "viewers.userId": myOid,
      }),
      Status.countDocuments({
        userId: otherOid,
        "likes.userId": myOid,
      }),
    ]);

    const activeDays = activeDaysAgg[0]?.days || 0;

    const raw =
      totalMessages * 1 +
      voiceNotes * 3 +
      sharedMedia * 2 +
      reactionsGiven * 2 +
      replies * 2 +
      calls * 8 +
      videoCalls * 4 +
      activeDays * 4 +
      storyViews * 2 +
      storyLikes * 5;

    const score = Math.min(100, Math.round(Math.log10(raw + 1) * 40));

    return res.status(200).json({
      user: otherUser,
      score,
      stats: {
        totalMessages,
        voiceNotes,
        sharedMedia,
        reactions: reactionsGiven,
        replies,
        calls,
        videoCalls,
        activeDays,
        storyViews,
        storyLikes,
      },
    });
  } catch (error) {
    console.error("getRelationshipScore:", error.message);
    return res.status(500).json({ error: "Failed to compute score" });
  }
};

/**
 * GET /api/insights/top-friends
 */
export const getTopFriends = async (req, res) => {
  try {
    const myId = req.user._id;
    const myOid = new mongoose.Types.ObjectId(myId);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);

    const me = await User.findById(myId).select("friends");
    const friendIds = (me?.friends || []).map((id) => new mongoose.Types.ObjectId(id));

    if (!friendIds.length) {
      return res.status(200).json({ friends: [], weekly: [], monthly: [] });
    }

    const messageScores = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: myOid, receiverId: { $in: friendIds } },
            { senderId: { $in: friendIds }, receiverId: myOid },
          ],
          deletedFor: { $nin: [myOid] },
        },
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$senderId", myOid] }, "$receiverId", "$senderId"],
          },
          messages: { $sum: 1 },
          media: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $and: [{ $ifNull: ["$image", false] }, { $ne: ["$image", ""] }] },
                    { $and: [{ $ifNull: ["$video", false] }, { $ne: ["$video", ""] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          voice: {
            $sum: {
              $cond: [{ $and: [{ $ifNull: ["$audio", false] }, { $ne: ["$audio", ""] }] }, 1, 0],
            },
          },
          lastAt: { $max: "$createdAt" },
        },
      },
      { $sort: { messages: -1 } },
      { $limit: limit },
    ]);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [weekly, monthly, users] = await Promise.all([
      Message.aggregate([
        {
          $match: {
            $or: [{ senderId: myOid }, { receiverId: myOid }],
            createdAt: { $gte: weekAgo },
            deletedFor: { $nin: [myOid] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Message.aggregate([
        {
          $match: {
            $or: [{ senderId: myOid }, { receiverId: myOid }],
            createdAt: { $gte: monthAgo },
            deletedFor: { $nin: [myOid] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.find({ _id: { $in: messageScores.map((m) => m._id) } }).select(
        "fullName profilePic"
      ),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const friends = messageScores.map((row) => {
      const u = userMap.get(row._id.toString());
      const raw = row.messages + row.media * 2 + row.voice * 3;
      const score = Math.min(100, Math.round(Math.log10(raw + 1) * 40));
      return {
        user: u
          ? { _id: u._id, fullName: u.fullName, profilePic: u.profilePic }
          : { _id: row._id },
        messages: row.messages,
        media: row.media,
        voice: row.voice,
        lastAt: row.lastAt,
        score,
      };
    });

    return res.status(200).json({
      friends,
      weekly: weekly.map((d) => ({ date: d._id, count: d.count })),
      monthly: monthly.map((d) => ({ date: d._id, count: d.count })),
    });
  } catch (error) {
    console.error("getTopFriends:", error.message);
    return res.status(500).json({ error: "Failed to load insights" });
  }
};
