import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useCallStore } from "../../store/useCallStore";
import { useWebRTC } from "../../hooks/useWebRTC";
import { CallAvatar, CallBackground, callStatusLabel } from "./CallPrimitives";
import "./call-ui.css";

/**
 * Full-screen WhatsApp-style incoming call UI.
 */
function IncomingCallScreen() {
  const incomingCall = useCallStore((s) => s.incomingCall);
  const { answerCall, rejectCall } = useWebRTC();
  const [visible, setVisible] = useState(false);
  const ringtoneRef = useRef(null);

  useEffect(() => {
    if (!ringtoneRef.current) {
      const audio = new Audio("/notification.mp3");
      audio.loop = true;
      audio.volume = 0.7;
      ringtoneRef.current = audio;
    }
  }, []);

  useEffect(() => {
    if (!incomingCall) {
      setVisible(false);
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      return;
    }

    setVisible(true);
    const audio = ringtoneRef.current;
    if (audio) {
      audio.loop = true;
      const p = audio.play();
      if (p?.catch) p.catch(() => {});
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [incomingCall]);

  const stopTone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, []);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    stopTone();
    answerCall(incomingCall.fromData, incomingCall.callType, incomingCall.roomID);
  }, [incomingCall, answerCall, stopTone]);

  const handleReject = useCallback(() => {
    if (!incomingCall) return;
    stopTone();
    rejectCall(incomingCall.from, incomingCall.roomID);
  }, [incomingCall, rejectCall, stopTone]);

  if (!incomingCall || !visible) return null;

  const caller = incomingCall.fromData;
  const isVideo = incomingCall.callType === "video";

  return (
    <div className="call-wa-root" role="dialog" aria-modal="true" aria-label="Incoming call">
      <CallBackground avatarUrl={caller?.profilePic} />
      <div className="call-wa-content">
        <div className="call-wa-top">
          <p className="call-wa-label">
            {isVideo ? "Incoming video call" : "Incoming voice call"}
          </p>
          <h2 className="call-wa-name">{caller?.fullName || "Unknown"}</h2>
          <p className="call-wa-status">
            {callStatusLabel("ringing", { isOutgoing: false })}
            {isVideo ? (
              <Video size={14} className="inline ml-2 opacity-70" aria-hidden />
            ) : (
              <Phone size={14} className="inline ml-2 opacity-70" aria-hidden />
            )}
          </p>
        </div>

        <CallAvatar
          src={caller?.profilePic}
          name={caller?.fullName}
          pulsing
          size="lg"
        />

        <div className="call-wa-incoming-actions">
          <button
            type="button"
            className="call-wa-btn call-wa-btn--decline"
            onClick={handleReject}
            aria-label="Decline"
          >
            <span className="call-wa-btn-circle">
              <PhoneOff size={28} />
            </span>
            <span className="call-wa-btn-label">Decline</span>
          </button>

          <button
            type="button"
            className="call-wa-btn call-wa-btn--accept"
            onClick={handleAccept}
            aria-label="Accept"
          >
            <span className="call-wa-btn-circle">
              {isVideo ? <Video size={28} /> : <Phone size={28} />}
            </span>
            <span className="call-wa-btn-label">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(IncomingCallScreen);
