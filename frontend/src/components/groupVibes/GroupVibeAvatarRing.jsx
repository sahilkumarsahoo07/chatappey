import React, { useEffect } from "react";
import { useGroupVibeStore } from "../../store/useGroupVibeStore";

/**
 * Animated Gradient Ring wrapper around Group Avatars
 * Triggers full-screen Group Vibe Viewer on click if active vibes exist.
 */
export const GroupVibeAvatarRing = ({
  groupId,
  groupName,
  groupImage,
  size = 48,
  onClickOverride = null,
  showPlusIfNoVibe = false,
  children,
}) => {
  const { summaries, groupVibesMap, fetchGroupVibes, setViewerOpen, setCreatorOpen } =
    useGroupVibeStore();

  const summary = summaries[groupId];
  const hasActiveVibes = summary?.totalCount > 0;
  const hasUnseen = summary?.hasUnseen;

  const handleClick = async (e) => {
    e.stopPropagation();
    if (onClickOverride) {
      onClickOverride();
      return;
    }

    if (hasActiveVibes) {
      let vibes = groupVibesMap[groupId];
      if (!vibes || vibes.length === 0) {
        vibes = await fetchGroupVibes(groupId);
      }
      if (vibes && vibes.length > 0) {
        // Find first unseen index, or 0
        const firstUnseenIdx = vibes.findIndex((v) => !v.viewedByMe);
        setViewerOpen(true, groupId, firstUnseenIdx >= 0 ? firstUnseenIdx : 0);
      } else {
        setCreatorOpen(true, groupId);
      }
    } else {
      setCreatorOpen(true, groupId);
    }
  };

  return (
    <div
      className="relative inline-flex items-center justify-center cursor-pointer select-none group/avatar"
      onClick={handleClick}
      title={hasActiveVibes ? `${groupName || "Group"} Vibes available` : "Add Group Vibe"}
    >
      {/* Animated Vibe Ring */}
      {hasActiveVibes && (
        <div
          className={`absolute inset-[-3px] rounded-full p-[2.5px] transition-all duration-300 ${
            hasUnseen
              ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 animate-pulse shadow-md shadow-rose-500/20"
              : "bg-gradient-to-tr from-slate-400 to-slate-600 opacity-60"
          }`}
          style={{
            borderRadius: "50%",
          }}
        >
          <div className="w-full h-full bg-base-100 rounded-full" />
        </div>
      )}

      {/* Avatar Container */}
      <div
        className="relative rounded-full overflow-hidden flex items-center justify-center bg-base-300 border border-base-content/10 shadow-sm transition-transform duration-200 group-hover/avatar:scale-[1.03]"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {children ? (
          children
        ) : groupImage ? (
          <img
            src={groupImage}
            alt={groupName || "Group"}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-bold text-lg text-primary">
            {(groupName || "G").charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Plus badge if no active vibe and enabled */}
      {!hasActiveVibes && showPlusIfNoVibe && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCreatorOpen(true, groupId);
          }}
          className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold border-2 border-base-100 shadow"
        >
          +
        </button>
      )}

      {/* Music Note Vibe Indicator Badge */}
      {hasActiveVibes && (
        <div className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-full p-1 shadow-sm border border-base-100 animate-bounce">
          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      )}
    </div>
  );
};
