import { memo, useCallback, useRef, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";

import { buildQualityUrl } from "../../lib/mediaDelivery";
import { useNetworkStore } from "../../store/useNetworkStore";

function formatDuration(sec) {
  if (!sec || Number.isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VideoMessage = memo(function VideoMessage({
  video,
  thumbnail,
  duration: metaDuration,
  isMyMessage,
}) {
  const quality = useNetworkStore((s) => s.quality);
  // Don't transform chat videos — Cloudinary image-style transforms break playback
  const adaptedSrc = video;
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [duration, setDuration] = useState(metaDuration || 0);
  const [fullscreen, setFullscreen] = useState(false);
  const [ended, setEnded] = useState(false);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      setEnded(false);
      el.play();
      setPlaying(true);
    }
  }, [playing]);

  const openFullscreen = useCallback(() => {
    setFullscreen(true);
    requestAnimationFrame(() => videoRef.current?.play());
  }, []);

  const replay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play();
    setEnded(false);
    setPlaying(true);
  }, []);

  const player = (
    <div className="relative max-w-[240px] md:max-w-[280px] rounded-xl overflow-hidden bg-black/80 my-1">
      <video
        ref={videoRef}
        src={adaptedSrc || video}
        poster={thumbnail}
        preload="none"
        playsInline
        className="w-full max-h-[320px] object-contain bg-black"
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => setDuration(e.target.duration || metaDuration || 0)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
        }}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      />
      {thumbnail && !playing && !ended && (
        <img
          src={thumbnail}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-90"
          loading="lazy"
        />
      )}
      <div className="absolute bottom-2 right-2 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded">
        {formatDuration(duration)}
      </div>
      {!playing && !ended && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className={`absolute inset-0 flex items-center justify-center ${
            isMyMessage ? "text-primary-content" : "text-white"
          }`}
        >
          <span className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Play size={22} fill="currentColor" className="ml-0.5" />
          </span>
        </button>
      )}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
      {ended && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            replay();
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-white"
        >
          <RotateCcw size={22} />
          <span className="text-xs font-medium">Replay</span>
        </button>
      )}
      {!fullscreen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openFullscreen();
          }}
          className="absolute top-2 right-2 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded"
        >
          Full screen
        </button>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
        onClick={() => setFullscreen(false)}
      >
        <video
          src={adaptedSrc || video}
          poster={thumbnail}
          controls
          autoPlay
          playsInline
          className="max-w-full max-h-full"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="absolute top-4 right-4 text-white bg-black/50 px-3 py-1 rounded-lg text-sm"
          onClick={() => setFullscreen(false)}
        >
          Close
        </button>
      </div>
    );
  }

  return player;
});

export default VideoMessage;
