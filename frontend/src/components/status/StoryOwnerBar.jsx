import { memo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Eye, Heart, MessageCircle, Smile, ChevronUp } from "lucide-react";
import StoryReactionSummary from "./StoryReactionSummary";

const SWIPE_UP_PX = 48;

/**
 * Premium owner controls: stats, reaction summary, swipe-up for insights.
 */
const StoryOwnerBar = memo(function StoryOwnerBar({
  status,
  onAddStatus,
  onOpenInsights,
  reactionSummary,
}) {
  const touchY = useRef(0);

  const onTouchStart = useCallback((e) => {
    touchY.current = e.touches[0]?.clientY ?? 0;
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (touchY.current - endY >= SWIPE_UP_PX) {
        onOpenInsights?.("overview");
      }
    },
    [onOpenInsights]
  );

  const likeCount = status?.likeCount || 0;
  const reactionCount = Object.values(reactionSummary || {}).reduce((s, n) => s + n, 0);
  const viewCount = status?.viewerCount || 0;
  const commentCount = status?.commentCount || 0;

  return (
    <div
      className="absolute bottom-0 inset-x-0 z-30 pb-[max(12px,env(safe-area-inset-bottom))] px-4 pt-16 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <StoryReactionSummary
          likeCount={likeCount}
          reactionSummary={reactionSummary}
          onOpenInsights={() => onOpenInsights?.("reactions")}
        />

        <motion.button
          type="button"
          onClick={() => onOpenInsights?.("overview")}
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/45 font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ChevronUp className="w-3 h-3" />
          Swipe up for insights
        </motion.button>

        <div className="w-full flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onAddStatus}
            className="text-sm font-semibold px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm"
          >
            Add status
          </button>

          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-white/90">
            <StatPill
              icon={<Eye className="w-3.5 h-3.5" />}
              value={viewCount}
              label="Views"
              onClick={() => onOpenInsights?.("views")}
            />
            <StatPill
              icon={<Heart className="w-3.5 h-3.5 text-rose-300" />}
              value={likeCount}
              label="Likes"
              onClick={() => onOpenInsights?.("likes")}
            />
            <StatPill
              icon={<Smile className="w-3.5 h-3.5" />}
              value={reactionCount}
              label="Reactions"
              onClick={() => onOpenInsights?.("reactions")}
            />
            {commentCount > 0 && (
              <StatPill
                icon={<MessageCircle className="w-3.5 h-3.5" />}
                value={commentCount}
                label="Comments"
                onClick={() => onOpenInsights?.("comments")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function StatPill({ icon, value, label, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-white/10 backdrop-blur-sm tabular-nums"
      whileTap={{ scale: 0.94 }}
      aria-label={label}
    >
      {icon}
      <span className="font-semibold">{value}</span>
    </motion.button>
  );
}

export default StoryOwnerBar;
