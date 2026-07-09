import "./WallpaperPicker.css";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Image, Link2, Palette, Sparkles, Sun, Moon, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  CHAT_WALLPAPERS,
  getDefaultWallpaper,
  resolveWallpaperPreviewStyle,
  isWallpaperDark,
} from "../../lib/chatWallpaper";

const TABS = [
  { id: "gallery", label: "Wallpapers", icon: Image },
  { id: "bright", label: "Bright", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "solid", label: "Colors", icon: Palette },
  { id: "custom", label: "My Photo", icon: Upload },
];

const GALLERY_CATEGORIES = ["Nature", "City", "Night", "Travel", "Abstract"];

function ImageGalleryGrid({ items, draft, onPick }) {
  return (
    <div className="wallpaper-gallery-sections">
      {GALLERY_CATEGORIES.map((category) => {
        const categoryItems = items.filter((i) => i.category === category);
        if (!categoryItems.length) return null;
        return (
          <div key={category} className="wallpaper-gallery-section">
            <p className="wallpaper-section-label">{category}</p>
            <div className="wallpaper-gallery-grid">
              {categoryItems.map((item) => {
                const isActive = draft.type === "image" && draft.value === item.value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`wallpaper-gallery-tile ${isActive ? "is-active" : ""}`}
                    onClick={() => onPick(item)}
                    title={item.name}
                  >
                    <img src={item.preview} alt={item.name} loading="lazy" decoding="async" />
                    <span className="wallpaper-gallery-tile__name">{item.name}</span>
                    {isActive && (
                      <span className="wallpaper-gallery-tile__check">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WallpaperPreview({ draft }) {
  const dark = isWallpaperDark(draft);
  const previewStyle = resolveWallpaperPreviewStyle(draft);

  return (
    <div className="wallpaper-preview">
      {/* Wallpaper Background Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: previewStyle.background,
          backgroundSize: previewStyle.backgroundSize,
          filter: previewStyle.filter,
        }}
      />
      <div className="wallpaper-preview__bubbles z-10">
        <div
          className={`wallpaper-preview__bubble wallpaper-preview__bubble--in ${dark ? "is-dark" : ""}`}
        >
          Hey! How are you? 👋
        </div>
        <div
          className={`wallpaper-preview__bubble wallpaper-preview__bubble--out ${dark ? "is-dark" : ""}`}
        >
          I&apos;m good, thanks!
        </div>
        <div
          className={`wallpaper-preview__bubble wallpaper-preview__bubble--in ${dark ? "is-dark" : ""}`}
        >
          Nice wallpaper choice 😊
        </div>
      </div>
    </div>
  );
}

function SwatchGrid({ items, draft, onPick, variant = "circle", itemType = "solid" }) {
  return (
    <div className="wallpaper-swatch-grid">
      {items.map((item) => {
        const isActive =
          draft.type === itemType &&
          draft.value === item.value &&
          (itemType === "solid" && item.doodleTheme
            ? draft.doodleTheme === item.doodleTheme
            : true);
        return (
          <button
            key={item.id}
            type="button"
            title={item.name}
            onClick={() => onPick(item)}
            className={`wallpaper-swatch wallpaper-swatch--${variant} ${isActive ? "is-active" : ""}`}
            style={{
              background: item.preview || item.value,
              backgroundSize: "cover",
            }}
          >
            {variant === "rect" && (
              <span className="wallpaper-swatch__label">{item.name}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const WallpaperPicker = memo(function WallpaperPicker({ open, onClose, wallpaper, onApply }) {
  const [draft, setDraft] = useState(wallpaper || getDefaultWallpaper());
  const [tab, setTab] = useState("gallery");
  const [customUrl, setCustomUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft(wallpaper || getDefaultWallpaper());
      setTab("gallery");
      setCustomUrl("");
    }
  }, [open, wallpaper]);

  const patchDraft = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const pickSolid = useCallback(
    (item, category) => {
      const isDarkCat = category === "dark";
      setDraft({
        type: "solid",
        value: item.value,
        blur: draft.blur ?? 0,
        brightness: draft.brightness ?? 100,
        doodle: isDarkCat || category === "bright" ? true : draft.doodle ?? false,
        doodleTheme: item.doodleTheme || (isDarkCat ? "dark" : "light"),
      });
    },
    [draft.blur, draft.brightness, draft.doodle]
  );

  const pickGradient = useCallback(
    (item) => {
      setDraft({
        type: "gradient",
        value: item.value,
        blur: draft.blur ?? 0,
        brightness: draft.brightness ?? 100,
        doodle: false,
      });
    },
    [draft.blur, draft.brightness]
  );

  const pickGallery = useCallback(
    (item) => {
      setDraft({
        type: "image",
        value: item.value,
        blur: draft.blur ?? 0,
        brightness: draft.brightness ?? 100,
        doodle: false,
      });
    },
    [draft.blur, draft.brightness]
  );

  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxW = 900;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          if (dataUrl.length > 600_000) {
            reject(new Error("Image too large after compression"));
            return;
          }
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setDraft({
        type: "image",
        value: dataUrl,
        blur: draft.blur ?? 0,
        brightness: draft.brightness ?? 100,
        doodle: false,
      });
      toast.success("Photo added");
    } catch {
      toast.error("Image too large — try a smaller photo or use a URL");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const apply = () => {
    onApply(draft);
    onClose();
  };

  if (!open) return null;

  const showDoodleToggle =
    draft.type === "solid" ||
    draft.type === "gradient" ||
    (draft.type === "default" && tab !== "gallery");

  return createPortal(
    <div className="wallpaper-picker-overlay">
      <div className="wallpaper-picker-backdrop" onClick={onClose} aria-hidden />
      <div className="wallpaper-picker-sheet" role="dialog" aria-label="Chat wallpaper">
        <div className="wallpaper-picker-header">
          <h3 className="wallpaper-picker-title">Chat Wallpaper</h3>
          <button type="button" className="wallpaper-picker-close" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="wallpaper-section-label">Preview</p>
        <WallpaperPreview draft={draft} />

        {/* WhatsApp-style doodle toggle */}
        {showDoodleToggle && (
          <label className="wallpaper-doodle-toggle">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">WhatsApp doodle</span>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={Boolean(draft.doodle)}
              onChange={(e) =>
                patchDraft({
                  doodle: e.target.checked,
                  doodleTheme:
                    draft.doodleTheme ||
                    (isWallpaperDark(draft) ? "dark" : "light"),
                })
              }
            />
          </label>
        )}

        {/* Category tabs */}
        <div className="wallpaper-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`wallpaper-tab ${tab === id ? "is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="wallpaper-tab-panel">
          {tab === "bright" && (
            <>
              <p className="wallpaper-hint">Light tones with doodle pattern (like WhatsApp)</p>
              <SwatchGrid
                items={CHAT_WALLPAPERS.bright}
                draft={draft}
                itemType="solid"
                onPick={(item) => pickSolid(item, "bright")}
              />
            </>
          )}

          {tab === "dark" && (
            <>
              <p className="wallpaper-hint">Dark wallpapers for night chats</p>
              <SwatchGrid
                items={CHAT_WALLPAPERS.dark}
                draft={draft}
                itemType="solid"
                onPick={(item) => pickSolid(item, "dark")}
              />
            </>
          )}

          {tab === "solid" && (
            <>
              <p className="wallpaper-section-label mt-0">Solid colors</p>
              <SwatchGrid
                items={CHAT_WALLPAPERS.solid}
                draft={draft}
                itemType="solid"
                onPick={(item) =>
                  pickSolid({ ...item, doodleTheme: "light" }, "solid")
                }
              />
              <p className="wallpaper-section-label">Gradients</p>
              <div className="wallpaper-gradient-scroll">
                <SwatchGrid
                  items={CHAT_WALLPAPERS.gradients}
                  draft={draft}
                  variant="rect"
                  itemType="gradient"
                  onPick={(item) => pickGradient(item)}
                />
              </div>
              <p className="wallpaper-section-label">Patterns</p>
              <div className="wallpaper-pattern-row">
                {CHAT_WALLPAPERS.patterns.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`wallpaper-pattern-btn ${draft.type === "pattern" && draft.value === p.value ? "is-active" : ""}`}
                    onClick={() =>
                      setDraft({
                        type: "pattern",
                        value: p.value,
                        blur: draft.blur ?? 0,
                        brightness: draft.brightness ?? 100,
                        doodle: false,
                        doodleTheme: p.value === "doodle" ? "light" : undefined,
                      })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "gallery" && (
            <>
              <p className="wallpaper-hint">Tap a photo to set as chat wallpaper</p>
              <ImageGalleryGrid
                items={CHAT_WALLPAPERS.gallery}
                draft={draft}
                onPick={pickGallery}
              />
            </>
          )}

          {tab === "custom" && (
            <>
              <button
                type="button"
                className="wallpaper-upload-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-5 h-5" />
                {uploading ? "Processing…" : "Choose from device"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              <p className="wallpaper-section-label">Or paste image URL</p>
              <div className="wallpaper-url-row">
                <Link2 className="w-4 h-4 shrink-0 opacity-50" />
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="input input-sm input-bordered flex-1"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    if (!customUrl.trim()) return;
                    setDraft({
                      type: "image",
                      value: customUrl.trim(),
                      blur: draft.blur ?? 0,
                      brightness: draft.brightness ?? 100,
                      doodle: false,
                    });
                    toast.success("URL applied to preview");
                  }}
                >
                  Use
                </button>
              </div>
            </>
          )}
        </div>

        {/* Adjustments */}
        <div className="wallpaper-adjustments">
          <div className="wallpaper-slider-row">
            <label>Blur</label>
            <span>{draft.blur || 0}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={draft.blur || 0}
            onChange={(e) => patchDraft({ blur: Number(e.target.value) })}
            className="range range-xs range-primary w-full"
            style={{ touchAction: "none" }}
          />

          <div className="wallpaper-slider-row">
            <label>Brightness</label>
            <span>{draft.brightness ?? 100}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={140}
            value={draft.brightness ?? 100}
            onChange={(e) => patchDraft({ brightness: Number(e.target.value) })}
            className="range range-xs range-primary w-full"
            style={{ touchAction: "none" }}
          />
        </div>

        <div className="wallpaper-actions">
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={() => setDraft(getDefaultWallpaper())}
          >
            Reset
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={apply}>
            Set wallpaper
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default WallpaperPicker;
