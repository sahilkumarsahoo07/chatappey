import { Bell, BellOff } from "lucide-react";

export default function MuteOptionsSheet({ open, onClose, isMuted, onMute, onUnmute }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-base-100 rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-base-300 mx-auto mb-4" />
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          {isMuted ? <BellOff size={20} /> : <Bell size={20} />}
          {isMuted ? "Unmute notifications" : "Mute notifications"}
        </h3>
        {isMuted ? (
          <button type="button" className="btn btn-primary w-full" onClick={onUnmute}>
            Unmute
          </button>
        ) : (
          <div className="space-y-2">
            {[
              { id: "8h", label: "8 hours" },
              { id: "1w", label: "1 week" },
              { id: "always", label: "Always" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="w-full py-3 rounded-xl bg-base-200 hover:bg-base-300 font-medium text-left px-4"
                onClick={() => onMute(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
