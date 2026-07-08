import { useEffect } from "react";
import { useStatusStore } from "../../store/useStatusStore";
import { useAuthStore } from "../../store/useAuthStore";
import StatusAvatarRing from "./StatusAvatarRing";
import { formatStatusTime } from "../../hooks/useStoryProgress";

/**
 * Horizontal WhatsApp-style status tray (My status + contacts).
 * Subscribes to live socket updates so rings update without refresh.
 */
export default function StatusRingList() {
  const authUser = useAuthStore((s) => s.authUser);
  const {
    feed,
    myStatus,
    isFeedLoading,
    loadFeed,
    openCreate,
    openViewer,
  } = useStatusStore();

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Soft refresh when tab becomes visible again
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) loadFeed(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadFeed]);

  const openOwn = () => {
    if (myStatus?.statuses?.length) {
      const idx = feed.findIndex((g) => g.isOwn);
      openViewer(feed, Math.max(0, idx), 0);
    } else {
      openCreate();
    }
  };

  const openGroup = (group) => {
    const idx = feed.findIndex((g) => g.user._id === group.user._id);
    openViewer(feed, Math.max(0, idx), 0);
  };

  const others = feed.filter((g) => !g.isOwn);

  return (
    <div className="status-tray md:hidden lg:block border-b border-base-300/60 bg-base-100 shrink-0">
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-wide uppercase text-base-content/45">
          Status
        </p>
        {isFeedLoading && (
          <span className="loading loading-spinner loading-xs text-base-content/30" />
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto px-3 pb-3 custom-scrollbar status-tray-scroll">
        {/* My status — tap opens viewer (or picker if empty); + always adds */}
        <div className="flex flex-col items-center gap-1 w-[68px] flex-shrink-0 relative">
          <div className="relative">
            <StatusAvatarRing
              src={authUser?.profilePic}
              alt="My status"
              segments={myStatus?.statuses?.length || 0}
              hasUnseen={false}
              isOwn
              size={52}
              showAddBadge={!myStatus?.statuses?.length}
              onClick={openOwn}
            />
            {!!myStatus?.statuses?.length && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openCreate();
                }}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center ring-2 ring-base-100 shadow z-10"
                title="Add status"
                aria-label="Add status"
              >
                <span className="text-sm font-bold leading-none">+</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={openOwn}
            className="text-[11px] text-base-content/70 truncate w-full text-center leading-tight"
          >
            {myStatus?.statuses?.length ? "My status" : "Add status"}
          </button>
        </div>

        {others.map((group) => (
          <div
            key={group.user._id}
            className="flex flex-col items-center gap-1 w-[68px] flex-shrink-0"
          >
            <StatusAvatarRing
              src={group.user.profilePic}
              alt={group.user.fullName}
              segments={group.statuses.length}
              hasUnseen={group.hasUnseen}
              size={52}
              onClick={() => openGroup(group)}
            />
            <button
              type="button"
              onClick={() => openGroup(group)}
              className="text-[11px] text-base-content/70 truncate w-full text-center leading-tight"
              title={formatStatusTime(group.latestAt)}
            >
              {group.user.fullName?.split(" ")[0] || "User"}
            </button>
          </div>
        ))}

        {!isFeedLoading && others.length === 0 && (
          <p className="text-xs text-base-content/40 self-center pl-1 whitespace-nowrap">
            No recent updates from friends
          </p>
        )}
      </div>
    </div>
  );
}
