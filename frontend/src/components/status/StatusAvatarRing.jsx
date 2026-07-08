import { memo } from "react";
import { Plus } from "lucide-react";
import defaultImg from "../../public/avatar.png";

/**
 * WhatsApp-style segmented ring around avatar.
 * green = unseen, gray = all viewed; own status uses primary when present.
 */
function StatusAvatarRing({
  src,
  alt,
  segments = 1,
  hasUnseen = false,
  isOwn = false,
  size = 56,
  onClick,
  showAddBadge = false,
}) {
  const ringPad = 4;
  const svgSize = size + ringPad * 2;
  const r = size / 2 + 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const circ = 2 * Math.PI * r;
  const count = Math.max(0, segments);
  const gap = count > 1 ? 6 : 0;
  const dash = count > 0 ? (circ - gap * count) / count : 0;
  const color = isOwn
    ? hasUnseen || segments > 0
      ? "var(--status-ring-own, oklch(0.65 0.18 160))"
      : "var(--status-ring-viewed, oklch(0.7 0 0))"
    : hasUnseen
      ? "var(--status-ring-unseen, oklch(0.7 0.17 155))"
      : "var(--status-ring-viewed, oklch(0.72 0 0))";

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
      style={{ width: svgSize, height: svgSize }}
      aria-label={alt}
    >
      <svg
        width={svgSize}
        height={svgSize}
        className="absolute inset-0 -rotate-90 pointer-events-none"
        aria-hidden
      >
        {count === 0 && showAddBadge ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--status-ring-viewed, #9ca3af)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        ) : (
          Array.from({ length: Math.max(1, count) }).map((_, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${dash || circ} ${count > 1 ? circ - dash : 0}`}
              strokeDashoffset={count > 1 ? -(i * (dash + gap)) : 0}
            />
          ))
        )}
      </svg>
      <img
        src={src || defaultImg}
        alt=""
        className="rounded-full object-cover absolute"
        style={{
          width: size,
          height: size,
          left: ringPad,
          top: ringPad,
        }}
        loading="lazy"
      />
      {showAddBadge && (
        <span className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center ring-2 ring-base-100 shadow">
          <Plus className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export default memo(StatusAvatarRing);
