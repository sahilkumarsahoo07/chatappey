import { memo, useCallback, useRef } from "react";
import "./storyMusic.css";

/**
 * Draggable Instagram-style music sticker.
 * Position uses normalized 0–1 coordinates relative to parent.
 */
function MusicSticker({
  music,
  playing = true,
  editable = false,
  onChange,
  containerRef,
}) {
  if (!music?.title) return null;

  const sticker = music.sticker || { x: 0.5, y: 0.72, scale: 1, rotation: 0, theme: "classic" };
  const dragRef = useRef({ active: false, ox: 0, oy: 0 });

  const onPointerDown = useCallback(
    (e) => {
      if (!editable || !containerRef?.current) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const rect = containerRef.current.getBoundingClientRect();
      dragRef.current = {
        active: true,
        ox: e.clientX - sticker.x * rect.width,
        oy: e.clientY - sticker.y * rect.height,
      };
    },
    [editable, containerRef, sticker.x, sticker.y]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragRef.current.active || !containerRef?.current || !onChange) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - dragRef.current.ox) / rect.width;
      const y = (e.clientY - dragRef.current.oy) / rect.height;
      onChange({ x, y });
    },
    [containerRef, onChange]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const onWheel = useCallback(
    (e) => {
      if (!editable || !onChange) return;
      e.preventDefault();
      const next = Math.min(2.2, Math.max(0.7, (sticker.scale || 1) + (e.deltaY > 0 ? -0.05 : 0.05)));
      onChange({ scale: next });
    },
    [editable, onChange, sticker.scale]
  );

  return (
    <div
      className="music-sticker"
      style={{
        left: `${(sticker.x ?? 0.5) * 100}%`,
        top: `${(sticker.y ?? 0.72) * 100}%`,
        transform: `translate(-50%, -50%) scale(${sticker.scale || 1}) rotate(${sticker.rotation || 0}deg)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className={`music-sticker-inner theme-${sticker.theme || "classic"}`}>
        <img
          className="music-sticker-cover"
          src={music.thumbnail || "/avatar.png"}
          alt=""
          draggable={false}
        />
        <div className="music-sticker-text">
          <div className="t">{music.title}</div>
          <div className="a">{music.artist || "Unknown"}</div>
        </div>
        <div className={`music-eq${playing ? "" : " is-paused"}`} aria-hidden>
          <i /><i /><i />
        </div>
      </div>
    </div>
  );
}

export default memo(MusicSticker);
