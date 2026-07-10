import { memo } from "react";
import { getDeletedMessageLabel } from "../../lib/messageDelete";
import "./DeletedMessageBubble.css";

function DeletedMessageBubble({ message, authUserId, isMyMessage = false }) {
  const label = getDeletedMessageLabel(message, authUserId);
  if (!label) return null;

  return (
    <div
      className={`deleted-msg ${isMyMessage ? "deleted-msg--mine" : "deleted-msg--theirs"}`}
      aria-label={label}
    >
      <span className="deleted-msg-icon" aria-hidden>
        🚫
      </span>
      <span className="deleted-msg-text">{label}</span>
    </div>
  );
}

export default memo(DeletedMessageBubble);
