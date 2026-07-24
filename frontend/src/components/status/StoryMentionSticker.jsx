import { useState, useRef } from "react";
import { AtSign, Sparkles, User, ExternalLink, RefreshCw } from "lucide-react";

export const MENTION_STYLES = [
  { id: "default", bg: "bg-black/70 text-white border-white/20", text: "text-white" },
  { id: "gradient", bg: "bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white border-white/30", text: "text-white" },
  { id: "minimal", bg: "bg-white/90 text-black border-black/10", text: "text-black" },
  { id: "neon", bg: "bg-black/80 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]", text: "text-emerald-400" },
];

export default function StoryMentionSticker({
  mention,
  editable = false,
  onUpdatePosition,
  onRemove,
  onTapMention,
}) {
  const [styleIndex, setStyleIndex] = useState(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: mention.x || 0.5, posY: mention.y || 0.5 });
  const [pos, setPos] = useState({ x: mention.x || 0.5, y: mention.y || 0.5 });

  const currentStyle = MENTION_STYLES[styleIndex % MENTION_STYLES.length];

  const handlePointerDown = (e) => {
    if (!editable) return;
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const parent = e.target.closest(".group") || document.body;
    const rect = parent.getBoundingClientRect();
    const deltaX = (e.clientX - dragStartRef.current.x) / (rect.width || 320);
    const deltaY = (e.clientY - dragStartRef.current.y) / (rect.height || 500);

    const newX = Math.min(0.85, Math.max(0.15, dragStartRef.current.posX + deltaX));
    const newY = Math.min(0.85, Math.max(0.15, dragStartRef.current.posY + deltaY));

    setPos({ x: newX, y: newY });
    if (onUpdatePosition) {
      onUpdatePosition(mention.userId, { x: newX, y: newY, style: currentStyle.id });
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (editable) {
      // Toggle style
      const nextIdx = (styleIndex + 1) % MENTION_STYLES.length;
      setStyleIndex(nextIdx);
      if (onUpdatePosition) {
        onUpdatePosition(mention.userId, { x: pos.x, y: pos.y, style: MENTION_STYLES[nextIdx].id });
      }
    } else {
      if (onTapMention) {
        onTapMention(mention);
      }
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${mention.scale || 1}) rotate(${mention.rotation || 0}deg)`,
      }}
      className={`absolute z-30 cursor-pointer select-none touch-none px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-xl flex items-center gap-1.5 font-bold tracking-wide text-xs sm:text-sm transition-all active:scale-95 group/sticker ${currentStyle.bg}`}
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
        <AtSign className="w-3 h-3" />
      </div>
      <span className="truncate max-w-[140px]">
        {mention.username || mention.displayName}
      </span>

      {editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onRemove) onRemove(mention.userId);
          }}
          className="ml-1 w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center text-[10px] font-bold"
        >
          ✕
        </button>
      )}
    </div>
  );
}
