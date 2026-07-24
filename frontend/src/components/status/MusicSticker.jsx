import { memo, useCallback, useRef } from "react";
import { InstagramMusicSticker, STICKER_THEMES } from "../groupVibes/InstagramMusicSticker";
import "./storyMusic.css";

/**
 * Draggable Instagram-style music sticker for Status stories.
 * Position uses normalized 0–1 coordinates relative to parent.
 */
function MusicSticker({
  music,
  playing = true,
  editable = false,
  onChange,
  containerRef,
  onRemove,
}) {
  if (!music || (!music.title && !music.name)) return null;

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
      const x = Math.min(0.9, Math.max(0.1, (e.clientX - dragRef.current.ox) / rect.width));
      const y = Math.min(0.9, Math.max(0.1, (e.clientY - dragRef.current.oy) / rect.height));
      onChange({ x, y });
    },
    [containerRef, onChange]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const handleThemeCycle = useCallback(() => {
    if (!editable || !onChange) return;
    const currentTheme = sticker.theme || "classic";
    const currentIdx = STICKER_THEMES.indexOf(currentTheme);
    const nextTheme = STICKER_THEMES[(currentIdx + 1) % STICKER_THEMES.length];
    onChange({ theme: nextTheme });
  }, [editable, onChange, sticker.theme]);

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
      className="absolute z-30 select-none pointer-events-auto"
      style={{
        left: `${(sticker.x ?? 0.5) * 100}%`,
        top: `${(sticker.y ?? 0.72) * 100}%`,
        transform: `translate(-50%, -50%) scale(${sticker.scale || 1}) rotate(${sticker.rotation || 0}deg)`,
      }}
      onWheel={onWheel}
    >
      <InstagramMusicSticker
        music={music}
        isPlaying={playing}
        isEditable={editable}
        onThemeChange={handleThemeCycle}
        onRemove={onRemove}
        onPointerDown={onPointerDown}
      />
    </div>
  );
}

export default memo(MusicSticker);
