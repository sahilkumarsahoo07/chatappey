import { useCallback, useEffect, useRef, useState } from "react";

const IMAGE_FALLBACK_MS = 5000;

/**
 * WhatsApp-like story progress / hold / visibility controller.
 * Images: timed duration. Videos: driven by playback time.
 */
export function useStoryProgress({
  durationSec = 5,
  isVideo = false,
  isActive = true,
  onComplete,
}) {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const holdingRef = useRef(false);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const videoRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const durationMs = Math.max(500, (durationSec || IMAGE_FALLBACK_MS / 1000) * 1000);

  const setPausedBoth = useCallback((value) => {
    pausedRef.current = value;
    setPaused(value);
    const v = videoRef.current;
    if (v) {
      if (value) v.pause();
      else if (isActive) v.play().catch(() => {});
    }
  }, [isActive]);

  // Reset on media change / activation
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
    holdingRef.current = false;
    pausedRef.current = false;
    setPaused(false);
  }, [durationSec, isVideo, isActive]);

  // Image timer via rAF
  useEffect(() => {
    if (!isActive || isVideo) return;

    const tick = (now) => {
      if (!pausedRef.current && !holdingRef.current) {
        if (!startRef.current) startRef.current = now;
        const total = elapsedRef.current + (now - startRef.current);
        const p = Math.min(1, total / durationMs);
        setProgress(p);
        if (p >= 1) {
          onCompleteRef.current?.();
          return;
        }
      } else {
        // freeze start for resume
        startRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, isVideo, durationMs]);

  // Tab visibility
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (!pausedRef.current) {
          elapsedRef.current += performance.now() - startRef.current;
          setPausedBoth(true);
        }
      } else if (!holdingRef.current) {
        startRef.current = performance.now();
        setPausedBoth(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [setPausedBoth]);

  const holdStart = useCallback(() => {
    holdingRef.current = true;
    if (!isVideo) {
      elapsedRef.current += performance.now() - startRef.current;
    }
    setPausedBoth(true);
  }, [isVideo, setPausedBoth]);

  const holdEnd = useCallback(() => {
    holdingRef.current = false;
    startRef.current = performance.now();
    setPausedBoth(false);
  }, [setPausedBoth]);

  const bindVideo = useCallback(
    (el) => {
      videoRef.current = el;
      if (!el) return;
      const onTime = () => {
        if (!el.duration) return;
        setProgress(Math.min(1, el.currentTime / el.duration));
      };
      const onEnded = () => onCompleteRef.current?.();
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("ended", onEnded);
      return () => {
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("ended", onEnded);
      };
    },
    []
  );

  const reportVideoTime = useCallback((current, total) => {
    if (!total) return;
    setProgress(Math.min(1, current / total));
  }, []);

  return {
    progress,
    paused,
    holdStart,
    holdEnd,
    setPaused: setPausedBoth,
    bindVideo,
    reportVideoTime,
    videoRef,
  };
}

export function formatStatusTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h}h ago`;
  }
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
