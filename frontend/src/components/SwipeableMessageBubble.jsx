import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 450;
const REPLY_THRESHOLD = 56;
const MAX_SWIPE = 72;
const DIRECTION_LOCK = 10;

/**
 * WhatsApp mobile gestures:
 * - Swipe left/right → reply
 * - Long-press → action menu
 * Desktop: parent shows ⋮ on hover separately.
 */
export default function SwipeableMessageBubble({
  children,
  isMine = false,
  disabled = false,
  onReply,
  onLongPress,
  className = "",
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const mode = useRef(null);
  const longPressTimer = useRef(null);
  const bubbleRef = useRef(null);
  const replied = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const resetTransform = () => {
    const el = bubbleRef.current;
    if (!el) return;
    el.style.transition = "transform 0.18s ease-out";
    el.style.transform = "translateX(0px)";
    const icon = el.parentElement?.querySelector("[data-swipe-reply-icon]");
    if (icon) {
      icon.style.opacity = "0";
      icon.style.transform = "scale(0.55)";
    }
  };

  const handleTouchStart = useCallback(
    (e) => {
      if (disabled) return;
      if (window.innerWidth >= 768) return;

      const touch = e.touches[0];
      if (!touch) return;

      startX.current = touch.clientX;
      startY.current = touch.clientY;
      deltaX.current = 0;
      mode.current = "pending";
      replied.current = false;

      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        if (mode.current === "pending") {
          mode.current = "longpress";
          if (navigator.vibrate) navigator.vibrate(40);
          onLongPress?.(bubbleRef.current);
        }
      }, LONG_PRESS_MS);
    },
    [disabled, onLongPress]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (disabled || window.innerWidth >= 768) return;
      if (mode.current === "longpress" || mode.current === "scroll") return;

      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      if (mode.current === "pending") {
        if (Math.abs(dy) > DIRECTION_LOCK && Math.abs(dy) > Math.abs(dx)) {
          mode.current = "scroll";
          clearLongPress();
          resetTransform();
          return;
        }
        if (Math.abs(dx) > DIRECTION_LOCK && Math.abs(dx) > Math.abs(dy)) {
          mode.current = "swipe";
          clearLongPress();
        } else {
          return;
        }
      }

      if (mode.current !== "swipe") return;
      if (e.cancelable) e.preventDefault();

      const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
      deltaX.current = clamped;

      const el = bubbleRef.current;
      if (el) {
        el.style.transition = "none";
        el.style.transform = `translateX(${clamped}px)`;

        const icon = el.parentElement?.querySelector("[data-swipe-reply-icon]");
        if (icon) {
          const progress = Math.min(1, Math.abs(clamped) / REPLY_THRESHOLD);
          icon.style.opacity = String(progress);
          icon.style.transform = `scale(${0.55 + progress * 0.45})`;
          if (clamped >= 0) {
            icon.style.left = "4px";
            icon.style.right = "auto";
          } else {
            icon.style.right = "4px";
            icon.style.left = "auto";
          }
        }
      }

      if (!replied.current && Math.abs(clamped) >= REPLY_THRESHOLD) {
        replied.current = true;
        if (navigator.vibrate) navigator.vibrate(15);
      }
    },
    [disabled]
  );

  const finishTouch = useCallback(() => {
    if (disabled || window.innerWidth >= 768) return;
    clearLongPress();
    const shouldReply =
      mode.current === "swipe" && Math.abs(deltaX.current) >= REPLY_THRESHOLD;
    resetTransform();
    mode.current = null;
    deltaX.current = 0;
    if (shouldReply) onReply?.();
  }, [disabled, onReply]);

  return (
    <div
      className={`swipeable-message relative inline-block w-fit max-w-[min(85vw,28rem)] align-bottom ${className}`}
    >
      <span
        data-swipe-reply-icon
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-0
          w-9 h-9 rounded-full bg-base-100 shadow-md border border-base-300/80
          flex items-center justify-center text-primary
          opacity-0 md:hidden"
        style={{ [isMine ? "left" : "right"]: 4 }}
        aria-hidden
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
      </span>

      <div
        ref={bubbleRef}
        className="relative z-[1] w-fit max-w-full will-change-transform select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishTouch}
        onTouchCancel={finishTouch}
        style={{
          touchAction: "pan-y",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
