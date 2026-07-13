import { memo } from "react";

const DEFAULT_AVATAR = "/avatar.png";

export function CallBackground({ avatarUrl }) {
  const url = avatarUrl || DEFAULT_AVATAR;
  return (
    <div className="call-wa-bg" aria-hidden>
      <div
        className="call-wa-bg-img"
        style={{ backgroundImage: `url(${url})` }}
      />
      <div className="call-wa-bg-scrim" />
    </div>
  );
}

export const CallAvatar = memo(function CallAvatar({
  src,
  name,
  pulsing = true,
  size = "md",
}) {
  const url = src || DEFAULT_AVATAR;
  return (
    <div className="call-wa-avatar-wrap">
      {pulsing && (
        <>
          <span className="call-wa-avatar-ring call-wa-avatar-ring--1" />
          <span className="call-wa-avatar-ring call-wa-avatar-ring--2" />
          <span className="call-wa-avatar-ring call-wa-avatar-ring--3" />
        </>
      )}
      <img
        src={url}
        alt={name || "Caller"}
        className={`call-wa-avatar${size === "lg" ? " call-wa-avatar--lg" : ""}`}
        draggable={false}
      />
    </div>
  );
});

export function formatCallDuration(totalSeconds = 0) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function callStatusLabel(status, { isOutgoing = true } = {}) {
  switch (status) {
    case "calling":
      return "Calling…";
    case "ringing":
      return isOutgoing ? "Ringing…" : "Incoming";
    case "connecting":
      return "Connecting…";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting…";
    case "poor":
      return "Poor connection";
    case "ended":
      return "Call ended";
    case "declined":
    case "rejected":
      return "Declined";
    case "missed":
      return "Missed call";
    case "busy":
      return "Busy";
    case "unavailable":
      return "Unavailable";
    default:
      return isOutgoing ? "Calling…" : "Incoming";
  }
}

export function NetworkQuality({ level = "good" }) {
  return (
    <span className={`call-wa-quality call-wa-quality--${level}`}>
      <span className="call-wa-quality-bars" aria-hidden>
        <i /><i /><i /><i />
      </span>
      {level === "good" && "Excellent"}
      {level === "fair" && "Fair"}
      {level === "poor" && "Poor"}
    </span>
  );
}
