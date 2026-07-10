import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Pause, Play } from "lucide-react";
import "./VoiceMessagePlayer.css";

const BAR_COUNT = 36;
const SPEEDS = [1, 1.5, 2];
const waveformCache = new Map();

/** Strip codecs= from data URLs — browsers often reject them as media sources */
export function normalizeAudioSrc(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:audio/") && url.includes("codecs=") && url.includes(";base64,")) {
    const base64 = url.split(";base64,")[1];
    if (base64) {
      const mime = url.startsWith("data:audio/ogg") ? "audio/ogg" : "audio/webm";
      return `data:${mime};base64,${base64}`;
    }
  }
  return url;
}

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function dataUrlToBlobUrl(dataUrl) {
  const normalized = normalizeAudioSrc(dataUrl);
  const buf = dataUrlToArrayBuffer(normalized);
  const mime = normalized.startsWith("data:audio/ogg") ? "audio/ogg" : "audio/webm";
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

function cacheKey(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return `data:${url.length}:${url.slice(0, 64)}`;
  return url;
}

async function extractWaveform(url) {
  if (!url) return null;
  const key = cacheKey(url);
  if (waveformCache.has(key)) return waveformCache.get(key);

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    let buf;
    if (url.startsWith("data:")) {
      buf = dataUrlToArrayBuffer(normalizeAudioSrc(url));
    } else {
      const res = await fetch(url);
      buf = await res.arrayBuffer();
    }

    const ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    await ctx.close();

    const channel = decoded.getChannelData(0);
    const block = Math.floor(channel.length / BAR_COUNT) || 1;
    const bars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      for (let j = start; j < end; j++) sum += Math.abs(channel[j]);
      bars.push(sum / (end - start || 1));
    }
    const max = Math.max(...bars, 0.001);
    const normalized = bars.map((v) => Math.max(0.12, v / max));
    waveformCache.set(key, normalized);
    if (waveformCache.size > 80) {
      const first = waveformCache.keys().next().value;
      waveformCache.delete(first);
    }
    return normalized;
  } catch {
    return null;
  }
}

function formatTime(time) {
  if (!Number.isFinite(time) || time < 0) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function VoiceMessagePlayer({ audioUrl, isMyMessage = false, compact = false }) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [playSrc, setPlaySrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [bars, setBars] = useState(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + ((i * 17) % 7) / 14)
  );

  // Convert data: URLs → blob: for reliable <audio> playback
  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (!audioUrl) {
      setPlaySrc(null);
      return;
    }

    if (audioUrl.startsWith("data:")) {
      try {
        const blobUrl = dataUrlToBlobUrl(audioUrl);
        objectUrlRef.current = blobUrl;
        setPlaySrc(blobUrl);
      } catch {
        setPlaySrc(normalizeAudioSrc(audioUrl));
      }
    } else {
      setPlaySrc(audioUrl);
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    let cancelled = false;
    extractWaveform(audioUrl).then((data) => {
      if (!cancelled && data) setBars(data);
    });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[speedIdx];
    }
  }, [speedIdx]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  const cycleSpeed = useCallback((e) => {
    e.stopPropagation();
    setSpeedIdx((i) => (i + 1) % SPEEDS.length);
  }, []);

  const seekFromEvent = useCallback(
    (e) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      if (clientX == null) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  const progress = duration ? currentTime / duration : 0;
  const activeBars = useMemo(() => Math.floor(progress * bars.length), [progress, bars.length]);

  return (
    <div
      className={`voice-msg ${isMyMessage ? "voice-msg--mine" : "voice-msg--theirs"} ${
        compact ? "voice-msg--compact" : ""
      }`}
    >
      <audio ref={audioRef} src={playSrc || undefined} preload="metadata" />

      <button type="button" className="voice-msg-play" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>

      <div className="voice-msg-body">
        <div
          className="voice-msg-wave"
          onClick={seekFromEvent}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") togglePlay();
          }}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          aria-label="Seek voice message"
        >
          {bars.map((h, i) => (
            <span
              key={i}
              className={`voice-msg-bar ${i <= activeBars ? "voice-msg-bar--played" : ""} ${
                isPlaying && i === activeBars ? "voice-msg-bar--live" : ""
              }`}
              style={{ height: `${4 + h * 22}px` }}
            />
          ))}
        </div>
        <div className="voice-msg-meta">
          <span>{formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}</span>
          <button type="button" className="voice-msg-speed" onClick={cycleSpeed} aria-label="Playback speed">
            {SPEEDS[speedIdx]}x
          </button>
        </div>
      </div>

      <div className="voice-msg-mic" aria-hidden>
        <Mic size={14} />
      </div>
    </div>
  );
}

export default memo(VoiceMessagePlayer);
