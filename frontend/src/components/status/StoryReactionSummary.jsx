import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";

function buildSummary(likeCount, reactionSummary) {
  const parts = [];
  if (likeCount > 0) parts.push({ emoji: "❤️", count: likeCount });
  for (const [emoji, count] of Object.entries(reactionSummary || {})) {
    if (count > 0 && emoji !== "❤️") parts.push({ emoji, count });
  }
  parts.sort((a, b) => b.count - a.count);
  const total = parts.reduce((sum, p) => sum + p.count, 0);
  const top = parts.slice(0, 3);
  const topSum = top.reduce((s, p) => s + p.count, 0);
  return { top, total, overflow: Math.max(0, total - topSum) };
}

/**
 * Compact reaction summary — tap to open insights.
 */
const StoryReactionSummary = memo(function StoryReactionSummary({
  likeCount = 0,
  reactionSummary = {},
  onOpenInsights,
}) {
  const { top, total, overflow } = useMemo(
    () => buildSummary(likeCount, reactionSummary),
    [likeCount, reactionSummary]
  );

  if (total === 0) return null;

  return (
    <motion.button
      type="button"
      onClick={onOpenInsights}
      className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/45 backdrop-blur-md border border-white/15 shadow-lg text-white/95 text-sm font-semibold"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.96 }}
      aria-label="View reaction details"
    >
      <span className="flex items-center gap-1 text-base leading-none">
        {top.map((p) => (
          <span key={p.emoji} className="inline-flex items-center gap-0.5">
            <span>{p.emoji}</span>
            <span className="text-[11px] font-bold text-white/70 tabular-nums">{p.count}</span>
          </span>
        ))}
      </span>
      {overflow > 0 && (
        <span className="text-xs font-bold text-white/60 tabular-nums">+{overflow}</span>
      )}
      <ChevronUp className="w-3.5 h-3.5 text-white/50 ml-0.5" />
    </motion.button>
  );
});

export default StoryReactionSummary;
