import { memo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { chatFeaturesApi } from "../../lib/chatFeaturesApi";
import VideoMessage from "./VideoMessage";

const TABS = [
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "documents", label: "Documents" },
  { id: "links", label: "Links" },
];

function fileSizeLabel(bytes) {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const SharedMediaPanel = memo(function SharedMediaPanel({
  open,
  onClose,
  chatType,
  targetId,
}) {
  const [tab, setTab] = useState("images");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [zoom, setZoom] = useState(1);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (!targetId) return;
      setLoading(true);
      try {
        const res = await chatFeaturesApi.getSharedMedia(chatType, targetId, tab, nextPage);
        const newItems = res.data.items || [];
        setItems((prev) => (append ? [...prev, ...newItems] : newItems));
        setHasMore(res.data.hasMore);
        setPage(nextPage);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [chatType, targetId, tab]
  );

  useEffect(() => {
    if (open) {
      setItems([]);
      setPage(1);
      load(1, false);
    }
  }, [open, tab, load]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[85vh] bg-base-100 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <h3 className="font-bold text-lg">Shared Media</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-base-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-base-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[72px] py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-base-content/50 py-12">No items yet</p>
          ) : tab === "images" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  className="aspect-square rounded-lg overflow-hidden bg-base-200"
                  onClick={() => {
                    setPreview(m.image);
                    setZoom(1);
                  }}
                >
                  <img src={m.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          ) : tab === "videos" ? (
            <div className="space-y-3">
              {items.map((m) => (
                <VideoMessage
                  key={m._id}
                  video={m.video}
                  thumbnail={m.videoThumbnail}
                  duration={m.videoDuration}
                />
              ))}
            </div>
          ) : tab === "documents" ? (
            <div className="space-y-2">
              {items.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-base-200/60 border border-base-300/50"
                >
                  <FileText className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.fileName || "Document"}</p>
                    <p className="text-xs text-base-content/50">{m.text}</p>
                  </div>
                  <a
                    href={m.file}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-primary text-primary-content"
                  >
                    <Download size={16} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((m) =>
                (m.links || []).map((link, i) => (
                  <a
                    key={`${m._id}-${i}`}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 rounded-xl bg-base-200/60 border border-base-300/50 hover:bg-base-200"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink size={16} className="shrink-0 mt-0.5 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{link}</p>
                        {m.text && (
                          <p className="text-xs text-base-content/60 line-clamp-2 mt-1">{m.text}</p>
                        )}
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              disabled={loading}
              onClick={() => load(page + 1, true)}
              className="w-full mt-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-xl"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[190] bg-black/95 flex flex-col items-center justify-center"
          onClick={() => setPreview(null)}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              className="text-white bg-white/10 px-3 py-1 rounded-lg text-sm"
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => Math.min(3, z + 0.25));
              }}
            >
              Zoom +
            </button>
            <button
              type="button"
              className="text-white bg-white/10 px-3 py-1 rounded-lg text-sm"
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
              }}
            >
              Close
            </button>
          </div>
          <img
            src={preview}
            alt=""
            className="max-w-full max-h-[80vh] object-contain transition-transform"
            style={{ transform: `scale(${zoom})` }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>,
    document.body
  );
});

export default SharedMediaPanel;
