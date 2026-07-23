import mongoose from "mongoose";
import GroupVibe from "../models/groupVibe.model.js";
import GroupVibeView from "../models/groupVibeView.model.js";
import GroupVibeReaction from "../models/groupVibeReaction.model.js";
import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import User from "../models/user.model.js";
import { uploadBufferToCloudinary, videoThumbnailFromResult, destroyCloudinaryAsset } from "../utils/statusMedia.js";
import { assertMediaSize } from "../middleware/statusUpload.middleware.js";
import { io } from "../lib/socket.js";

const VIBE_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const MAX_VIDEO_DURATION = 60;
const DEFAULT_PHOTO_DURATION = 5;

/** Helper: verify active group membership */
export async function assertGroupMembership(groupId, userId) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return { ok: false, status: 400, message: "Invalid group ID" };
  }
  const group = await Group.findById(groupId).lean();
  if (!group) {
    return { ok: false, status: 404, message: "Group not found" };
  }
  const member = group.members?.find(
    (m) => (m.user?._id || m.user).toString() === userId.toString()
  );
  if (!member) {
    return { ok: false, status: 403, message: "You are not a member of this group" };
  }
  return { ok: true, group, member };
}

/**
  * POST /api/groups/:groupId/vibes
  */
export const createGroupVibe = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const { group, member } = authCheck;
    if (group.vibesDisabled) {
      return res.status(403).json({ error: "Group Vibes are disabled in this group" });
    }

    const isGroupAdmin = member.role === "admin" || group.admin?.toString() === userId.toString();
    if (group.addVibesRestricted && !isGroupAdmin) {
      return res.status(403).json({ error: "Only admins can add Group Vibes in this group" });
    }

    const mediaFile = req.files?.media?.[0];
    const text = String(req.body.text || req.body.caption || "").slice(0, 500);

    let mediaType = "text";
    let mediaUrl = "";
    let thumbnailUrl = "";
    let publicId = "";
    let duration = DEFAULT_PHOTO_DURATION;

    if (mediaFile) {
      assertMediaSize(mediaFile);
      const isVideo = mediaFile.mimetype.startsWith("video/");
      const isImage = mediaFile.mimetype.startsWith("image/");
      if (!isVideo && !isImage) {
        return res.status(400).json({ error: "Invalid media file type" });
      }

      mediaType = isVideo ? "video" : "photo";

      if (isVideo) {
        let reqDur = Number(req.body.duration);
        duration = Number.isFinite(reqDur) && reqDur > 0 ? Math.min(MAX_VIDEO_DURATION, reqDur) : 15;
      } else {
        duration = DEFAULT_PHOTO_DURATION;
      }

      const uploaded = await uploadBufferToCloudinary(mediaFile.buffer, {
        folder: "chatappey_group_vibes",
        resourceType: isVideo ? "video" : "image",
        publicIdHint: mediaFile.originalname,
        mime: mediaFile.mimetype,
      });

      mediaUrl = uploaded.secure_url;
      publicId = uploaded.public_id;

      const thumbFile = req.files?.thumbnail?.[0];
      if (thumbFile) {
        assertMediaSize(thumbFile);
        const thumbUp = await uploadBufferToCloudinary(thumbFile.buffer, {
          folder: "chatappey_group_vibes/thumbs",
          resourceType: "image",
          publicIdHint: `thumb_${mediaFile.originalname}`,
          mime: thumbFile.mimetype,
        });
        thumbnailUrl = thumbUp.secure_url;
      } else if (isVideo) {
        thumbnailUrl = videoThumbnailFromResult(uploaded);
      } else {
        thumbnailUrl = mediaUrl;
      }
    } else if (!text.trim()) {
      return res.status(400).json({ error: "Group Vibe requires text or media" });
    }

    // Parse Music metadata if provided
    let music = undefined;
    if (req.body.music) {
      try {
        const raw = typeof req.body.music === "string" ? JSON.parse(req.body.music) : req.body.music;
        if (raw?.title) {
          music = {
            songId: String(raw.id || raw.songId || "").slice(0, 80),
            title: String(raw.title || "").slice(0, 200),
            artist: String(raw.artist || "").slice(0, 200),
            artwork: String(raw.artwork || raw.thumbnail || "").slice(0, 500),
            audioUrl: String(raw.audioUrl || "").slice(0, 2000),
            sourceUrl: String(raw.sourceUrl || "").slice(0, 500),
            clipStart: Math.max(0, Number(raw.clipStart || raw.startOffset) || 0),
            clipDuration: Math.min(60, Math.max(5, Number(raw.clipDuration) || 15)),
            originalAudioVolume: Math.min(100, Math.max(0, Number(raw.originalAudioVolume) ?? 100)),
            musicVolume: Math.min(100, Math.max(0, Number(raw.musicVolume) ?? 100)),
            sticker: {
              x: Math.min(1, Math.max(0, Number(raw.sticker?.x) ?? 0.5)),
              y: Math.min(1, Math.max(0, Number(raw.sticker?.y) ?? 0.72)),
              scale: Math.min(2.5, Math.max(0.6, Number(raw.sticker?.scale) ?? 1)),
              rotation: Number(raw.sticker?.rotation) || 0,
              theme: ["classic", "dark", "neon", "minimal"].includes(raw.sticker?.theme)
                ? raw.sticker.theme
                : "classic",
            },
          };
          if (mediaType === "photo" && music.clipDuration) {
            duration = music.clipDuration;
          }
        }
      } catch (e) {
        console.warn("Invalid music payload in group vibe creation:", e.message);
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + VIBE_EXPIRATION_MS);

    const vibe = await GroupVibe.create({
      groupId,
      creatorId: userId,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      publicId,
      text,
      duration,
      music,
      expiresAt,
    });

    const populated = await GroupVibe.findById(vibe._id).populate(
      "creatorId",
      "fullName profilePic"
    );

    // Auto-mark as viewed by creator
    await GroupVibeView.create({
      vibeId: vibe._id,
      groupId,
      userId,
      viewedAt: now,
    }).catch(() => {});

    const responsePayload = {
      _id: populated._id,
      groupId,
      creator: {
        _id: populated.creatorId._id,
        fullName: populated.creatorId.fullName,
        profilePic: populated.creatorId.profilePic || "",
      },
      mediaType: populated.mediaType,
      mediaUrl: populated.mediaUrl,
      thumbnailUrl: populated.thumbnailUrl,
      text: populated.text,
      duration: populated.duration,
      music: populated.music,
      createdAt: populated.createdAt,
      expiresAt: populated.expiresAt,
      viewCount: 1,
      viewedByMe: true,
      myReaction: null,
      reactionsSummary: {},
    };

    // Broadcast live socket event to group room
    io.to(String(groupId)).emit("group:vibe:created", {
      groupId: String(groupId),
      vibe: responsePayload,
    });

    return res.status(201).json({ vibe: responsePayload });
  } catch (error) {
    console.error("createGroupVibe:", error);
    return res.status(500).json({ error: error.message || "Failed to create Group Vibe" });
  }
};

/**
  * GET /api/groups/:groupId/vibes
  */
export const getGroupVibes = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const now = new Date();
    const vibes = await GroupVibe.find({
      groupId,
      deleted: { $ne: true },
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: 1 })
      .populate("creatorId", "fullName profilePic")
      .lean();

    if (!vibes.length) {
      return res.json({ vibes: [], groupName: authCheck.group.name });
    }

    const vibeIds = vibes.map((v) => v._id);

    // Fetch user's own views & reactions in bulk
    const [myViews, myReactions, viewCounts, reactionDocs] = await Promise.all([
      GroupVibeView.find({ vibeId: { $in: vibeIds }, userId }).select("vibeId").lean(),
      GroupVibeReaction.find({ vibeId: { $in: vibeIds }, userId }).select("vibeId reaction").lean(),
      GroupVibeView.aggregate([
        { $match: { vibeId: { $in: vibeIds } } },
        { $group: { _id: "$vibeId", count: { $sum: 1 } } },
      ]),
      GroupVibeReaction.aggregate([
        { $match: { vibeId: { $in: vibeIds } } },
        { $group: { _id: { vibeId: "$vibeId", reaction: "$reaction" }, count: { $sum: 1 } } },
      ]),
    ]);

    const viewedSet = new Set(myViews.map((v) => String(v.vibeId)));
    const reactionMap = new Map(myReactions.map((r) => [String(r.vibeId), r.reaction]));
    const viewCountMap = new Map(viewCounts.map((v) => [String(v._id), v.count]));

    const summaryMap = new Map();
    for (const r of reactionDocs) {
      const vid = String(r._id.vibeId);
      if (!summaryMap.has(vid)) summaryMap.set(vid, {});
      summaryMap.get(vid)[r._id.reaction] = r.count;
    }

    const formattedVibes = vibes.map((v) => {
      const vid = String(v._id);
      return {
        _id: v._id,
        groupId: v.groupId,
        creator: {
          _id: v.creatorId?._id || v.creatorId,
          fullName: v.creatorId?.fullName || "Member",
          profilePic: v.creatorId?.profilePic || "",
        },
        mediaType: v.mediaType,
        mediaUrl: v.mediaUrl,
        thumbnailUrl: v.thumbnailUrl,
        text: v.text,
        duration: v.duration,
        music: v.music,
        createdAt: v.createdAt,
        expiresAt: v.expiresAt,
        viewCount: viewCountMap.get(vid) || 0,
        viewedByMe: viewedSet.has(vid),
        myReaction: reactionMap.get(vid) || null,
        reactionsSummary: summaryMap.get(vid) || {},
      };
    });

    return res.json({ vibes: formattedVibes, groupName: authCheck.group.name });
  } catch (error) {
    console.error("getGroupVibes:", error);
    return res.status(500).json({ error: "Failed to fetch Group Vibes" });
  }
};

/**
  * GET /api/groups/vibes/summary
  * Fast feed summary for ring indicators across user's active groups
  */
export const getAllGroupVibesSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const userGroups = await Group.find({ "members.user": userId }).select("_id").lean();
    if (!userGroups.length) {
      return res.json({ summaries: {} });
    }

    const groupIds = userGroups.map((g) => g._id);
    const now = new Date();

    const activeVibes = await GroupVibe.find({
      groupId: { $in: groupIds },
      deleted: { $ne: true },
      expiresAt: { $gt: now },
    })
      .select("_id groupId createdAt creatorId")
      .lean();

    if (!activeVibes.length) {
      return res.json({ summaries: {} });
    }

    const vibeIds = activeVibes.map((v) => v._id);
    const myViews = await GroupVibeView.find({
      vibeId: { $in: vibeIds },
      userId,
    })
      .select("vibeId")
      .lean();

    const viewedSet = new Set(myViews.map((v) => String(v.vibeId)));

    const summaries = {};
    for (const v of activeVibes) {
      const gid = String(v.groupId);
      if (!summaries[gid]) {
        summaries[gid] = {
          totalCount: 0,
          unseenCount: 0,
          hasUnseen: false,
          latestAt: v.createdAt,
        };
      }
      summaries[gid].totalCount += 1;
      const isViewed = viewedSet.has(String(v._id));
      if (!isViewed && String(v.creatorId) !== String(userId)) {
        summaries[gid].unseenCount += 1;
        summaries[gid].hasUnseen = true;
      }
      if (new Date(v.createdAt) > new Date(summaries[gid].latestAt)) {
        summaries[gid].latestAt = v.createdAt;
      }
    }

    return res.json({ summaries });
  } catch (error) {
    console.error("getAllGroupVibesSummary:", error);
    return res.status(500).json({ error: "Failed to fetch vibe summary" });
  }
};

/**
  * POST /api/groups/:groupId/vibes/:vibeId/view
  */
export const viewGroupVibe = async (req, res) => {
  try {
    const { groupId, vibeId } = req.params;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const vibe = await GroupVibe.findOne({
      _id: vibeId,
      groupId,
      deleted: { $ne: true },
      expiresAt: { $gt: new Date() },
    });

    if (!vibe) {
      return res.status(404).json({ error: "Group Vibe not found or expired" });
    }

    let isNewView = false;
    try {
      await GroupVibeView.create({
        vibeId,
        groupId,
        userId,
        viewedAt: new Date(),
      });
      isNewView = true;
    } catch (e) {
      // Ignore unique compound index duplicate error safely
    }

    const totalViews = await GroupVibeView.countDocuments({ vibeId });

    if (isNewView) {
      io.to(String(groupId)).emit("group:vibe:viewed", {
        groupId: String(groupId),
        vibeId: String(vibeId),
        totalViews,
      });
    }

    return res.json({ viewed: true, totalViews });
  } catch (error) {
    console.error("viewGroupVibe:", error);
    return res.status(500).json({ error: "Failed to record view" });
  }
};

/**
  * POST /api/groups/:groupId/vibes/:vibeId/react
  */
export const reactToGroupVibe = async (req, res) => {
  try {
    const { groupId, vibeId } = req.params;
    const { reaction } = req.body;
    const userId = req.user._id;

    const allowedReactions = ["❤️", "😂", "🔥", "😍", "😮", "😢", "👏"];
    if (!allowedReactions.includes(reaction)) {
      return res.status(400).json({ error: "Invalid reaction emoji" });
    }

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const vibe = await GroupVibe.findOne({
      _id: vibeId,
      groupId,
      deleted: { $ne: true },
      expiresAt: { $gt: new Date() },
    });

    if (!vibe) {
      return res.status(404).json({ error: "Group Vibe not found or expired" });
    }

    const existing = await GroupVibeReaction.findOne({ vibeId, userId });
    let updatedReaction = reaction;

    if (existing) {
      if (existing.reaction === reaction) {
        await existing.deleteOne();
        updatedReaction = null;
      } else {
        existing.reaction = reaction;
        await existing.save();
      }
    } else {
      await GroupVibeReaction.create({
        vibeId,
        groupId,
        userId,
        reaction,
      });
    }

    // Aggregate summary for vibe
    const reactionDocs = await GroupVibeReaction.aggregate([
      { $match: { vibeId: new mongoose.Types.ObjectId(vibeId) } },
      { $group: { _id: "$reaction", count: { $sum: 1 } } },
    ]);

    const reactionsSummary = {};
    for (const r of reactionDocs) {
      reactionsSummary[r._id] = r.count;
    }

    const payload = {
      groupId: String(groupId),
      vibeId: String(vibeId),
      userId: String(userId),
      reaction: updatedReaction,
      reactionsSummary,
    };

    io.to(String(groupId)).emit("group:vibe:reaction", payload);

    return res.json(payload);
  } catch (error) {
    console.error("reactToGroupVibe:", error);
    return res.status(500).json({ error: "Failed to process reaction" });
  }
};

/**
  * GET /api/groups/:groupId/vibes/:vibeId/viewers
  */
export const getGroupVibeViewers = async (req, res) => {
  try {
    const { groupId, vibeId } = req.params;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const vibe = await GroupVibe.findOne({ _id: vibeId, groupId, deleted: { $ne: true } });
    if (!vibe) {
      return res.status(404).json({ error: "Group Vibe not found" });
    }

    const views = await GroupVibeView.find({ vibeId })
      .populate("userId", "fullName profilePic")
      .sort({ viewedAt: -1 })
      .lean();

    const reactions = await GroupVibeReaction.find({ vibeId }).lean();
    const reactionMap = new Map(reactions.map((r) => [String(r.userId), r.reaction]));

    const viewersList = views
      .filter((v) => v.userId)
      .map((v) => ({
        user: {
          _id: v.userId._id,
          fullName: v.userId.fullName,
          profilePic: v.userId.profilePic || "",
        },
        viewedAt: v.viewedAt,
        reaction: reactionMap.get(String(v.userId._id)) || null,
      }));

    return res.json({ viewers: viewersList, count: viewersList.length });
  } catch (error) {
    console.error("getGroupVibeViewers:", error);
    return res.status(500).json({ error: "Failed to fetch viewers" });
  }
};

/**
  * POST /api/groups/:groupId/vibes/:vibeId/reply
  */
export const replyToGroupVibe = async (req, res) => {
  try {
    const { groupId, vibeId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const vibe = await GroupVibe.findOne({ _id: vibeId, groupId, deleted: { $ne: true } }).populate(
      "creatorId",
      "fullName"
    );

    const isAvailable = vibe && new Date(vibe.expiresAt) > new Date();

    const sender = await User.findById(userId).select("fullName profilePic");

    const messageData = {
      groupId,
      senderId: userId,
      messageType: "text",
      text: text.trim(),
      replyToMessage: {
        text: isAvailable ? `Replying to ${vibe.creatorId?.fullName || "Member"}'s Vibe` : "This Vibe is no longer available.",
        senderName: vibe?.creatorId?.fullName || "Group Vibe",
        image: vibe?.thumbnailUrl || vibe?.mediaUrl || undefined,
      },
    };

    const groupMsg = await GroupMessage.create({
      groupId,
      senderId: userId,
      text: text.trim(),
      status: "sent",
      readBy: [userId],
      replyToMessage: messageData.replyToMessage,
    });

    const populatedMsg = await GroupMessage.findById(groupMsg._id).populate(
      "senderId",
      "fullName profilePic"
    );

    await Group.findByIdAndUpdate(groupId, {
      lastMessage: {
        text: `Replying to Vibe: ${text.trim()}`,
        senderId: userId,
        senderName: sender.fullName,
        createdAt: groupMsg.createdAt,
      },
    });

    io.to(String(groupId)).emit("newGroupMessage", populatedMsg);

    return res.status(201).json({ message: populatedMsg });
  } catch (error) {
    console.error("replyToGroupVibe:", error);
    return res.status(500).json({ error: "Failed to send vibe reply" });
  }
};

/**
  * DELETE /api/groups/:groupId/vibes/:vibeId
  */
export const deleteGroupVibe = async (req, res) => {
  try {
    const { groupId, vibeId } = req.params;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const vibe = await GroupVibe.findOne({ _id: vibeId, groupId, deleted: { $ne: true } });
    if (!vibe) {
      return res.status(404).json({ error: "Group Vibe not found" });
    }

    const isCreator = String(vibe.creatorId) === String(userId);
    const isGroupAdmin =
      authCheck.member.role === "admin" || String(authCheck.group.admin) === String(userId);

    if (!isCreator && !isGroupAdmin) {
      return res.status(403).json({ error: "Not authorized to delete this Group Vibe" });
    }

    vibe.deleted = true;
    await vibe.save();

    if (vibe.publicId) {
      destroyCloudinaryAsset(
        vibe.publicId,
        vibe.mediaType === "video" ? "video" : "image"
      ).catch(() => {});
    }

    io.to(String(groupId)).emit("group:vibe:deleted", {
      groupId: String(groupId),
      vibeId: String(vibeId),
    });

    return res.json({ message: "Group Vibe deleted successfully", vibeId });
  } catch (error) {
    console.error("deleteGroupVibe:", error);
    return res.status(500).json({ error: "Failed to delete Group Vibe" });
  }
};

/**
  * GET /api/groups/:groupId/vibes/archive
  * Creator only archive of their expired vibes
  */
export const getCreatorVibeArchive = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const archivedVibes = await GroupVibe.find({
      groupId,
      creatorId: userId,
      deleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ archive: archivedVibes });
  } catch (error) {
    console.error("getCreatorVibeArchive:", error);
    return res.status(500).json({ error: "Failed to fetch archive" });
  }
};

/**
  * PUT /api/groups/:groupId/vibe-permissions
  */
export const updateGroupVibePermissions = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { addVibesRestricted, vibesDisabled } = req.body;
    const userId = req.user._id;

    const authCheck = await assertGroupMembership(groupId, userId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.message });
    }

    const isGroupAdmin =
      authCheck.member.role === "admin" || String(authCheck.group.admin) === String(userId);

    if (!isGroupAdmin) {
      return res.status(403).json({ error: "Only group admins can modify permissions" });
    }

    const updateObj = {};
    if (typeof addVibesRestricted === "boolean") {
      updateObj.addVibesRestricted = addVibesRestricted;
    }
    if (typeof vibesDisabled === "boolean") {
      updateObj.vibesDisabled = vibesDisabled;
    }

    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateObj, { new: true });

    io.to(String(groupId)).emit("group:updated", updatedGroup);

    return res.json({ group: updatedGroup });
  } catch (error) {
    console.error("updateGroupVibePermissions:", error);
    return res.status(500).json({ error: "Failed to update permissions" });
  }
};
