import { useEffect, useRef, useState, useCallback } from "react";

/**
 * iOS-style edge swipe back with interactive transform.
 */
export function useEdgeSwipeBack(onBack, options = {}) {
  const {
    edgeWidth = 28,
    threshold = 0.28,
    enabled = true,
    maxPull = typeof window !== "undefined" ? window.innerWidth * 0.85 : 320,
  } = options;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const mode = useRef(null); // null | edge | cancel
  const offsetRef = useRef(0);

  const reset = useCallback(() => {
    start.current = null;
    mode.current = null;
    offsetRef.current = 0;
    setOffset(0);
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      if (t.clientX > edgeWidth) return;
      start.current = { x: t.clientX, y: t.clientY };
      mode.current = "pending";
      setDragging(true);
    };

    const onMove = (e) => {
      if (!start.current || mode.current === "cancel") return;
      const t = e.touches?.[0];
      if (!t) return;
      const dx = t.clientX - start.current.x;
      const dy = Math.abs(t.clientY - start.current.y);

      if (mode.current === "pending") {
        if (dy > 12 && dy > Math.abs(dx)) {
          mode.current = "cancel";
          reset();
          return;
        }
        if (dx > 8 && dx > dy) {
          mode.current = "edge";
        } else return;
      }

      if (mode.current !== "edge") return;
      if (e.cancelable) e.preventDefault();
      const next = Math.max(0, Math.min(maxPull, dx));
      offsetRef.current = next;
      setOffset(next);
    };

    const onEnd = () => {
      if (mode.current === "edge") {
        const ratio = offsetRef.current / (typeof window !== "undefined" ? window.innerWidth : 375);
        if (ratio >= threshold) {
          onBack?.();
        }
      }
      reset();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, edgeWidth, threshold, maxPull, onBack, reset]);

  const progress = Math.min(1, offset / (typeof window !== "undefined" ? window.innerWidth * threshold : 100));

  return { offset, progress, dragging, style: dragging
    ? {
        transform: `translateX(${offset}px)`,
        transition: "none",
        willChange: "transform",
      }
    : {
        transform: "translateX(0)",
        transition: "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)",
      },
  };
}

export default useEdgeSwipeBack;
