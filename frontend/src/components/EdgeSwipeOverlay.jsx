/**
 * Edge swipe overlay — iOS-style interactive back gesture.
 */
export default function EdgeSwipeOverlay({ offset, dragging, progress }) {
  if (!dragging && offset <= 0) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[90] pointer-events-none"
        style={{
          background: `rgba(0,0,0,${0.18 * Math.min(1, progress)})`,
        }}
      />
      <div
        className="fixed left-0 top-0 bottom-0 z-[91] pointer-events-none"
        style={{
          width: 4,
          background: "linear-gradient(90deg, rgba(99,102,241,0.55), transparent)",
          opacity: Math.min(1, progress * 1.4),
          transform: `translateX(${Math.min(offset, 60)}px)`,
        }}
      />
    </>
  );
}
