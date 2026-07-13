import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone, PhoneMissed, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../../store/useCallStore";
import { useChatStore } from "../../store/useChatStore";
import { useWebRTC } from "../../hooks/useWebRTC";
import {
  CallAvatar,
  CallBackground,
  formatCallDuration,
} from "./CallPrimitives";
import "./call-ui.css";

function statusCopy(status) {
  switch (status) {
    case "declined":
    case "rejected":
      return "Declined";
    case "missed":
      return "Missed call";
    case "busy":
      return "Busy";
    case "unavailable":
      return "Unavailable";
    case "ended":
    default:
      return "Call ended";
  }
}

function CallEndedScreen() {
  const endedCall = useCallStore((s) => s.endedCall);
  const dismissEndedCall = useCallStore((s) => s.dismissEndedCall);
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);
  const { initiateCall } = useWebRTC();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (endedCall) {
      setShow(true);
      return;
    }
    setShow(false);
  }, [endedCall]);

  const participant = endedCall?.participant;
  const isMissed = endedCall?.status === "missed";

  const meta = useMemo(() => {
    if (!endedCall) return "";
    const type = endedCall.callType === "video" ? "Video" : "Voice";
    const dur =
      endedCall.duration > 0 ? formatCallDuration(endedCall.duration) : null;
    if (dur) return `${type} · ${dur}`;
    return `${type} · ${statusCopy(endedCall.status)}`;
  }, [endedCall]);

  const handleClose = useCallback(() => {
    setShow(false);
    setTimeout(() => dismissEndedCall(), 180);
  }, [dismissEndedCall]);

  const handleCallAgain = useCallback(() => {
    if (!participant?._id) return;
    const type = endedCall?.callType || "audio";
    dismissEndedCall();
    initiateCall(participant._id, participant, type);
  }, [participant, endedCall, dismissEndedCall, initiateCall]);

  const handleMessage = useCallback(() => {
    if (!participant) return;
    setSelectedUser(participant);
    dismissEndedCall();
    navigate("/");
  }, [participant, setSelectedUser, dismissEndedCall, navigate]);

  if (!endedCall || !show) return null;

  return (
    <div className="call-wa-root" role="dialog" aria-modal="true" aria-label="Call ended">
      <CallBackground avatarUrl={participant?.profilePic} />
      <div className="call-wa-content">
        <div className="call-wa-end-card">
          <CallAvatar
            src={participant?.profilePic}
            name={participant?.fullName}
            pulsing={false}
          />
          <h2 className="call-wa-name mt-6">
            {participant?.fullName || "User"}
          </h2>
          <p className="call-wa-end-meta">
            {isMissed ? (
              <span className="inline-flex items-center gap-1.5 text-[#f15c6d]">
                <PhoneMissed size={16} />
                Missed {endedCall.callType === "video" ? "video" : "voice"} call
              </span>
            ) : (
              meta
            )}
          </p>

          <div className="call-wa-end-actions">
            <button
              type="button"
              className="call-wa-end-primary"
              onClick={handleCallAgain}
            >
              <Phone size={18} />
              {isMissed ? "Call back" : "Call again"}
            </button>
            <button
              type="button"
              className="call-wa-end-secondary"
              onClick={handleMessage}
            >
              <MessageCircle size={18} />
              Send message
            </button>
            <button
              type="button"
              className="call-wa-end-ghost"
              onClick={handleClose}
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(CallEndedScreen);
