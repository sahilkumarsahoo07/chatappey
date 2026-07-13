import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Download,
  Forward,
  Info,
  MoreVertical,
  Pencil,
  Pin,
  Reply,
  Star,
  Trash2,
} from "lucide-react";
import { isMessageDeleted } from "../lib/messageDelete";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

/**
 * WhatsApp-style message actions:
 * - Desktop: floating card beside the 3-dot
 * - Mobile: bottom sheet with reaction row + actions
 */
const MessageActionMenu = ({
  open,
  onClose,
  anchorEl,
  isMine = false,
  actions = [],
  showReactions = false,
  onReact,
  isMobileSheet = false,
}) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const position = useMemo(() => {
    if (!anchorEl || typeof window === "undefined") {
      return { top: 80, left: 16 };
    }
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 56 + actions.length * 48 + (showReactions ? 56 : 0);
    let top = rect.bottom + 8;
    let left = isMine ? rect.right - menuWidth : rect.left;

    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - menuHeight - 8);
    }
    return { top, left };
  }, [anchorEl, actions.length, showReactions, isMine, open]);

  if (!open) return null;

  const useSheet = isMobileSheet || isMobile;

  const run = (fn) => {
    onClose();
    if (typeof fn === "function") fn();
  };

  const content = useSheet ? (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-lg bg-base-100 rounded-t-3xl shadow-2xl border border-base-200/80 pb-[max(1rem,env(safe-area-inset-bottom))] animate-[msgSheetIn_0.22s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        {showReactions && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between gap-1 rounded-full bg-base-200/80 px-2 py-2 shadow-sm border border-base-300/50">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex-1 h-11 rounded-full text-2xl active:scale-110 transition-transform hover:bg-base-100"
                  onClick={() => run(() => onReact?.(emoji))}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-2 pb-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={() => run(action.onClick)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-colors active:scale-[0.99]
                ${action.danger
                  ? "text-error hover:bg-error/10"
                  : "text-base-content hover:bg-base-200/80"
                }
                ${action.disabled ? "opacity-40 pointer-events-none" : ""}`}
            >
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  action.danger ? "bg-error/10 text-error" : "bg-base-200 text-base-content/80"
                }`}
              >
                {action.icon}
              </span>
              <span className="font-semibold text-[15px]">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-[120]" onClick={onClose}>
      <div
        className="absolute min-w-[200px] max-w-[240px] rounded-2xl bg-base-100/95 backdrop-blur-xl border border-base-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.16)] overflow-hidden animate-[msgMenuIn_0.16s_ease-out]"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {showReactions && (
          <div className="flex items-center justify-between gap-0.5 px-2 py-2 border-b border-base-200/70 bg-base-200/30">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="w-8 h-8 rounded-full text-lg hover:scale-125 hover:bg-base-100 transition-all"
                onClick={() => run(() => onReact?.(emoji))}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="py-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={() => run(action.onClick)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-colors
                ${action.danger
                  ? "text-error hover:bg-error/10"
                  : "text-base-content/90 hover:bg-base-200/80"
                }
                ${action.disabled ? "opacity-40 pointer-events-none" : ""}`}
            >
              <span className="w-5 h-5 flex items-center justify-center opacity-80">
                {action.icon}
              </span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <style>{`
        @keyframes msgMenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes msgSheetIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {content}
    </>,
    document.body
  );
};

export const MessageMenuTrigger = ({ isMine, onOpen, className = "" }) => (
  <button
    type="button"
    aria-label="Message options"
    onClick={(e) => {
      e.stopPropagation();
      onOpen(e.currentTarget);
    }}
    className={`msg-menu-trigger ${isMine ? "msg-menu-trigger--mine" : "msg-menu-trigger--theirs"}
      w-7 h-7 rounded-full
      items-center justify-center
      bg-base-200/90 backdrop-blur-sm
      border border-base-300/60 shadow-sm
      text-base-content/50 hover:text-base-content hover:bg-base-200
      hidden md:flex
      md:opacity-0 md:group-hover:opacity-100
      transition-opacity duration-150 active:scale-95
      ${className}`}
  >
    <MoreVertical className="w-4 h-4" />
  </button>
);

export const buildPrivateChatActions = ({
  message,
  authUserId,
  isStarred,
  onReply,
  onPin,
  onStar,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  onDownload,
}) => {
  if (isMessageDeleted(message)) return [];

  const actions = [
    {
      id: "reply",
      label: "Reply",
      icon: <Reply className="w-4 h-4" />,
      onClick: onReply,
    },
    {
      id: "star",
      label: isStarred ? "Unstar" : "Star message",
      icon: <Star className={`w-4 h-4 ${isStarred ? "fill-warning text-warning" : ""}`} />,
      onClick: onStar,
    },
    {
      id: "pin",
      label: message.isPinned ? "Unpin" : "Pin",
      icon: <Pin className="w-4 h-4" />,
      onClick: onPin,
    },
  ];

  if (!message.image && !message.audio && !message.poll && message.text) {
    actions.push({
      id: "copy",
      label: "Copy",
      icon: <Copy className="w-4 h-4" />,
      onClick: onCopy,
    });
  }

  actions.push({
    id: "forward",
    label: "Forward",
    icon: <Forward className="w-4 h-4" />,
    onClick: onForward,
  });

  if (
    message.senderId === authUserId &&
    Date.now() - new Date(message.createdAt).getTime() < 5 * 60 * 1000
  ) {
    actions.push({
      id: "edit",
      label: "Edit",
      icon: <Pencil className="w-4 h-4" />,
      onClick: onEdit,
    });
  }

  if (message.image) {
    actions.push({
      id: "download",
      label: "Download",
      icon: <Download className="w-4 h-4" />,
      onClick: onDownload,
    });
  }

  // Anyone in the chat can open delete (sheet decides for-me vs everyone)
  actions.push({
    id: "delete",
    label: "Delete",
    icon: <Trash2 className="w-4 h-4" />,
    danger: true,
    onClick: onDelete,
  });

  return actions;
};

export const buildGroupChatActions = ({
  message,
  isAdmin,
  isPinned,
  isStarred,
  onReply,
  onInfo,
  onStar,
  onPin,
  onCopy,
  onForward,
  onDelete,
}) => {
  const deleted = isMessageDeleted(message);
  const actions = [];

  // Available for every accessible message (own or others), including deleted
  if (onInfo) {
    actions.push({
      id: "info",
      label: "Message Info",
      icon: <Info className="w-4 h-4" />,
      onClick: onInfo,
    });
  }

  if (deleted) {
    if (onDelete) {
      actions.push({
        id: "delete",
        label: "Delete",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: onDelete,
      });
    }
    return actions;
  }

  if (onReply) {
    actions.push({
      id: "reply",
      label: "Reply",
      icon: <Reply className="w-4 h-4" />,
      onClick: onReply,
    });
  }
  if (onStar) {
    actions.push({
      id: "star",
      label: isStarred ? "Unstar" : "Star message",
      icon: <Star className={`w-4 h-4 ${isStarred ? "fill-warning text-warning" : ""}`} />,
      onClick: onStar,
    });
  }
  if (isAdmin) {
    actions.push({
      id: "pin",
      label: isPinned ? "Unpin" : "Pin",
      icon: <Pin className="w-4 h-4" />,
      onClick: onPin,
    });
  }
  if (!message.image && message.text) {
    actions.push({
      id: "copy",
      label: "Copy",
      icon: <Copy className="w-4 h-4" />,
      onClick: onCopy,
    });
  }
  actions.push({
    id: "forward",
    label: "Forward",
    icon: <Forward className="w-4 h-4" />,
    onClick: onForward,
  });
  actions.push({
    id: "delete",
    label: "Delete",
    icon: <Trash2 className="w-4 h-4" />,
    danger: true,
    onClick: onDelete,
  });
  return actions;
};

export default MessageActionMenu;
