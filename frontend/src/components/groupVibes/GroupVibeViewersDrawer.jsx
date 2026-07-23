import React from "react";
import { X, Eye, Heart } from "lucide-react";
import { useGroupVibeStore } from "../../store/useGroupVibeStore";
import { formatDistanceToNow } from "date-fns";

export const GroupVibeViewersDrawer = () => {
  const { viewersDrawerOpen, viewersList, viewersLoading, closeViewersDrawer } =
    useGroupVibeStore();

  if (!viewersDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-base-100 rounded-t-3xl p-4 shadow-2xl max-h-[60vh] flex flex-col border-t border-base-content/10 animate-in slide-in-from-bottom duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-base-content/10">
          <div className="flex items-center gap-2 font-bold text-base">
            <Eye className="w-5 h-5 text-primary" />
            <span>Vibe Viewers ({viewersList.length})</span>
          </div>
          <button
            type="button"
            onClick={closeViewersDrawer}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewers List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {viewersLoading ? (
            <div className="flex justify-center p-6">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : viewersList.length === 0 ? (
            <div className="text-center py-8 text-sm text-base-content/60">
              No viewers yet. Be the first to vibe!
            </div>
          ) : (
            viewersList.map(({ user, viewedAt, reaction }) => (
              <div
                key={user._id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-base-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full object-cover border border-base-content/10"
                  />
                  <div>
                    <p className="font-semibold text-sm leading-tight">{user.fullName}</p>
                    <p className="text-[11px] text-base-content/50">
                      {viewedAt
                        ? formatDistanceToNow(new Date(viewedAt), { addSuffix: true })
                        : "Just now"}
                    </p>
                  </div>
                </div>

                {reaction && (
                  <span className="text-xl p-1 bg-base-300 rounded-full shadow-sm">
                    {reaction}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
