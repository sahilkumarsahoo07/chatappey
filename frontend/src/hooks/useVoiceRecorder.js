import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "../lib/haptics";

const BAR_COUNT = 28;
const CANCEL_THRESHOLD = 72;
const LOCK_THRESHOLD = 56;
const TICK_MS = 1000;

const emptyLevels = () => Array.from({ length: BAR_COUNT }, () => 0.12);

/**
 * WhatsApp-style hold-to-record with slide-cancel, swipe-up lock, and live levels.
 */
export function useVoiceRecorder({ onAutoSend } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState(emptyLevels);
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const rafRef = useRef(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const discardRef = useRef(false);
  const lockedRef = useRef(false);
  const startingRef = useRef(false);
  const sendOnStopRef = useRef(false);
  const startPointRef = useRef({ x: 0, y: 0 });
  const activePointerRef = useRef(null);
  const levelsBufRef = useRef(emptyLevels());
  const onAutoSendRef = useRef(onAutoSend);
  onAutoSendRef.current = onAutoSend;

  const cleanupStream = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewBlob(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const tickLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    // Amplify quiet mics so the live waveform is visibly active
    const next = Math.min(1, Math.max(0.1, rms * 5.5));

    const buf = levelsBufRef.current;
    const shifted = buf.slice(1);
    shifted.push(next * 0.7 + buf[buf.length - 1] * 0.3);
    levelsBufRef.current = shifted;
    setLevels([...shifted]);

    rafRef.current = requestAnimationFrame(tickLevels);
  }, []);

  const finishBlob = useCallback(
    (blob) => {
      if (discardRef.current || !blob || blob.size < 200) {
        discardRef.current = false;
        sendOnStopRef.current = false;
        setIsRecording(false);
        setIsLocked(false);
        lockedRef.current = false;
        setSlideX(0);
        setSlideY(0);
        setLevels(emptyLevels());
        return;
      }

      // Explicit send from locked bar (or send-after-stop)
      if (sendOnStopRef.current) {
        sendOnStopRef.current = false;
        setIsRecording(false);
        setIsLocked(false);
        lockedRef.current = false;
        setSlideX(0);
        setSlideY(0);
        setLevels(emptyLevels());
        setPreviewBlob(null);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        haptic("recordSend");
        onAutoSendRef.current?.(blob);
        return;
      }

      // Release / stop → preview only (user taps Send to send)
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setIsRecording(false);
      setIsLocked(false);
      lockedRef.current = false;
      setSlideX(0);
      setSlideY(0);
      setLevels(emptyLevels());
    },
    []
  );

  const startRecording = useCallback(async () => {
    if (startingRef.current) return;
    if (mediaRecorderRef.current?.state === "recording") return;
    startingRef.current = true;
    setError(null);
    discardRef.current = false;
    clearPreview();
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        // Resume immediately — suspended contexts yield flat waveform levels
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        source.connect(analyser);
        sourceRef.current = source;
        analyserRef.current = analyser;
        levelsBufRef.current = emptyLevels();
        rafRef.current = requestAnimationFrame(tickLevels);
      }

      // Prefer plain webm so FileReader data URLs don't include codecs= (breaks <audio>)
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
            ? "audio/ogg;codecs=opus"
            : "";

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const rawType = recorder.mimeType || "audio/webm";
        const type = rawType.split(";")[0] || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        cleanupStream();
        clearTimer();
        finishBlob(blob);
      };

      recorder.start(100);
      setIsRecording(true);
      setIsLocked(false);
      lockedRef.current = false;
      setDuration(0);
      setSlideX(0);
      setSlideY(0);
      haptic("recordStart");

      clearTimer();
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, TICK_MS);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("Microphone access denied");
      cleanupStream();
      throw err;
    } finally {
      startingRef.current = false;
    }
  }, [cleanupStream, clearPreview, clearTimer, finishBlob, tickLevels]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    } else {
      cleanupStream();
      clearTimer();
      setIsRecording(false);
    }
    mediaRecorderRef.current = null;
    activePointerRef.current = null;
  }, [cleanupStream, clearTimer]);

  const cancelRecording = useCallback(() => {
    discardRef.current = true;
    lockedRef.current = false;
    haptic("recordCancel");
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    } else {
      cleanupStream();
      clearTimer();
      setIsRecording(false);
      setIsLocked(false);
      setSlideX(0);
      setSlideY(0);
      setLevels(emptyLevels());
    }
    mediaRecorderRef.current = null;
    activePointerRef.current = null;
    clearPreview();
  }, [cleanupStream, clearTimer, clearPreview]);

  const lockRecording = useCallback(() => {
    if (!isRecording || lockedRef.current) return;
    lockedRef.current = true;
    setIsLocked(true);
    setSlideX(0);
    setSlideY(0);
    haptic("recordLock");
  }, [isRecording]);

  const stopToPreview = useCallback(() => {
    sendOnStopRef.current = false; // land in composer preview
    stopRecording();
  }, [stopRecording]);

  const sendLocked = useCallback(() => {
    if (previewBlob) {
      const blob = previewBlob;
      clearPreview();
      haptic("recordSend");
      onAutoSendRef.current?.(blob);
      return;
    }
    // Still recording while locked — stop and send (skip composer preview)
    sendOnStopRef.current = true;
    lockedRef.current = false;
    setIsLocked(false);
    stopRecording();
  }, [previewBlob, clearPreview, stopRecording]);

  const onPointerMove = useCallback(
    (e) => {
      if (!isRecording || lockedRef.current) return;
      if (activePointerRef.current != null && e.pointerId !== activePointerRef.current) return;
      const dx = e.clientX - startPointRef.current.x;
      const dy = e.clientY - startPointRef.current.y;
      // Prefer dominant axis
      if (Math.abs(dx) > Math.abs(dy)) {
        setSlideX(Math.min(0, dx));
        setSlideY(0);
        if (dx < -CANCEL_THRESHOLD) {
          cancelRecording();
        }
      } else {
        setSlideY(Math.min(0, dy));
        setSlideX(0);
        if (dy < -LOCK_THRESHOLD) {
          lockRecording();
        }
      }
    },
    [isRecording, cancelRecording, lockRecording]
  );

  const onPointerUp = useCallback(
    (e) => {
      const active = activePointerRef.current;
      if (active == null) return;
      if (e.pointerId != null && e.pointerId !== active) return;
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      activePointerRef.current = null;

      if (!isRecording) return;
      if (lockedRef.current) {
        // Finger released after lock — keep recording
        setSlideX(0);
        setSlideY(0);
        return;
      }
      // Release → stop into preview (not auto-send)
      sendOnStopRef.current = false;
      stopRecording();
    },
    [isRecording, stopRecording]
  );

  const onPointerCancel = useCallback(
    (e) => {
      if (activePointerRef.current != null && e.pointerId !== activePointerRef.current) return;
      activePointerRef.current = null;
      if (isRecording && !lockedRef.current) {
        cancelRecording();
      }
    },
    [isRecording, cancelRecording]
  );

  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerUpRef = useRef(onPointerUp);
  onPointerMoveRef.current = onPointerMove;
  onPointerUpRef.current = onPointerUp;

  const onPointerDown = useCallback(
    async (e) => {
      if (e.button != null && e.button !== 0) return;
      if (isRecording || previewBlob) return;
      e.preventDefault();
      activePointerRef.current = e.pointerId;
      startPointRef.current = { x: e.clientX, y: e.clientY };
      setSlideX(0);
      setSlideY(0);
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      // Window listeners so gestures survive React remounts of the mic button
      const pid = e.pointerId;
      const onWinMove = (ev) => {
        if (ev.pointerId !== pid) return;
        onPointerMoveRef.current(ev);
      };
      const onWinUp = (ev) => {
        if (ev.pointerId !== pid) return;
        window.removeEventListener("pointermove", onWinMove);
        window.removeEventListener("pointerup", onWinUp);
        window.removeEventListener("pointercancel", onWinUp);
        onPointerUpRef.current(ev);
      };
      window.addEventListener("pointermove", onWinMove);
      window.addEventListener("pointerup", onWinUp);
      window.addEventListener("pointercancel", onWinUp);
      try {
        await startRecording();
      } catch {
        activePointerRef.current = null;
        window.removeEventListener("pointermove", onWinMove);
        window.removeEventListener("pointerup", onWinUp);
        window.removeEventListener("pointercancel", onWinUp);
      }
    },
    [isRecording, previewBlob, startRecording]
  );

  useEffect(() => {
    return () => {
      discardRef.current = true;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      cleanupStream();
      clearTimer();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelProgress = Math.min(1, Math.abs(slideX) / CANCEL_THRESHOLD);
  const lockProgress = Math.min(1, Math.abs(slideY) / LOCK_THRESHOLD);

  return {
    isRecording,
    isLocked,
    duration,
    levels,
    slideX,
    slideY,
    cancelProgress,
    lockProgress,
    previewUrl,
    previewBlob,
    error,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    cancelRecording,
    lockRecording,
    stopToPreview,
    sendLocked,
    clearPreview,
  };
}

export function formatVoiceDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default useVoiceRecorder;
