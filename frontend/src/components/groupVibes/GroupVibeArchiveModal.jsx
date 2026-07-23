import React from "react";
import { X, Archive, Calendar, Image, Video, Music } from "lucide-react";
import { useGroupVibeStore } from "../../store/useGroupVibeStore";
import { format } from "date-fns";

export const GroupVibeArchiveModal = () => {
  const { archiveOpen, archiveList, archiveLoading, closeArchiveModal } = useGroupVibeStore();

  if (!archiveOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-base-100 rounded-3xl p-5 shadow-2xl max-h-[80vh] flex flex-col border border-base-content/10">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-base-content/10">
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <Archive className="w-5 h-5" />
            <span>My Group Vibes Archive</span>
          </div>
          <button type="button" onClick={closeArchiveModal} className="btn btn-sm btn-ghost btn-circle">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto py-4">
          {archiveLoading ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : archiveList.length === 0 ? (
            <div className="text-center py-12 text-sm text-base-content/60">
              No archived vibes found for this group.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {archiveList.map((vibe) => (
                <div
                  key={vibe._id}
                  className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 shadow border border-base-content/10 group"
                >
                  {vibe.mediaType === "video" ? (
                    <video src={vibe.mediaUrl} className="w-full h-full object-cover" />
                  ) : vibe.mediaType === "photo" ? (
                    <img src={vibe.mediaUrl} alt="Archived Vibe" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs font-bold text-white bg-gradient-to-tr from-purple-600 to-indigo-600">
                      {vibe.text}
                    </div>
                  )}

                  {/* Badge & Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-2 flex flex-col justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between text-[10px] text-white/80">
                      <span>{vibe.mediaType.toUpperCase()}</span>
                      {vibe.music?.title && <Music className="w-3 h-3 text-rose-400" />}
                    </div>
                    <div>
                      {vibe.text && <p className="text-xs font-medium text-white truncate">{vibe.text}</p>}
                      <p className="text-[10px] text-white/60">
                        {format(new Date(vibe.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
