import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, PhoneOff } from "lucide-react";
import { useCallStore } from "../../store/useCallStore";
import { formatCallDuration } from "./CallPrimitives";
import "./call-ui.css";

function MinimizedCallBubble({ onEnd }) {
  const {
    receiver,
    caller,
    callType,
    callStartTime,
    callStatus,
    toggleMinimize,
  } = useCallStore();

  const participant = receiver || caller;
  const [elapsed, setElapsed] = useState(0);
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, window.innerWidth - 188),
    y: Math.max(12, window.innerHeight - 220),
  }));
  const dragRef = useRef({ active: false, ox: 0, oy: 0 });

  useEffect(() => {
    if (callStatus !== "connected" || !callStartTime) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - callStartTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callStatus, callStartTime]);

  const onPointerDown = useCallback((e) => {
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      active: true,
      ox: e.clientX - pos.x,
      oy: e.clientY - pos.y,
    };
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const x = Math.min(
      window.innerWidth - 180,
      Math.max(8, e.clientX - dragRef.current.ox)
    );
    const y = Math.min(
      window.innerHeight - 160,
      Math.max(8, e.clientY - dragRef.current.oy)
    );
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  return (
    <div
      className="call-wa-mini"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="dialog"
      aria-label="Minimized call"
    >
      <div className="call-wa-mini-body">
        <img
          className="call-wa-mini-avatar"
          src={participant?.profilePic || "/avatar.png"}
          alt=""
          draggable={false}
        />
        <div className="call-wa-mini-name">
          {participant?.fullName || "Call"}
        </div>
        <div className="call-wa-mini-timer">
          {callStatus === "connected"
            ? formatCallDuration(elapsed)
            : callType === "video"
              ? "Video call"
              : "Voice call"}
        </div>
      </div>
      <div className="call-wa-mini-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMinimize();
          }}
          aria-label="Return to call"
        >
          <Maximize2 size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnd?.();
          }}
          aria-label="End call"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}

export default memo(MinimizedCallBubble);
