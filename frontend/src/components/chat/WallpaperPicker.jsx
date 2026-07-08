import { memo, useState } from "react";
import { CHAT_WALLPAPERS, getDefaultWallpaper } from "../../lib/chatWallpaper";

const WallpaperPicker = memo(function WallpaperPicker({ open, onClose, wallpaper, onApply }) {
  const [draft, setDraft] = useState(wallpaper || getDefaultWallpaper());
  const [customUrl, setCustomUrl] = useState("");

  if (!open) return null;

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-base-100 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto p-4">
        <h3 className="font-bold text-lg mb-3">Chat Wallpaper</h3>

        <p className="text-xs font-semibold text-base-content/60 mb-2">Preview</p>
        <div
          className="h-28 rounded-xl border border-base-300 mb-4 relative overflow-hidden"
          style={{
            background:
              draft.type === "default"
                ? "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))"
                : draft.type === "image"
                  ? `url(${draft.value}) center/cover`
                  : draft.type === "gradient"
                    ? draft.value
                    : draft.type === "pattern"
                      ? "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)"
                      : draft.value,
            filter: `blur(${draft.blur || 0}px) brightness(${(draft.brightness ?? 100) / 100})`,
          }}
        />

        <p className="text-xs font-semibold text-base-content/60 mb-2">Solid</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {CHAT_WALLPAPERS.solid.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.name}
              onClick={() => setDraft({ type: "solid", value: s.value, blur: draft.blur, brightness: draft.brightness })}
              className="w-10 h-10 rounded-full border-2 border-base-300"
              style={{ background: s.preview }}
            />
          ))}
        </div>

        <p className="text-xs font-semibold text-base-content/60 mb-2">Gradients</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {CHAT_WALLPAPERS.gradients.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setDraft({ type: "gradient", value: g.value, blur: draft.blur, brightness: draft.brightness })}
              className="w-14 h-10 rounded-lg border border-base-300"
              style={{ background: g.preview }}
            />
          ))}
        </div>

        <p className="text-xs font-semibold text-base-content/60 mb-2">Patterns</p>
        <div className="flex gap-2 mb-3">
          {CHAT_WALLPAPERS.patterns.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDraft({ type: "pattern", value: p.value, blur: draft.blur, brightness: draft.brightness })}
              className="w-14 h-10 rounded-lg border border-base-300 bg-base-200"
            >
              {p.name}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-base-content/60 mb-2">Custom image URL</p>
        <div className="flex gap-2 mb-3">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://…"
            className="input input-sm input-bordered flex-1"
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => customUrl && setDraft({ type: "image", value: customUrl, blur: draft.blur, brightness: draft.brightness })}
          >
            Use
          </button>
        </div>

        <label className="text-xs font-semibold text-base-content/60">Blur: {draft.blur || 0}px</label>
        <input
          type="range"
          min={0}
          max={20}
          value={draft.blur || 0}
          onChange={(e) => setDraft({ ...draft, blur: Number(e.target.value) })}
          className="range range-xs range-primary w-full mb-3"
        />

        <label className="text-xs font-semibold text-base-content/60">Brightness: {draft.brightness ?? 100}%</label>
        <input
          type="range"
          min={40}
          max={140}
          value={draft.brightness ?? 100}
          onChange={(e) => setDraft({ ...draft, brightness: Number(e.target.value) })}
          className="range range-xs range-primary w-full mb-4"
        />

        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={() => setDraft(getDefaultWallpaper())}>
            Reset
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
});

export default WallpaperPicker;
