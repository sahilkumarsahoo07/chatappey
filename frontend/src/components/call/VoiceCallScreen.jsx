import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bluetooth,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  Volume2,
  Video,
} from "lucide-react";
import { useCallStore } from "../../store/useCallStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
  CallAvatar,
  CallBackground,
  NetworkQuality,
  callStatusLabel,
  formatCallDuration,
} from "./CallPrimitives";
import "./call-ui.css";

/**
 * WhatsApp-style voice / outgoing call surface.
 * Shown for audio calls always, and for video while connecting.
 */
function VoiceCallScreen({ onEnd, onToggleMute, onToggleSpeaker }) {
  const {
    callType,
    callStatus,
    caller,
    receiver,
    callStartTime,
    isMuted,
    isSpeakerOn,
    isMinimized,
  } = useCallStore();
  const authUser = useAuthStore((s) => s.authUser);

  const participant = receiver || caller;
  const isOutgoing = !!receiver;
  const isConnected = callStatus === "connected";

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isConnected || !callStartTime) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - callStartTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isConnected, callStartTime]);

  const statusText = useMemo(() => {
    if (isConnected) return formatCallDuration(elapsed);
    return callStatusLabel(callStatus || "calling", { isOutgoing });
  }, [isConnected, elapsed, callStatus, isOutgoing]);

  const handleMute = useCallback(() => {
    onToggleMute?.();
  }, [onToggleMute]);

  const handleSpeaker = useCallback(() => {
    onToggleSpeaker?.();
  }, [onToggleSpeaker]);

  if (isMinimized) return null;

  // Video connected uses Zego UI — this screen only for audio or pre-connect
  if (callType === "video" && isConnected) return null;

  return (
    <div className="call-wa-root" role="dialog" aria-modal="true" aria-label="Voice call">
      <CallBackground avatarUrl={participant?.profilePic} />
      <div className="call-wa-content">
        <div className="call-wa-top">
          <p className="call-wa-label">
            {callType === "video" ? "Video call" : "Voice call"}
          </p>
          <h2 className="call-wa-name">{participant?.fullName || "User"}</h2>
          <p className={`call-wa-status${isConnected ? " call-wa-status--live" : ""}`}>
            {statusText}
          </p>
          {isConnected && (
            <div className="mt-1 flex justify-center">
              <NetworkQuality level="good" />
            </div>
          )}
        </div>

        <CallAvatar
          src={participant?.profilePic}
          name={participant?.fullName}
          pulsing={!isConnected}
          size="lg"
        />

        <div className="call-wa-controls-bar">
          <div className="call-wa-actions call-wa-actions--grid">
            <button
              type="button"
              className={`call-wa-btn call-wa-btn--mute${isMuted ? " call-wa-btn--active" : ""}`}
              onClick={handleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              <span className="call-wa-btn-circle">
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </span>
              <span className="call-wa-btn-label">{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            <button
              type="button"
              className="call-wa-btn call-wa-btn--bluetooth"
              aria-label="Bluetooth"
              title="Bluetooth (coming soon)"
              disabled
            >
              <span className="call-wa-btn-circle">
                <Bluetooth size={24} />
              </span>
              <span className="call-wa-btn-label">Bluetooth</span>
            </button>

            <button
              type="button"
              className={`call-wa-btn call-wa-btn--speaker${isSpeakerOn ? " call-wa-btn--active" : ""}`}
              onClick={handleSpeaker}
              aria-label={isSpeakerOn ? "Earpiece" : "Speaker"}
            >
              <span className="call-wa-btn-circle">
                <Volume2 size={24} />
              </span>
              <span className="call-wa-btn-label">
                {isSpeakerOn ? "Speaker" : "Speaker"}
              </span>
            </button>

            <button
              type="button"
              className="call-wa-btn call-wa-btn--video"
              aria-label="Video call"
              title="Switch to video (coming soon)"
              disabled
            >
              <span className="call-wa-btn-circle">
                <Video size={24} />
              </span>
              <span className="call-wa-btn-label">Video</span>
            </button>

            <button
              type="button"
              className="call-wa-btn call-wa-btn--more"
              aria-label="More"
              title="More options"
              disabled
            >
              <span className="call-wa-btn-circle">
                <MoreHorizontal size={24} />
              </span>
              <span className="call-wa-btn-label">More</span>
            </button>

            <div aria-hidden />
          </div>

          <div className="call-wa-end-row">
            <button
              type="button"
              className="call-wa-btn call-wa-btn--end"
              onClick={onEnd}
              aria-label="End call"
            >
              <span className="call-wa-btn-circle">
                <PhoneOff size={28} />
              </span>
              <span className="call-wa-btn-label">End</span>
            </button>
          </div>

          {authUser?.fullName && (
            <p className="text-center text-xs text-white/35 mt-4">
              End-to-end encrypted
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(VoiceCallScreen);
