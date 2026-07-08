import { memo, useCallback, useRef, useState } from "react";
import { haptic } from "../lib/haptics";

/**
 * Wraps children and fires onDoubleTap when a quick double tap is detected.
 * Shows a floating heart animation on success.
 * Uses pointer events (not click) so it works over video/image without hijacking controls incorrectly.
 */
const DoubleTapLike = memo(function DoubleTapLike({
  children,
  onDoubleTap,
  disabled = false,
  className = "",
}) {
  const lastTap = useRef(0);
  const [burst, setBurst] = useState(false);
  const [pos, setPos] = useState({ x: "50%", y: "50%" });

  const fire = useCallback(
    (clientX, clientY, target) => {
      if (disabled || !onDoubleTap) return;
      const now = Date.now();
      if (now - lastTap.current < 320) {
        lastTap.current = 0;
        const rect = target.getBoundingClientRect();
        if (clientX != null && rect.width) {
          setPos({
            x: `${((clientX - rect.left) / rect.width) * 100}%`,
            y: `${((clientY - rect.top) / rect.height) * 100}%`,
          });
        }
        setBurst(true);
        haptic("doubleTap");
        onDoubleTap();
        setTimeout(() => setBurst(false), 700);
      } else {
        lastTap.current = now;
      }
    },
    [disabled, onDoubleTap]
  );

  const onPointerUp = useCallback(
    (e) => {
      // Ignore secondary buttons / multi-finger
      if (e.button != null && e.button !== 0) return;
      fire(e.clientX, e.clientY, e.currentTarget);
    },
    [fire]
  );

  return (
    <div
      className={`relative select-none touch-manipulation ${className}`}
      onPointerUp={onPointerUp}
      role="presentation"
    >
      {children}
      {burst && (
        <span
          className="pointer-events-none absolute z-30 text-5xl drop-shadow-lg animate-[heartBurst_0.7s_ease-out_forwards]"
          style={{ left: pos.x, top: pos.y, transform: "translate(-50%, -50%)" }}
          aria-hidden
        >
          ❤️
        </span>
      )}
      <style>{`
        @keyframes heartBurst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          35% { opacity: 1; transform: translate(-50%, -55%) scale(1.25); }
          100% { opacity: 0; transform: translate(-50%, -80%) scale(1.05); }
        }
      `}</style>
    </div>
  );
});

export default DoubleTapLike;
