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
      const rect = containerRef.current.getBoundingClientRect();
      dragRef.current = {
        active: true,
        ox: e.clientX - sticker.x * rect.width,
        oy: e.clientY - sticker.y * rect.height,
      };

      const handlePointerMove = (moveEvent) => {
        if (!dragRef.current.active || !containerRef.current || !onChange) return;
        const currentRect = containerRef.current.getBoundingClientRect();
        const rawX = (moveEvent.clientX - dragRef.current.ox) / currentRect.width;
        const rawY = (moveEvent.clientY - dragRef.current.oy) / currentRect.height;
        // Smoothly allow positioning anywhere within the stage bounds (0.02 to 0.98)
        const x = Math.min(0.98, Math.max(0.02, rawX));
        const y = Math.min(0.98, Math.max(0.02, rawY));
        onChange({ x, y });
      };

      const handlePointerUp = () => {
        dragRef.current.active = false;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [editable, containerRef, sticker.x, sticker.y, onChange]
  );

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
