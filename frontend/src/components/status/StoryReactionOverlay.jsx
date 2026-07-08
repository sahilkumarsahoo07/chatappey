import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";

const floatEase = [0.22, 1, 0.36, 1];

const FloatingEmoji = memo(function FloatingEmoji({ particle, onDone }) {
  const { emoji, x, size, rotate, duration, delay, drift } = particle;

  return (
    <motion.span
      className="absolute bottom-[18%] pointer-events-none select-none will-change-transform"
      style={{
        left: `${x}%`,
        fontSize: `${size * 2.75}rem`,
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
        zIndex: 25,
      }}
      initial={{
        y: 0,
        x: 0,
        opacity: 0,
        scale: 0.55,
        rotate: rotate - 8,
      }}
      animate={{
        y: [0, -120, -280, -420],
        x: [0, drift * 0.35, drift * 0.7, drift],
        opacity: [0, 1, 0.92, 0],
        scale: [0.55, 1.08, 1, 0.88],
        rotate: [rotate - 8, rotate + 6, rotate - 4, rotate + 10],
      }}
      transition={{
        duration,
        delay,
        ease: floatEase,
        times: [0, 0.25, 0.65, 1],
      }}
      onAnimationComplete={onDone}
      aria-hidden
    >
      {emoji}
    </motion.span>
  );
});

const CenterHeart = memo(function CenterHeart() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-[35]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.span
        className="text-[5.5rem] sm:text-[7rem] leading-none"
        style={{
          filter:
            "drop-shadow(0 0 28px rgba(244,63,94,0.75)) drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
        }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.22, 1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.9, ease: floatEase, times: [0, 0.45, 1] }}
        aria-hidden
      >
        ❤️
      </motion.span>
    </motion.div>
  );
});

/**
 * Premium floating reaction layer for story owners.
 */
const StoryReactionOverlay = memo(function StoryReactionOverlay({
  particles,
  centerHeart,
  onParticleDone,
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[25]">
      <AnimatePresence>
        {centerHeart && <CenterHeart key="center-heart" />}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {particles.map((p) => (
          <FloatingEmoji
            key={p.id}
            particle={p}
            onDone={() => onParticleDone(p.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

export default StoryReactionOverlay;
