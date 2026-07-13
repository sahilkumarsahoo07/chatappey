import { memo, useMemo, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import { Check, CheckCheck, Clock, Info, X } from "lucide-react";
import { formatMessageTime } from "../../lib/utils";
import { isMessageDeleted } from "../../lib/messageDelete";
import defaultAvatar from "../../public/avatar.png";

function personId(raw) {
  return String(
    raw?._id ||
      raw?.userId?._id ||
      raw?.userId ||
      raw?.user?._id ||
      raw?.user ||
      raw ||
      ""
  );
}

function messagePreviewText(msg) {
  if (!msg) return "Message";
  if (isMessageDeleted(msg)) return "This message was deleted";
  if (msg.text) return msg.text;
  if (msg.image) return "Photo";
  if (msg.video) return "Video";
  if (msg.audio) return "Audio";
  if (msg.poll) return "Poll";
  if (msg.file) return msg.fileName || "File";
  return "Message";
}

function StatusIcon({ status, className = "w-3.5 h-3.5" }) {
  if (status === "read") {
    return <CheckCheck className={`${className} text-sky-500`} />;
  }
  if (status === "delivered") {
    return <CheckCheck className={`${className} text-base-content/50`} />;
  }
  if (status === "pending") {
    return <Clock className={`${className} opacity-70`} />;
  }
  return <Check className={`${className} text-base-content/50`} />;
}

function MemberRow({ person, myId, subtitle, subtitleClass }) {
  const name =
    person._id === myId ? "You" : person.fullName || "Member";
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-base-200/50">
      <img
        src={person.profilePic || defaultAvatar}
        alt={name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {subtitle && (
          <div className={`flex items-center gap-1 text-xs ${subtitleClass || ""}`}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * WhatsApp-style Message Info for group messages.
 * Works for both own and received messages; updates live via parent state.
 */
function GroupMessageInfoDialog({
  open,
  messageId,
  messages = [],
  members = [],
  authUser,
  groupId,
  onRefreshInfo,
  onClose,
}) {
  const myId = String(authUser?._id || "");

  // Pull latest receipts from server whenever Message Info opens
  useEffect(() => {
    if (!open || !groupId || !messageId || !onRefreshInfo) return;
    onRefreshInfo(groupId, messageId);
    const t = setInterval(() => {
      onRefreshInfo(groupId, messageId);
    }, 4000);
    return () => clearInterval(t);
  }, [open, groupId, messageId, onRefreshInfo]);

  const msg = useMemo(() => {
    if (!messageId) return null;
    const id = String(messageId);
    return (
      messages.find(
        (m) =>
          String(m._id) === id ||
          String(m.realId) === id ||
          String(m.optimisticId) === id ||
          String(m.clientMessageId) === id
      ) || null
    );
  }, [messages, messageId]);

  const info = useMemo(() => {
    if (!msg) return null;

    const senderId = personId(msg.senderId);
    const isMine = senderId === myId && !!myId;
    const sender =
      typeof msg.senderId === "object" && msg.senderId
        ? {
            _id: senderId,
            fullName: msg.senderId.fullName || "Member",
            profilePic: msg.senderId.profilePic || "",
          }
        : members
            .map((m) => m.user || m)
            .map((u) => ({
              _id: personId(u),
              fullName: u?.fullName || "Member",
              profilePic: u?.profilePic || "",
            }))
            .find((u) => u._id === senderId) || {
            _id: senderId,
            fullName: "Member",
            profilePic: "",
          };

    const resolveMember = (raw, extra = {}) => {
      const id = personId(raw);
      if (!id || id === "undefined" || id === "null") return null;

      if (
        raw &&
        typeof raw === "object" &&
        (raw.fullName ||
          raw.userId?.fullName ||
          raw.profilePic ||
          raw.userId?.profilePic)
      ) {
        return {
          _id: id,
          fullName: raw.fullName || raw.userId?.fullName || "Member",
          profilePic: raw.profilePic || raw.userId?.profilePic || "",
          deliveredAt: raw.deliveredAt || extra.deliveredAt || null,
          readAt: raw.readAt || extra.readAt || null,
        };
      }

      const member = members.find(
        (m) => personId(m.user || m) === id
      );
      const user = member?.user;
      if (user && typeof user === "object") {
        return {
          _id: id,
          fullName: user.fullName || "Member",
          profilePic: user.profilePic || "",
          deliveredAt: raw?.deliveredAt || extra.deliveredAt || null,
          readAt: raw?.readAt || extra.readAt || null,
        };
      }

      if (id === myId) {
        return {
          _id: myId,
          fullName: authUser?.fullName || "You",
          profilePic: authUser?.profilePic || "",
          deliveredAt: raw?.deliveredAt || extra.deliveredAt || null,
          readAt: raw?.readAt || extra.readAt || null,
        };
      }

      return {
        _id: id,
        fullName: "Member",
        profilePic: "",
        deliveredAt: raw?.deliveredAt || extra.deliveredAt || null,
        readAt: raw?.readAt || extra.readAt || null,
      };
    };

    const otherMembers = members
      .map((m) => resolveMember(m.user || m))
      .filter((m) => m && m._id !== senderId);

    const readMap = new Map();
    for (const r of msg.readReceipts || []) {
      const person = resolveMember(r.userId || r, { readAt: r.readAt });
      if (!person || person._id === senderId) continue;
      readMap.set(person._id, {
        ...person,
        readAt: r.readAt || person.readAt,
      });
    }
    for (const r of msg.readBy || []) {
      const person = resolveMember(r);
      if (!person || person._id === senderId || readMap.has(person._id)) continue;
      readMap.set(person._id, person);
    }

    const deliveredMap = new Map();
    for (const d of msg.deliveredTo || []) {
      const person = resolveMember(d.userId || d, {
        deliveredAt: d.deliveredAt,
      });
      if (!person || person._id === senderId) continue;
      deliveredMap.set(person._id, {
        ...person,
        deliveredAt: d.deliveredAt || person.deliveredAt,
      });
    }
    for (const [id, reader] of readMap) {
      if (!deliveredMap.has(id)) {
        deliveredMap.set(id, {
          ...reader,
          deliveredAt: reader.readAt || reader.deliveredAt,
        });
      }
    }

    const myDelivery = deliveredMap.get(myId) || null;
    const myRead = readMap.get(myId) || null;

    return {
      isMine,
      sender,
      senderId,
      otherMembers,
      recipientTotal: otherMembers.length,
      readByList: [...readMap.values()],
      deliveredOnlyList: [...deliveredMap.values()].filter(
        (d) => !readMap.has(d._id)
      ),
      pendingList: otherMembers.filter(
        (m) => !deliveredMap.has(m._id) && !readMap.has(m._id)
      ),
      deliveredCount: deliveredMap.size,
      readCount: readMap.size,
      myDelivery,
      myRead,
      deleted: isMessageDeleted(msg),
      edited: !!msg.isEdited,
      status: msg.status || (msg.pending ? "pending" : "sent"),
      sentAt: msg.createdAt ? formatMessageTime(msg.createdAt) : null,
      sentAtFull: msg.createdAt
        ? new Date(msg.createdAt).toLocaleString()
        : null,
    };
  }, [msg, members, myId, authUser]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        className: "bg-base-100",
        sx: { borderRadius: "12px", overflow: "hidden" },
      }}
    >
      <DialogTitle className="flex items-center justify-between border-b border-base-300 !py-3 !px-4 bg-base-100">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          <span className="text-base font-semibold">Message info</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogTitle>

      <DialogContent className="!p-0 bg-base-100">
        {!msg || !info ? (
          <p className="text-sm text-center py-8 text-base-content/50 px-4">
            Message not found. It may have been deleted or is still syncing.
          </p>
        ) : (
          <div>
            {/* Preview */}
            <div className="px-4 py-3 bg-base-200/60 border-b border-base-300">
              {!info.isMine && (
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={info.sender.profilePic || defaultAvatar}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {info.sender.fullName}
                    </p>
                    <p className="text-[11px] text-base-content/50">Sender</p>
                  </div>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  info.isMine
                    ? "ml-auto bg-primary text-primary-content"
                    : "bg-base-100 text-base-content"
                }`}
              >
                {msg.image && !info.deleted && (
                  <img
                    src={msg.image}
                    alt=""
                    className="max-h-24 rounded mb-1 object-cover"
                  />
                )}
                <p className="whitespace-pre-wrap break-words line-clamp-4">
                  {messagePreviewText(msg)}
                </p>
                {info.sentAt && (
                  <p className="text-[10px] opacity-70 text-right mt-1 flex items-center justify-end gap-1">
                    <span>{info.sentAt}</span>
                    {info.isMine && <StatusIcon status={info.status} />}
                  </p>
                )}
              </div>
            </div>

            {/* Meta for received / all */}
            <div className="px-4 py-3 border-b border-base-300 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-base-content/50">Sent</span>
                <span className="text-right font-medium">
                  {info.sentAtFull || info.sentAt || "—"}
                </span>
              </div>
              {!info.isMine && (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-base-content/50">Delivered to you</span>
                    <span className="text-right font-medium flex items-center gap-1 justify-end">
                      {info.myDelivery || info.myRead ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-base-content/50" />
                          {info.myDelivery?.deliveredAt
                            ? formatMessageTime(info.myDelivery.deliveredAt)
                            : "Yes"}
                        </>
                      ) : (
                        "Pending"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-base-content/50">Read by you</span>
                    <span className="text-right font-medium flex items-center gap-1 justify-end">
                      {info.myRead ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                          {info.myRead.readAt
                            ? formatMessageTime(info.myRead.readAt)
                            : "Yes"}
                        </>
                      ) : (
                        "Not yet"
                      )}
                    </span>
                  </div>
                </>
              )}
              {info.edited && (
                <div className="flex justify-between gap-3">
                  <span className="text-base-content/50">Edited</span>
                  <span className="font-medium">Yes</span>
                </div>
              )}
              {info.deleted && (
                <div className="flex justify-between gap-3">
                  <span className="text-base-content/50">Deleted</span>
                  <span className="font-medium text-error">Yes</span>
                </div>
              )}
            </div>

            {/* Live counts — available to all members */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-base-300 text-xs">
              <span className="text-base-content/60">
                Delivered{" "}
                <strong className="text-base-content">
                  {info.deliveredCount}/{info.recipientTotal || "—"}
                </strong>
              </span>
              <span className="text-base-content/60">
                Read{" "}
                <strong className="text-base-content">
                  {info.readCount}/{info.recipientTotal || "—"}
                </strong>
              </span>
            </div>

            {/* Read by */}
            <div className="px-2 pt-3 pb-1">
              <div className="flex items-center justify-between px-3 mb-1">
                <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                  Read by
                </h4>
                <span className="text-xs text-base-content/40">
                  {info.readByList.length}
                </span>
              </div>
              {info.readByList.length === 0 ? (
                <p className="text-sm text-base-content/50 px-3 py-3">
                  No one has read this message yet
                </p>
              ) : (
                <div className="divide-y divide-base-200">
                  {info.readByList.map((reader) => (
                    <MemberRow
                      key={reader._id}
                      person={reader}
                      myId={myId}
                      subtitleClass="text-sky-500"
                      subtitle={
                        <>
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>
                            {reader.readAt
                              ? formatMessageTime(reader.readAt)
                              : "Read"}
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Delivered to (not yet read) */}
            <div className="px-2 pt-2 pb-1 border-t border-base-300 mt-1">
              <div className="flex items-center justify-between px-3 mb-1 mt-2">
                <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                  Delivered to
                </h4>
                <span className="text-xs text-base-content/40">
                  {info.deliveredOnlyList.length}
                </span>
              </div>
              {info.deliveredOnlyList.length === 0 ? (
                <p className="text-sm text-base-content/50 px-3 py-3">
                  {info.readByList.length > 0
                    ? "Everyone who received it has also read it"
                    : "Waiting for delivery"}
                </p>
              ) : (
                <div className="divide-y divide-base-200">
                  {info.deliveredOnlyList.map((member) => (
                    <MemberRow
                      key={member._id}
                      person={member}
                      myId={myId}
                      subtitleClass="text-base-content/50"
                      subtitle={
                        <>
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>
                            {member.deliveredAt
                              ? formatMessageTime(member.deliveredAt)
                              : "Delivered"}
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pending */}
            {info.pendingList.length > 0 && (
              <div className="px-2 pt-2 pb-4 border-t border-base-300 mt-1">
                <div className="flex items-center justify-between px-3 mb-1 mt-2">
                  <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                    Pending
                  </h4>
                  <span className="text-xs text-base-content/40">
                    {info.pendingList.length}
                  </span>
                </div>
                <div className="divide-y divide-base-200">
                  {info.pendingList.map((member) => (
                    <MemberRow
                      key={member._id}
                      person={member}
                      myId={myId}
                      subtitleClass="text-base-content/40"
                      subtitle={<span>Not delivered yet</span>}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default memo(GroupMessageInfoDialog);
