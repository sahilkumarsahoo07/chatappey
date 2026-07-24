import { memo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, MessageCircle, Send, Smile, X, Trash2 } from "lucide-react";
import { STATUS_REACTION_EMOJIS } from "../../lib/statusApi";
import { haptic } from "../../lib/haptics";
import { formatStatusTime } from "../../hooks/useStoryProgress";
import defaultImg from "../../public/avatar.png";

/**
 * Bottom engagement bar for story viewer: like, react, comment.
 */
const StatusEngagementBar = memo(function StatusEngagementBar({
  status,
  isOwn,
  authUserId,
  onLike,
  onReact,
  onLoadComments,
  onAddComment,
  onDeleteComment,
  paused,
  setPaused,
}) {
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);

  const openComments = useCallback(async () => {
    setShowReactPicker(false);
    setShowComments(true);
    setPaused?.(true);
    setLoadingComments(true);
    const list = await onLoadComments?.(status._id);
    setComments(list || []);
    setLoadingComments(false);
  }, [onLoadComments, status._id, setPaused]);

  useEffect(() => {
    if (showReactPicker || showComments) {
      setPaused?.(true);
    }
  }, [showReactPicker, showComments, setPaused]);

  useEffect(() => {
    // Only resume when both overlays are closed
    if (!showComments && !showReactPicker) {
      setPaused?.(false);
    }
  }, [showComments, showReactPicker, setPaused]);

  const handleLike = async () => {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 600);
    await onLike?.(status._id);
  };

  const handleReact = async (emoji) => {
    await onReact?.(status._id, emoji);
    setShowReactPicker(false);
  };

  const submitComment = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    const comment = await onAddComment?.(status._id, text.trim(), replyTo?._id);
    if (comment) {
      setComments((prev) => [...prev, comment]);
      setText("");
      setReplyTo(null);
    }
  };

  if (!status) return null;

  if (isOwn) {
    return (
      <div className="absolute bottom-0 inset-x-0 z-30 pb-[max(12px,env(safe-area-inset-bottom))] px-4 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between text-white/90 text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 fill-current text-rose-400" />
              {status.likeCount || 0}
            </span>
            <button
              type="button"
              className="flex items-center gap-1.5"
              onClick={openComments}
            >
              <MessageCircle className="w-4 h-4" />
              {status.commentCount || 0}
            </button>
          </div>
        </div>
        {showComments &&
          createPortal(
            <CommentsSheet
              comments={comments}
              loading={loadingComments}
              text={text}
              setText={setText}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onSubmit={submitComment}
              onClose={() => setShowComments(false)}
              authUserId={authUserId}
              isOwner
              onDelete={async (cid) => {
                const ok = await onDeleteComment?.(status._id, cid);
                if (ok) setComments((c) => c.filter((x) => x._id !== cid));
              }}
            />,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 inset-x-0 z-50 pb-[max(12px,env(safe-area-inset-bottom))] px-3 pt-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
      {status.caption && !showComments && (
        <p className="text-center text-sm text-white/95 mb-3 px-2 drop-shadow">{status.caption}</p>
      )}

      {!showComments && (
        <>
          <div className="flex items-center gap-2 relative" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          className="relative w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Like"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              status.likedByMe ? "fill-rose-500 text-rose-500" : "text-white"
            }`}
          />
          {heartBurst && (
            <span className="absolute text-3xl animate-[heartBurst_0.6s_ease-out_forwards]">❤️</span>
          )}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              haptic("selection");
              setShowReactPicker((v) => !v);
            }}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center active:scale-90 transition-transform text-white"
            aria-label="React"
          >
            {status.myReaction || <Smile className="w-5 h-5" />}
          </button>
          {showReactPicker && (
            <div className="absolute bottom-14 left-0 flex gap-1 p-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl animate-[chatSearchIn_0.18s_ease-out]">
              {STATUS_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(emoji)}
                  className={`w-10 h-10 text-xl rounded-full hover:bg-white/10 hover:scale-125 transition-transform ${
                    status.myReaction === emoji ? "bg-white/20 scale-110" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openComments();
          }}
          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
          aria-label="Comments"
        >
          <MessageCircle className="w-5 h-5" />
        </button>

        <form
          onSubmit={submitComment}
          className="flex-1 flex items-center gap-2 min-w-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setPaused?.(true)}
            onBlur={() => {
              if (!showComments && !showReactPicker) setPaused?.(false);
            }}
            placeholder="Send message…"
            className="flex-1 min-w-0 h-11 px-4 rounded-full bg-white/10 text-white text-sm placeholder:text-white/45 outline-none border border-white/10 focus:border-white/30"
            maxLength={500}
          />
          {text.trim() && (
            <button
              type="submit"
              className="w-11 h-11 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {(status.likeCount > 0 || status.commentCount > 0) && (
        <p className="text-[11px] text-white/50 mt-2 px-1">
          {status.likeCount || 0} likes · {status.commentCount || 0} comments
        </p>
      )}
        </>
      )}

      {showComments &&
        createPortal(
          <CommentsSheet
            comments={comments}
            loading={loadingComments}
            text={text}
            setText={setText}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            onSubmit={submitComment}
            onClose={() => setShowComments(false)}
            authUserId={authUserId}
            onDelete={async (cid) => {
              const ok = await onDeleteComment?.(status._id, cid);
              if (ok) setComments((c) => c.filter((x) => x._id !== cid));
            }}
          />,
          document.body
        )}

      <style>{`
        @keyframes heartBurst {
          0% { opacity: 0; transform: scale(0.4); }
          40% { opacity: 1; transform: scale(1.3); }
          100% { opacity: 0; transform: translateY(-28px) scale(1); }
        }
      `}</style>
    </div>
  );
});

function commentAuthor(c) {
  const u = c?.userId;
  if (u && typeof u === "object") {
    return {
      _id: u._id,
      fullName: u.fullName || "User",
      profilePic: u.profilePic || "",
    };
  }
  return { _id: u, fullName: "User", profilePic: "" };
}

function CommentsSheet({
  comments,
  loading,
  text,
  setText,
  replyTo,
  setReplyTo,
  onSubmit,
  onClose,
  authUserId,
  isOwner,
  onDelete,
}) {
  return (
    <div className="fixed inset-0 z-[220] flex items-end pointer-events-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-h-[55vh] bg-base-100 rounded-t-3xl flex flex-col animate-[statusSheetUp_0.22s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <h3 className="font-bold">Comments</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-base-200">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="py-8 flex justify-center">
              <span className="loading loading-spinner" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm opacity-50 py-8">No comments yet</p>
          ) : (
            <ul className="divide-y divide-base-200/70">
              {comments.map((c) => {
                const author = commentAuthor(c);
                const uid = author._id?.toString?.() || author._id;
                const canDelete = isOwner || uid === authUserId?.toString?.();
                return (
                  <li key={c._id} className="flex gap-3 py-3 first:pt-1">
                    <img
                      src={author.profilePic || defaultImg}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-base-300/40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{author.fullName}</p>
                        <span className="text-[10px] text-base-content/40 shrink-0">
                          {formatStatusTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 break-words leading-relaxed">{c.text}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <button
                          type="button"
                          className="text-[11px] font-medium text-base-content/45 hover:text-primary"
                          onClick={() => setReplyTo(c)}
                        >
                          Reply
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-error/80 hover:text-error"
                            onClick={() => onDelete?.(c._id)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <form
          onSubmit={onSubmit}
          className="p-3 border-t border-base-200 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {replyTo && (
            <button type="button" className="text-xs text-primary shrink-0" onClick={() => setReplyTo(null)}>
              @{replyTo.userId?.fullName?.split(" ")[0] || "reply"} ×
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className="input input-sm input-bordered flex-1 rounded-full"
            maxLength={500}
          />
          <button type="submit" className="btn btn-sm btn-primary btn-circle" disabled={!text.trim()}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default StatusEngagementBar;
