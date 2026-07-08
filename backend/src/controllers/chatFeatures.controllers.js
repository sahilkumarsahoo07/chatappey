import mongoose from "mongoose";
import Message from "../models/message.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import ChatPreference from "../models/chatPreference.model.js";
import StarredMessage from "../models/starredMessage.model.js";
import { uploadBufferToCloudinary, videoThumbnailFromResult } from "../utils/statusMedia.js";
import { isChatMuted } from "../utils/chatPreference.utils.js";

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

function parseMuteDuration(duration) {
  const now = Date.now();
  if (duration === "8h") return new Date(now + 8 * 60 * 60 * 1000);
  if (duration === "1w") return new Date(now + 7 * 24 * 60 * 60 * 1000);
  if (duration === "always") return new Date("2099-12-31T23:59:59.000Z");
  return null;
}

async function upsertPref(userId, chatType, targetId, patch) {
  return ChatPreference.findOneAndUpdate(
    { userId, chatType, targetId },
    { $set: patch, $setOnInsert: { userId, chatType, targetId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** GET /api/chat/preferences/:chatType/:targetId */
export const getChatPreference = async (req, res) => {
  try {
    const { chatType, targetId } = req.params;
    if (!["dm", "group"].includes(chatType)) {
      return res.status(400).json({ error: "Invalid chat type" });
    }
    const pref = await ChatPreference.findOne({
      userId: req.user._id,
      chatType,
      targetId,
    }).lean();
    return res.status(200).json({
      preference: pref || {
        isArchived: false,
        mutedUntil: null,
        wallpaper: { type: "default", value: "default", blur: 0, brightness: 100 },
      },
      isMuted: isChatMuted(pref),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** PUT /api/chat/preferences */
export const updateChatPreference = async (req, res) => {
  try {
    const { chatType, targetId, wallpaper } = req.body;
    if (!chatType || !targetId) {
      return res.status(400).json({ error: "chatType and targetId required" });
    }
    const patch = {};
    if (wallpaper) patch.wallpaper = wallpaper;
    const pref = await upsertPref(req.user._id, chatType, targetId, patch);
    return res.status(200).json({ preference: pref });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** POST /api/chat/archive */
export const setArchive = async (req, res) => {
  try {
    const { chatType, targetId, archived } = req.body;
    if (!chatType || !targetId || typeof archived !== "boolean") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const pref = await upsertPref(req.user._id, chatType, targetId, { isArchived: archived });
    return res.status(200).json({ preference: pref });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** GET /api/chat/archived */
export const getArchivedChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const prefs = await ChatPreference.find({ userId, isArchived: true }).lean();
    const dmIds = prefs.filter((p) => p.chatType === "dm").map((p) => p.targetId);
    const groupIds = prefs.filter((p) => p.chatType === "group").map((p) => p.targetId);

    const [users, groups] = await Promise.all([
      dmIds.length ? User.find({ _id: { $in: dmIds } }).select("-password") : [],
      groupIds.length ? Group.find({ _id: { $in: groupIds }, members: userId }) : [],
    ]);

    return res.status(200).json({
      dms: users.map((u) => ({
        ...u.toObject(),
        chatType: "dm",
        targetId: u._id,
        preference: prefs.find((p) => p.chatType === "dm" && p.targetId.toString() === u._id.toString()),
      })),
      groups: groups.map((g) => ({
        ...g.toObject(),
        chatType: "group",
        targetId: g._id,
        preference: prefs.find((p) => p.chatType === "group" && p.targetId.toString() === g._id.toString()),
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** POST /api/chat/mute */
export const setMute = async (req, res) => {
  try {
    const { chatType, targetId, duration } = req.body;
    const mutedUntil = parseMuteDuration(duration);
    if (!chatType || !targetId || !mutedUntil) {
      return res.status(400).json({ error: "Invalid mute request" });
    }
    const pref = await upsertPref(req.user._id, chatType, targetId, { mutedUntil });
    return res.status(200).json({ preference: pref, isMuted: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** DELETE /api/chat/mute/:chatType/:targetId */
export const clearMute = async (req, res) => {
  try {
    const { chatType, targetId } = req.params;
    const pref = await upsertPref(req.user._id, chatType, targetId, { mutedUntil: null });
    return res.status(200).json({ preference: pref, isMuted: false });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** GET /api/chat/starred */
export const getStarredMessages = async (req, res) => {
  try {
    const stars = await StarredMessage.find({ userId: req.user._id })
      .sort({ starredAt: -1 })
      .lean();

    const dmIds = stars.filter((s) => s.chatType === "dm").map((s) => s.messageId);
    const groupIds = stars.filter((s) => s.chatType === "group").map((s) => s.messageId);

    const [dmMsgs, groupMsgs] = await Promise.all([
      dmIds.length ? Message.find({ _id: { $in: dmIds } }).populate("senderId", "fullName profilePic") : [],
      groupIds.length ? GroupMessage.find({ _id: { $in: groupIds } }).populate("senderId", "fullName profilePic") : [],
    ]);

    const msgMap = new Map();
    dmMsgs.forEach((m) => msgMap.set(m._id.toString(), { ...m.toObject(), chatType: "dm" }));
    groupMsgs.forEach((m) => msgMap.set(m._id.toString(), { ...m.toObject(), chatType: "group" }));

    const items = stars
      .map((s) => {
        const msg = msgMap.get(s.messageId.toString());
        if (!msg) return null;
        return {
          starId: s._id,
          starredAt: s.starredAt,
          chatType: s.chatType,
          targetId: s.targetId,
          message: msg,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** POST /api/chat/starred */
export const starMessage = async (req, res) => {
  try {
    const { messageId, chatType, targetId } = req.body;
    if (!messageId || !chatType || !targetId) {
      return res.status(400).json({ error: "messageId, chatType, targetId required" });
    }

    const Model = chatType === "group" ? GroupMessage : Message;
    const msg = await Model.findById(messageId);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    const star = await StarredMessage.findOneAndUpdate(
      { userId: req.user._id, messageId },
      { userId: req.user._id, messageId, chatType, targetId, starredAt: new Date() },
      { upsert: true, new: true }
    );

    return res.status(200).json({ starred: true, star });
  } catch (e) {
    if (e.code === 11000) return res.status(200).json({ starred: true });
    return res.status(500).json({ error: e.message });
  }
};

/** DELETE /api/chat/starred/:messageId */
export const unstarMessage = async (req, res) => {
  try {
    await StarredMessage.deleteOne({ userId: req.user._id, messageId: req.params.messageId });
    return res.status(200).json({ starred: false });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** GET /api/chat/starred/ids — batch check for message list */
export const getStarredIds = async (req, res) => {
  try {
    const stars = await StarredMessage.find({ userId: req.user._id }).select("messageId").lean();
    return res.status(200).json({ ids: stars.map((s) => s.messageId.toString()) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** GET /api/chat/shared-media/:chatType/:targetId */
export const getSharedMedia = async (req, res) => {
  try {
    const { chatType, targetId } = req.params;
    const tab = req.query.tab || "images";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);
    const skip = (page - 1) * limit;
    const myId = req.user._id;

    let query = {};
    if (chatType === "dm") {
      query = {
        $or: [
          { senderId: myId, receiverId: targetId },
          { senderId: targetId, receiverId: myId },
        ],
        deletedFor: { $nin: [myId] },
      };
    } else {
      query = { groupId: targetId, deletedFor: { $nin: [myId] } };
    }

    if (tab === "images") query.image = { $exists: true, $ne: "" };
    else if (tab === "videos") query.video = { $exists: true, $ne: "" };
    else if (tab === "documents") query.file = { $exists: true, $ne: "" };
    else if (tab === "links") query.text = { $regex: URL_REGEX };

    const Model = chatType === "group" ? GroupMessage : Message;

    const [items, total] = await Promise.all([
      Model.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("senderId", "fullName profilePic")
        .lean(),
      Model.countDocuments(query),
    ]);

    const links =
      tab === "links"
        ? items.map((m) => {
            const found = (m.text || "").match(URL_REGEX) || [];
            return { ...m, links: [...new Set(found)] };
          })
        : items;

    return res.status(200).json({
      items: links,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

/** POST /api/chat/upload-video — multipart, returns URLs only */
export const uploadChatVideo = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Video file required" });

    const duration = Math.min(600, Math.max(1, Number(req.body.duration) || 5));

    const result = await uploadBufferToCloudinary(file.buffer, {
      folder: "chatappey_messages/videos",
      resourceType: "video",
      mime: file.mimetype,
    });

    const thumbnailUrl = videoThumbnailFromResult(result);

    return res.status(200).json({
      video: result.secure_url,
      videoThumbnail: thumbnailUrl,
      videoDuration: duration,
      videoPublicId: result.public_id,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Video upload failed" });
  }
};
