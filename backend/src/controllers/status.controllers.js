import mongoose from "mongoose";
import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import Message from "../models/message.model.js";
import {
  uploadBufferToCloudinary,
  videoThumbnailFromResult,
  destroyCloudinaryAsset,
} from "../utils/statusMedia.js";
import { assertMediaSize } from "../middleware/statusUpload.middleware.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DURATION = 30;
const IMAGE_DURATION = 5;

function parseIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => String(id))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  } catch {
    return [];
  }
}

function ownerIdOf(status) {
  const u = status.userId;
  return (u?._id || u)?.toString?.() || "";
}

function canViewerSeeStatus(status, viewerId, viewerFriendsSet) {
  const ownerId = ownerIdOf(status);
  const vid = viewerId.toString();

  // Owner always sees their own
  if (ownerId === vid) return true;

  const privacy = status.privacy || "contacts";
  const excluded = (status.excludedUserIds || []).map((id) => id.toString());
  const included = (status.includedUserIds || []).map((id) => id.toString());

  switch (privacy) {
    case "everyone":
      return true;
    case "contacts":
      return viewerFriendsSet.has(ownerId);
    case "contacts_except":
      return viewerFriendsSet.has(ownerId) && !excluded.includes(vid);
    case "only_share_with":
      return included.includes(vid);
    default:
      return viewerFriendsSet.has(ownerId);
  }
}

function formatStatus(doc, viewerId) {
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const viewerStr = viewerId?.toString?.() || "";
  const viewed = viewerStr
    ? (obj.viewers || []).some(
        (v) => (v.userId?._id || v.userId)?.toString() === viewerStr
      )
    : false;
  const likedByMe = viewerStr
    ? (obj.likes || []).some(
        (l) => (l.userId?._id || l.userId)?.toString() === viewerStr
      )
    : false;
  const myReaction = viewerStr
    ? (obj.reactions || []).find(
        (r) => (r.userId?._id || r.userId)?.toString() === viewerStr
      )
    : null;
  const user = obj.userId?._id
    ? {
        _id: obj.userId._id,
        fullName: obj.userId.fullName,
        profilePic: obj.userId.profilePic || "",
      }
    : undefined;

  const reactionSummary = {};
  for (const r of obj.reactions || []) {
    reactionSummary[r.emoji] = (reactionSummary[r.emoji] || 0) + 1;
  }

  const ownerStr = ownerIdOf(obj);

  // PRIVACY ENFORCEMENT: Only return mentions to story owner OR the specific mentioned user
  const rawMentions = obj.mentions || [];
  const visibleMentions = rawMentions
    .filter((m) => {
      const mentionedIdStr = (m.userId?._id || m.userId)?.toString?.() || "";
      return viewerStr === ownerStr || viewerStr === mentionedIdStr;
    })
    .map((m) => ({
      userId: (m.userId?._id || m.userId)?.toString?.() || "",
      username: m.username || "",
      displayName: m.displayName || "",
      x: m.x ?? 0.5,
      y: m.y ?? 0.5,
      scale: m.scale ?? 1,
      rotation: m.rotation ?? 0,
      style: m.style || "default",
    }));

  const restoryData = obj.restory?.originalStatusId
    ? {
        originalStatusId: obj.restory.originalStatusId,
        originalUserId: obj.restory.originalUserId,
        originalUsername: obj.restory.originalUsername || "",
        originalDisplayName: obj.restory.originalDisplayName || "",
        originalMediaUrl: obj.restory.originalMediaUrl || "",
        originalMediaType: obj.restory.originalMediaType || "image",
        originalThumbnailUrl: obj.restory.originalThumbnailUrl || "",
      }
    : null;

  return {
    _id: obj._id,
    userId: user || obj.userId,
    mediaType: obj.mediaType,
    mediaUrl: obj.mediaUrl,
    thumbnailUrl: obj.thumbnailUrl || "",
    duration: obj.duration,
    caption: obj.caption || "",
    music: (obj.music?.audioUrl || obj.music?.title)
      ? {
          id: obj.music.id || "",
          title: obj.music.title || "",
          artist: obj.music.artist || "",
          thumbnail: obj.music.thumbnail || obj.music.artwork || "",
          artwork: obj.music.artwork || obj.music.thumbnail || "",
          audioUrl: obj.music.audioUrl || "",
          duration: obj.music.duration || 0,
          quality: obj.music.quality || "",
          sourceUrl: obj.music.sourceUrl || "",
          startOffset: Number(obj.music.startOffset) || 0,
          clipStart: Number(obj.music.startOffset ?? obj.music.clipStart) || 0,
          clipDuration: Number(obj.music.clipDuration) || 15,
          backgroundTheme: obj.music.backgroundTheme || "purple",
          stickerStyle: obj.music.stickerStyle || "classic",
          layoutStyle: obj.music.layoutStyle || "style1",
          sticker: {
            x: obj.music.sticker?.x ?? 0.5,
            y: obj.music.sticker?.y ?? 0.72,
            scale: obj.music.sticker?.scale ?? 1,
            rotation: obj.music.sticker?.rotation ?? 0,
            theme: obj.music.sticker?.theme || obj.music.stickerStyle || "classic",
          },
        }
      : null,
    mentions: visibleMentions,
    restory: restoryData,
    privacy: obj.privacy,
    createdAt: obj.createdAt,
    expiresAt: obj.expiresAt,
    viewerCount: (obj.viewers || []).length,
    likeCount: (obj.likes || []).length,
    commentCount: (obj.comments || []).length,
    likedByMe,
    myReaction: myReaction?.emoji || null,
    reactionSummary,
    viewed,
  };
}

/**
 * Resolve who should receive a live status event for this document.
 */
async function resolveStatusAudienceIds(status, ownerId) {
  const owner = await User.findById(ownerId).select("friends blockedUsers");
  const friends = (owner?.friends || []).map((id) => id.toString());
  const blocked = new Set((owner?.blockedUsers || []).map((id) => id.toString()));
  const privacy = status.privacy || "contacts";
  const excluded = new Set((status.excludedUserIds || []).map((id) => id.toString()));
  const included = new Set((status.includedUserIds || []).map((id) => id.toString()));

  let targets = [];
  if (privacy === "everyone") {
    // Keep broadcast scoped to friends for "everyone" in practice (WhatsApp contacts model);
    // true global spam avoided — friends + anyone already sharing still get it via feed refresh.
    targets = friends;
  } else if (privacy === "contacts") {
    targets = friends;
  } else if (privacy === "contacts_except") {
    targets = friends.filter((id) => !excluded.has(id));
  } else if (privacy === "only_share_with") {
    targets = [...included];
  }

  const ownerStr = ownerId.toString();
  return [...new Set([ownerStr, ...targets])].filter((id) => !blocked.has(id) || id === ownerStr);
}

function emitToUserIds(userIds, event, payload) {
  for (const id of userIds) {
    const sid = getReceiverSocketId(id);
    if (sid) io.to(sid).emit(event, payload);
  }
}

async function broadcastStatusEvent(event, statusDoc, ownerId) {
  try {
    const audience = await resolveStatusAudienceIds(statusDoc, ownerId);
    const formatted = formatStatus(statusDoc, null);
    // For feed UI, attach a stable user object
    const user =
      statusDoc.userId?._id
        ? {
            _id: statusDoc.userId._id,
            fullName: statusDoc.userId.fullName,
            profilePic: statusDoc.userId.profilePic || "",
          }
        : null;

    emitToUserIds(audience, event, {
      status: { ...formatted, viewed: false },
      user,
      ownerId: ownerId.toString(),
    });
  } catch (err) {
    console.error(`broadcastStatusEvent(${event}):`, err.message);
  }
}

/**
 * POST /status/upload
 * multipart: media (required), thumbnail (optional for video),
 * fields: caption, privacy, duration, excludedUserIds, includedUserIds
 */
export const uploadStatus = async (req, res) => {
  try {
    const media = req.files?.media?.[0];

    let music = undefined;
    if (req.body.music) {
      try {
        const raw =
          typeof req.body.music === "string"
            ? JSON.parse(req.body.music)
            : req.body.music;
        if ((raw?.audioUrl || raw?.sourceUrl || raw?.title) && (raw?.title || raw?.name)) {
          const startOffset = Math.max(0, Number(raw.startOffset ?? raw.clipStart) || 0);
          const clipDuration = Math.min(
            60,
            Math.max(5, Number(raw.clipDuration) || 15)
          );
          music = {
            id: String(raw.id || "").slice(0, 80),
            title: String(raw.title || raw.name || "").slice(0, 200),
            artist: String(raw.artist || "").slice(0, 200),
            thumbnail: String(raw.thumbnail || raw.artwork || "").slice(0, 500),
            artwork: String(raw.artwork || raw.thumbnail || "").slice(0, 500),
            audioUrl: String(raw.audioUrl || "").slice(0, 2000),
            duration: Math.max(0, Number(raw.duration) || 0),
            quality: String(raw.quality || "").slice(0, 40),
            sourceUrl: String(raw.sourceUrl || "").slice(0, 500),
            startOffset,
            clipStart: startOffset,
            clipDuration,
            backgroundTheme: String(raw.backgroundTheme || "purple").slice(0, 50),
            stickerStyle: String(raw.stickerStyle || "classic").slice(0, 50),
            layoutStyle: String(raw.layoutStyle || "style1").slice(0, 50),
            sticker: {
              x: Math.min(1, Math.max(0, Number(raw.sticker?.x) ?? 0.5)),
              y: Math.min(1, Math.max(0, Number(raw.sticker?.y) ?? 0.72)),
              scale: Math.min(2.5, Math.max(0.6, Number(raw.sticker?.scale) ?? 1)),
              rotation: Number(raw.sticker?.rotation) || 0,
              theme: raw.sticker?.theme || raw.stickerStyle || "classic",
            },
          };
        }
      } catch (e) {
        console.warn("Invalid music payload on status upload:", e.message);
      }
    }

    // Parse Mentions (@username)
    let mentions = [];
    if (req.body.mentions) {
      try {
        const rawM = typeof req.body.mentions === "string" ? JSON.parse(req.body.mentions) : req.body.mentions;
        if (Array.isArray(rawM)) {
          const seen = new Set();
          for (const m of rawM) {
            const uId = String(m.userId || "").trim();
            if (uId && !seen.has(uId) && mongoose.Types.ObjectId.isValid(uId)) {
              seen.add(uId);
              mentions.push({
                userId: uId,
                username: String(m.username || "").slice(0, 50),
                displayName: String(m.displayName || "").slice(0, 100),
                x: Math.min(1, Math.max(0, Number(m.x) ?? 0.5)),
                y: Math.min(1, Math.max(0, Number(m.y) ?? 0.5)),
                scale: Math.min(2.5, Math.max(0.5, Number(m.scale) ?? 1)),
                rotation: Number(m.rotation) || 0,
                style: String(m.style || "default").slice(0, 30),
              });
            }
          }
        }
      } catch (e) {
        console.warn("Invalid mentions payload:", e.message);
      }
    }

    // Parse Re-Story
    let restory = undefined;
    if (req.body.restory) {
      try {
        const rawR = typeof req.body.restory === "string" ? JSON.parse(req.body.restory) : req.body.restory;
        if (rawR?.originalStatusId && mongoose.Types.ObjectId.isValid(rawR.originalStatusId)) {
          restory = {
            originalStatusId: rawR.originalStatusId,
            originalUserId: rawR.originalUserId,
            originalUsername: String(rawR.originalUsername || ""),
            originalDisplayName: String(rawR.originalDisplayName || ""),
            originalMediaUrl: String(rawR.originalMediaUrl || ""),
            originalMediaType: String(rawR.originalMediaType || "image"),
            originalThumbnailUrl: String(rawR.originalThumbnailUrl || ""),
          };
        }
      } catch (e) {
        console.warn("Invalid restory payload:", e.message);
      }
    }

    if (!media && !music && !restory) {
      return res.status(400).json({ error: "Media file, Music selection, or Re-Story is required" });
    }

    const privacy = req.body.privacy || "contacts";
    const allowedPrivacy = ["everyone", "contacts", "contacts_except", "only_share_with"];
    if (!allowedPrivacy.includes(privacy)) {
      return res.status(400).json({ error: "Invalid privacy setting" });
    }

    const caption = String(req.body.caption || "").slice(0, 500);
    const excludedUserIds = privacy === "contacts_except" ? parseIdList(req.body.excludedUserIds) : [];
    const includedUserIds = privacy === "only_share_with" ? parseIdList(req.body.includedUserIds) : [];

    if (privacy === "only_share_with" && includedUserIds.length === 0) {
      return res.status(400).json({ error: "Select at least one contact to share with" });
    }

    let mediaType = "image";
    let mediaUrl = "";
    let thumbnailUrl = "";
    let publicId = "";
    let duration = Number(req.body.duration);

    if (restory) {
      mediaType = "restory";
      mediaUrl = restory.originalMediaUrl || "";
      thumbnailUrl = restory.originalThumbnailUrl || restory.originalMediaUrl || "";
      duration = IMAGE_DURATION;
    } else if (media) {
      assertMediaSize(media);
      const isVideo = media.mimetype.startsWith("video/");
      const isImage = media.mimetype.startsWith("image/");
      if (!isVideo && !isImage) {
        return res.status(400).json({ error: "Invalid media type" });
      }

      mediaType = isVideo ? "video" : "image";
      if (isImage) {
        duration = IMAGE_DURATION;
      } else {
        if (!Number.isFinite(duration) || duration <= 0) {
          return res.status(400).json({ error: "Video duration is required" });
        }
        duration = Math.min(MAX_DURATION, Math.ceil(duration * 10) / 10);
      }

      const resourceType = isVideo ? "video" : "image";
      const uploaded = await uploadBufferToCloudinary(media.buffer, {
        folder: "chatappey_status",
        resourceType,
        publicIdHint: media.originalname,
        mime: media.mimetype,
      });

      mediaUrl = uploaded.secure_url;
      publicId = uploaded.public_id;

      const thumbFile = req.files?.thumbnail?.[0];
      if (thumbFile) {
        assertMediaSize(thumbFile);
        const thumbUp = await uploadBufferToCloudinary(thumbFile.buffer, {
          folder: "chatappey_status/thumbs",
          resourceType: "image",
          publicIdHint: `thumb_${media.originalname}`,
          mime: thumbFile.mimetype,
        });
        thumbnailUrl = thumbUp.secure_url;
      } else if (isVideo) {
        thumbnailUrl = getDerivedThumbnailUrl(uploaded.public_id, "video");
      } else {
        thumbnailUrl = uploaded.secure_url;
      }
    } else {
      // Music-Only Story
      mediaType = "music";
      mediaUrl = music?.artwork || music?.thumbnail || "";
      thumbnailUrl = music?.artwork || music?.thumbnail || "";
      duration = music?.clipDuration || 15;
    }

    const now = new Date();
    // Image stories with music use the selected clip length (Instagram-like)
    if (mediaType === "image" && music?.clipDuration) {
      duration = Math.min(MAX_DURATION, Math.max(5, Number(music.clipDuration) || IMAGE_DURATION));
    }

    const status = await Status.create({
      userId: req.user._id,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      publicId,
      duration,
      caption,
      privacy,
      excludedUserIds,
      includedUserIds,
      viewers: [],
      mentions,
      expiresAt: new Date(now.getTime() + DAY_MS),
      ...(music ? { music } : {}),
      ...(restory ? { restory } : {}),
    });

    const populated = await Status.findById(status._id).populate(
      "userId",
      "fullName profilePic username"
    );

    // Live push to feed
    await broadcastStatusEvent("status:created", populated, req.user._id);

    // Dispatch Mention Notifications & Direct System Chat Messages
    if (mentions.length > 0) {
      const senderName = req.user.fullName || req.user.username || "Someone";
      for (const m of mentions) {
        const targetUserId = m.userId.toString();
        if (targetUserId === req.user._id.toString()) continue;

        // 1. Notification center
        try {
          const notif = await Notification.create({
            userId: targetUserId,
            type: "story_mention",
            fromUserId: req.user._id,
            statusId: status._id,
            message: `${senderName} mentioned you in a Story`,
          });
          const populatedNotif = await Notification.findById(notif._id).populate("fromUserId", "fullName profilePic email");
          const targetSid = getReceiverSocketId(targetUserId);
          if (targetSid) {
            io.to(targetSid).emit("new_notification", populatedNotif);
          }
        } catch (err) {
          console.error("Mention Notification error:", err.message);
        }

        // 2. Direct System Chat Message
        try {
          const chatMsg = await Message.create({
            senderId: req.user._id,
            receiverId: targetUserId,
            text: `📷 ${senderName} mentioned you in a Story`,
            messageType: "story_mention",
            storyRef: {
              statusId: status._id,
              mediaUrl: status.mediaUrl,
              mediaType: status.mediaType,
              caption: status.caption,
            },
          });

          const receiverSocketId = getReceiverSocketId(targetUserId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("new_message", chatMsg);
            io.to(receiverSocketId).emit("status:mentioned", {
              status: formatStatus(populated, targetUserId),
              sender: {
                _id: req.user._id,
                fullName: req.user.fullName,
                username: req.user.username,
                profilePic: req.user.profilePic,
              },
            });
          }
        } catch (err) {
          console.error("Mention Chat Message error:", err.message);
        }
      }
    }

    // Dispatch Re-Story Notification to original owner
    if (restory && restory.originalUserId) {
      const origOwnerId = restory.originalUserId.toString();
      if (origOwnerId !== req.user._id.toString()) {
        try {
          const reStoryName = req.user.fullName || req.user.username || "Someone";
          await Notification.create({
            userId: origOwnerId,
            type: "story_restory",
            fromUserId: req.user._id,
            statusId: status._id,
            message: `${reStoryName} added your Story to their Story`,
          });
          const ownerSocketId = getReceiverSocketId(origOwnerId);
          if (ownerSocketId) {
            io.to(ownerSocketId).emit("status:restoried", {
              statusId: status._id,
              restoriedBy: {
                _id: req.user._id,
                fullName: req.user.fullName,
                username: req.user.username,
                profilePic: req.user.profilePic,
              },
            });
          }
        } catch (err) {
          console.error("Re-Story Notification error:", err.message);
        }
      }
    }

    return res.status(201).json({
      status: formatStatus(populated, req.user._id),
      message: "Status uploaded",
    });
  } catch (error) {
    console.error("uploadStatus:", error.message);
    return res.status(500).json({ error: error.message || "Failed to upload status" });
  }
};

/**
 * GET /status — WhatsApp-style feed grouped by user
 */
export const getStatusFeed = async (req, res) => {
  try {
    const myId = req.user._id;
    const me = await User.findById(myId).select("friends blockedUsers");
    const myFriends = (me?.friends || []).map((id) => id.toString());
    const friendSet = new Set(myFriends);
    const blocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));

    const now = new Date();
    // Candidate: statuses from me + friends, plus "everyone" from any unblocked non-expired
    const statuses = await Status.find({
      expiresAt: { $gt: now },
      $or: [
        { userId: myId },
        { userId: { $in: me?.friends || [] } },
        { privacy: "everyone" },
        { privacy: "only_share_with", includedUserIds: myId },
      ],
    })
      .sort({ createdAt: 1 }) // chronological within user; newest groups sorted below
      .populate("userId", "fullName profilePic")
      .lean();

    const groupsMap = new Map();

    for (const st of statuses) {
      const ownerId = ownerIdOf(st);
      if (!ownerId) continue;
      if (blocked.has(ownerId) && ownerId !== myId.toString()) continue;
      if (!canViewerSeeStatus(st, myId, friendSet)) continue;

      const formatted = formatStatus(st, myId);
      const userDoc = st.userId?._id ? st.userId : { _id: st.userId };
      if (!groupsMap.has(ownerId)) {
        groupsMap.set(ownerId, {
          user: {
            _id: userDoc._id || ownerId,
            fullName: userDoc.fullName || "User",
            profilePic: userDoc.profilePic || "",
          },
          isOwn: ownerId === myId.toString(),
          statuses: [],
          hasUnseen: false,
          latestAt: st.createdAt,
        });
      }
      const g = groupsMap.get(ownerId);
      g.statuses.push(formatted);
      if (new Date(st.createdAt) > new Date(g.latestAt)) g.latestAt = st.createdAt;
    }

    // Compute unseen after all statuses collected
    for (const g of groupsMap.values()) {
      g.hasUnseen = !g.isOwn && g.statuses.some((s) => !s.viewed);
    }

    // Own first, then unseen, then by latest
    const feed = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.isOwn && !b.isOwn) return -1;
      if (!a.isOwn && b.isOwn) return 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return new Date(b.latestAt) - new Date(a.latestAt);
    });

    const myGroup = feed.find((g) => g.isOwn) || null;

    return res.status(200).json({ feed, myStatus: myGroup });
  } catch (error) {
    console.error("getStatusFeed:", error.message);
    return res.status(500).json({ error: "Failed to load status feed" });
  }
};

/**
 * GET /status/:userId — all active statuses for one user (if allowed)
 */
export const getUserStatuses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const myId = req.user._id;
    const me = await User.findById(myId).select("friends blockedUsers");
    const friendSet = new Set((me?.friends || []).map((id) => id.toString()));
    if ((me?.blockedUsers || []).some((id) => id.toString() === userId) && userId !== myId.toString()) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const statuses = await Status.find({
      userId,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 })
      .populate("userId", "fullName profilePic")
      .lean();

    const visible = statuses
      .filter((st) => canViewerSeeStatus(st, myId, friendSet))
      .map((st) => formatStatus(st, myId));

    if (visible.length === 0 && userId !== myId.toString()) {
      return res.status(404).json({ error: "No statuses found" });
    }

    const user =
      visible[0]?.userId ||
      (await User.findById(userId).select("fullName profilePic").lean());

    return res.status(200).json({
      user: user?._id
        ? { _id: user._id || user, fullName: user.fullName, profilePic: user.profilePic || "" }
        : null,
      statuses: visible,
    });
  } catch (error) {
    console.error("getUserStatuses:", error.message);
    return res.status(500).json({ error: "Failed to load statuses" });
  }
};

/**
 * DELETE /status/:id
 */
export const deleteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid status id" });
    }

    const status = await Status.findById(id);
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (status.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not allowed to delete this status" });
    }

    await destroyCloudinaryAsset(
      status.publicId,
      status.mediaType === "video" ? "video" : "image"
    );

    const ownerId = status.userId;
    const snapshot = status.toObject();
    await status.deleteOne();

    await broadcastStatusEvent("status:deleted", snapshot, ownerId);

    return res.status(200).json({ message: "Status deleted", id });
  } catch (error) {
    console.error("deleteStatus:", error.message);
    return res.status(500).json({ error: "Failed to delete status" });
  }
};

/**
 * POST /status/view/:id — record a unique view
 */
export const viewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid status id" });
    }

    const myId = req.user._id;
    const status = await Status.findById(id);
    if (!status || status.expiresAt <= new Date()) {
      return res.status(404).json({ error: "Status not found or expired" });
    }

    // Don't count own views
    if (status.userId.toString() === myId.toString()) {
      return res.status(200).json({ viewed: true, own: true });
    }

    const me = await User.findById(myId).select("friends");
    const friendSet = new Set((me?.friends || []).map((id) => id.toString()));
    if (!canViewerSeeStatus(status, myId, friendSet)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const alreadyIndex = status.viewers.findIndex((v) => v.userId.toString() === myId.toString());
    const now = new Date();

    if (alreadyIndex >= 0) {
      // Update last viewed time if already exists
      status.viewers[alreadyIndex].viewedAt = now;
      await status.save();
      return res.status(200).json({
        viewed: true,
        viewerCount: status.viewers.length,
        duplicate: true,
      });
    }

    // New unique view
    status.viewers.push({ userId: myId, viewedAt: now });
    await status.save();

    // Check if viewer has a reaction on this status
    const existingReaction = (status.reactions || []).find(
      (r) => (r.userId?._id || r.userId)?.toString() === myId.toString()
    );

    // Notify status owner live via socket.io (ONLY owner receives this!)
    const ownerIdStr = status.userId.toString();
    const ownerSocketId = getReceiverSocketId(ownerIdStr);

    if (ownerSocketId) {
      const viewerUser = await User.findById(myId)
        .select("fullName username profilePic")
        .lean();

      const viewerData = viewerUser
        ? {
            user: {
              _id: viewerUser._id.toString(),
              fullName: viewerUser.fullName,
              username: viewerUser.username || "",
              profilePic: viewerUser.profilePic || "",
            },
            viewedAt: now.toISOString(),
            reaction: existingReaction ? existingReaction.emoji : null,
          }
        : null;

      const viewPayload = {
        storyId: status._id.toString(),
        statusId: status._id.toString(),
        viewerId: myId.toString(),
        viewerName: viewerUser?.fullName || "User",
        viewerUsername: viewerUser?.username || "",
        viewerAvatar: viewerUser?.profilePic || "",
        viewedAt: now.toISOString(),
        storyOwnerId: ownerIdStr,
        viewerCount: status.viewers.length,
        viewer: viewerData,
      };

      // Emit both story:viewed and status:viewed strictly to story owner
      io.to(ownerSocketId).emit("story:viewed", viewPayload);
      io.to(ownerSocketId).emit("status:viewed", viewPayload);
    }

    return res.status(200).json({
      viewed: true,
      viewerCount: status.viewers.length,
      duplicate: false,
    });
  } catch (error) {
    console.error("viewStatus:", error.message);
    return res.status(500).json({ error: "Failed to record view" });
  }
};

/**
 * GET /status/viewers/:id — owner only
 */
export const getStatusViewers = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid status id" });
    }

    const status = await Status.findById(id)
      .populate("viewers.userId", "fullName username profilePic")
      .lean();

    if (!status) return res.status(404).json({ error: "Status not found" });
    if (ownerIdOf(status) !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only the owner can see viewers" });
    }

    const reactionMap = new Map(
      (status.reactions || []).map((r) => [
        (r.userId?._id || r.userId).toString(),
        r.emoji,
      ])
    );

    const viewers = (status.viewers || [])
      .filter((v) => v.userId)
      .map((v) => ({
        user: {
          _id: v.userId._id,
          fullName: v.userId.fullName,
          username: v.userId.username || "",
          profilePic: v.userId.profilePic || "",
        },
        viewedAt: v.viewedAt,
        reaction: reactionMap.get(v.userId._id.toString()) || null,
      }))
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

    return res.status(200).json({ viewers, count: viewers.length });
  } catch (error) {
    console.error("getStatusViewers:", error.message);
    return res.status(500).json({ error: "Failed to load viewers" });
  }
};

const ALLOWED_STATUS_EMOJIS = new Set(["❤️", "😂", "🔥", "😍", "👍", "👏", "😢", "😮"]);

/**
 * POST /status/:id/like — toggle like
 */
export const toggleStatusLike = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid status id" });
    }
    const status = await Status.findById(id).populate("userId", "fullName profilePic");
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (new Date(status.expiresAt) <= new Date()) {
      return res.status(410).json({ error: "Status expired" });
    }

    const uid = req.user._id.toString();
    const idx = (status.likes || []).findIndex(
      (l) => (l.userId?._id || l.userId)?.toString() === uid
    );
    let liked = false;
    if (idx >= 0) {
      status.likes.splice(idx, 1);
    } else {
      status.likes.push({ userId: req.user._id, likedAt: new Date() });
      liked = true;
    }
    await status.save();

    const formatted = formatStatus(status, req.user._id);
    const likerUser = {
      _id: req.user._id,
      fullName: req.user.fullName,
      profilePic: req.user.profilePic || "",
    };
    const payload = {
      statusId: status._id.toString(),
      likeCount: status.likes.length,
      liked,
      userId: uid,
      liker: liked
        ? { user: likerUser, likedAt: new Date() }
        : { user: likerUser, removed: true },
      status: formatted,
    };
    // Notify owner + liker with a consistent, parseable payload (don't reuse create-style broadcast)
    const ownerSid = getReceiverSocketId(ownerIdOf(status));
    if (ownerSid) io.to(ownerSid).emit("status:liked", payload);
    const mySid = getReceiverSocketId(uid);
    if (mySid && mySid !== ownerSid) io.to(mySid).emit("status:liked", payload);

    return res.status(200).json({
      liked,
      likeCount: status.likes.length,
      status: formatted,
    });
  } catch (error) {
    console.error("toggleStatusLike:", error.message);
    return res.status(500).json({ error: "Failed to like status" });
  }
};

/**
 * POST /status/:id/react — set or change emoji reaction (one per user)
 */
export const reactToStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid status id" });
    }
    if (!ALLOWED_STATUS_EMOJIS.has(emoji)) {
      return res.status(400).json({ error: "Invalid reaction emoji" });
    }

    const status = await Status.findById(id).populate("userId", "fullName profilePic");
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (new Date(status.expiresAt) <= new Date()) {
      return res.status(410).json({ error: "Status expired" });
    }

    const uid = req.user._id.toString();
    const idx = (status.reactions || []).findIndex(
      (r) => (r.userId?._id || r.userId)?.toString() === uid
    );

    let myReaction = emoji;
    if (idx >= 0) {
      if (status.reactions[idx].emoji === emoji) {
        status.reactions.splice(idx, 1);
        myReaction = null;
      } else {
        status.reactions[idx].emoji = emoji;
        status.reactions[idx].reactedAt = new Date();
      }
    } else {
      status.reactions.push({ userId: req.user._id, emoji, reactedAt: new Date() });
    }
    await status.save();

    const formatted = formatStatus(status, req.user._id);
    const reactorUser = {
      _id: req.user._id,
      fullName: req.user.fullName,
      profilePic: req.user.profilePic || "",
    };
    const payload = {
      statusId: status._id.toString(),
      myReaction,
      userId: uid,
      reactor: myReaction
        ? { user: reactorUser, emoji: myReaction, reactedAt: new Date() }
        : { user: reactorUser, emoji: null, removed: true },
      status: formatted,
    };
    const ownerSid = getReceiverSocketId(ownerIdOf(status));
    if (ownerSid) io.to(ownerSid).emit("status:reacted", payload);
    const mySid = getReceiverSocketId(uid);
    if (mySid && mySid !== ownerSid) io.to(mySid).emit("status:reacted", payload);

    return res.status(200).json({
      myReaction,
      status: formatted,
    });
  } catch (error) {
    console.error("reactToStatus:", error.message);
    return res.status(500).json({ error: "Failed to react" });
  }
};

/**
 * POST /status/:id/comment
 */
export const commentOnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, replyTo, mentions } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid status id" });
    }
    const cleaned = (text || "").trim();
    if (!cleaned) return res.status(400).json({ error: "Comment text required" });
    if (cleaned.length > 500) return res.status(400).json({ error: "Comment too long" });

    const status = await Status.findById(id).populate("userId", "fullName profilePic");
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (new Date(status.expiresAt) <= new Date()) {
      return res.status(410).json({ error: "Status expired" });
    }

    const comment = {
      userId: req.user._id,
      text: cleaned,
      replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null,
      mentions: Array.isArray(mentions)
        ? mentions.filter((m) => mongoose.Types.ObjectId.isValid(m))
        : [],
      createdAt: new Date(),
    };
    status.comments.push(comment);
    await status.save();

    const populated = await Status.findById(id)
      .populate("userId", "fullName profilePic")
      .populate("comments.userId", "fullName profilePic")
      .populate("comments.mentions", "fullName profilePic");

    const saved = populated.comments[populated.comments.length - 1];
    const payload = {
      statusId: id,
      comment: saved,
      commentCount: populated.comments.length,
    };
    const ownerSid = getReceiverSocketId(ownerIdOf(status));
    if (ownerSid) io.to(ownerSid).emit("status:commented", payload);
    const mySid = getReceiverSocketId(req.user._id.toString());
    if (mySid) io.to(mySid).emit("status:commented", payload);

    return res.status(201).json(payload);
  } catch (error) {
    console.error("commentOnStatus:", error.message);
    return res.status(500).json({ error: "Failed to comment" });
  }
};

/**
 * DELETE /status/:id/comment/:commentId
 */
export const deleteStatusComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const status = await Status.findById(id);
    if (!status) return res.status(404).json({ error: "Status not found" });

    const comment = status.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const isOwner = ownerIdOf(status) === req.user._id.toString();
    const isAuthor = comment.userId.toString() === req.user._id.toString();
    if (!isOwner && !isAuthor) {
      return res.status(403).json({ error: "Not allowed" });
    }

    comment.deleteOne();
    await status.save();

    const payload = {
      statusId: id,
      commentId,
      commentCount: status.comments.length,
    };
    io.emit("status:commentDeleted", payload); // scoped via client filter if needed
    const ownerSid = getReceiverSocketId(ownerIdOf(status));
    if (ownerSid) io.to(ownerSid).emit("status:commentDeleted", payload);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("deleteStatusComment:", error.message);
    return res.status(500).json({ error: "Failed to delete comment" });
  }
};

/**
 * GET /status/:id/comments
 */
export const getStatusComments = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await Status.findById(id)
      .populate("comments.userId", "fullName profilePic")
      .populate("comments.mentions", "fullName profilePic")
      .lean();
    if (!status) return res.status(404).json({ error: "Status not found" });

    return res.status(200).json({
      comments: (status.comments || []).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ),
      count: (status.comments || []).length,
    });
  } catch (error) {
    console.error("getStatusComments:", error.message);
    return res.status(500).json({ error: "Failed to load comments" });
  }
};

/**
 * GET /status/:id/engagement — owner: likes + reactions detail
 */
export const getStatusEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await Status.findById(id)
      .populate("likes.userId", "fullName profilePic")
      .populate("reactions.userId", "fullName profilePic")
      .lean();
    if (!status) return res.status(404).json({ error: "Status not found" });
    if (ownerIdOf(status) !== req.user._id.toString()) {
      return res.status(403).json({ error: "Only owner can view engagement" });
    }

    return res.status(200).json({
      likes: (status.likes || [])
        .filter((l) => l.userId)
        .map((l) => ({
          user: {
            _id: l.userId._id,
            fullName: l.userId.fullName,
            profilePic: l.userId.profilePic || "",
          },
          likedAt: l.likedAt,
        })),
      reactions: (status.reactions || [])
        .filter((r) => r.userId)
        .map((r) => ({
          user: {
            _id: r.userId._id,
            fullName: r.userId.fullName,
            profilePic: r.userId.profilePic || "",
          },
          emoji: r.emoji,
          reactedAt: r.reactedAt,
        })),
      likeCount: (status.likes || []).length,
      reactionCount: (status.reactions || []).length,
      commentCount: (status.comments || []).length,
    });
  } catch (error) {
    console.error("getStatusEngagement:", error.message);
    return res.status(500).json({ error: "Failed to load engagement" });
  }
};

/** Cron: purge expired statuses + Cloudinary assets */
export const cleanupExpiredStatuses = async () => {
  const expired = await Status.find({ expiresAt: { $lte: new Date() } })
    .select("publicId mediaType")
    .limit(200)
    .lean();

  for (const st of expired) {
    await destroyCloudinaryAsset(
      st.publicId,
      st.mediaType === "video" ? "video" : "image"
    );
  }

  if (expired.length) {
    await Status.deleteMany({
      _id: { $in: expired.map((s) => s._id) },
    });
  }

  return expired.length;
};
