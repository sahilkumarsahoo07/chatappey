import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Trash2 } from "lucide-react";

const SWIPE_OPEN = 88;
const SWIPE_THRESHOLD = 48;
const LONG_PRESS_MS = 480;

/**
 * Sidebar chat row:
 * - Phone: swipe left → Delete · long-press → confirm
 * - Desktop: ⋮ → Delete chat (portal menu, never clipped)
 */
export default function SidebarChatRow({
  children,
  isSelected,
  hasUnread,
  onOpen,
  onDelete,
  showDelete = true,
  className = "",
}) {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const startX = useRef(0);
  const startY = useRef(0);
  const mode = useRef(null);
  const longPressTimer = useRef(null);
  const openedBySwipe = useRef(false);
  const offsetRef = useRef(0);
  const menuBtnRef = useRef(null);
  const rowRef = useRef(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closeSwipe = () => {
    offsetRef.current = 0;
    setOffset(0);
    setSwiping(false);
  };

  const requestDelete = () => {
    closeSwipe();
    setMenuOpen(false);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  // Position desktop menu with portal (avoids clipping / sticky top cut-off)
  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return;
    const rect = menuBtnRef.current.getBoundingClientRect();
    const menuW = 176;
    const menuH = 52;
    let top = rect.bottom + 6;
    let left = rect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) {
      left = window.innerWidth - menuW - 8;
    }
    // If near bottom of viewport, open upward
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 6);
    }
    setMenuPos({ top, left });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && !confirmOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, confirmOpen]);

  // Close open swipe when another row is tapped / scrolling list
  useEffect(() => {
    const onScroll = () => {
      if (offsetRef.current !== 0) closeSwipe();
    };
    const list = rowRef.current?.closest(".overflow-y-auto");
    list?.addEventListener("scroll", onScroll, { passive: true });
    return () => list?.removeEventListener("scroll", onScroll);
  }, []);

  // Phone list only — not tablet icon rail (md–lg) or desktop (lg+)
  const isPhoneList = () => window.matchMedia("(max-width: 767px)").matches;

  const onTouchStart = (e) => {
    if (!showDelete || !isPhoneList()) return;
    const t = e.touches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    mode.current = "pending";
    openedBySwipe.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      if (mode.current === "pending") {
        mode.current = "longpress";
        if (navigator.vibrate) navigator.vibrate(35);
        setConfirmOpen(true);
      }
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e) => {
    if (!showDelete || !isPhoneList()) return;
    if (mode.current === "longpress" || mode.current === "scroll") return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (mode.current === "pending") {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        mode.current = "scroll";
        clearLongPress();
        closeSwipe();
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        mode.current = "swipe";
        setSwiping(true);
        clearLongPress();
      } else return;
    }

    if (mode.current !== "swipe") return;
    if (e.cancelable) e.preventDefault();
    const next = Math.max(-SWIPE_OPEN, Math.min(0, dx));
    offsetRef.current = next;
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (!showDelete || !isPhoneList()) return;
    clearLongPress();
    if (mode.current === "swipe") {
      if (offsetRef.current <= -SWIPE_THRESHOLD) {
        offsetRef.current = -SWIPE_OPEN;
        setOffset(-SWIPE_OPEN);
        openedBySwipe.current = true;
      } else {
        closeSwipe();
      }
    }
    setSwiping(false);
    mode.current = null;
  };

  const handleRowClick = () => {
    if (openedBySwipe.current || offsetRef.current < -10) {
      closeSwipe();
      openedBySwipe.current = false;
      return;
    }
    onOpen?.();
  };

  // Opaque backgrounds only (no translucent pink bleed)
  const rowBgClass = isSelected ? "bg-base-200" : "bg-base-100";
  const unreadAccent = hasUnread && !isSelected ? "border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent";

  const showSwipeDelete = offset < -8;

  return (
    <>
      <div
        ref={rowRef}
        className={`relative overflow-hidden border-b border-base-200/50 last:border-0 ${className}`}
      >
        {/* Delete lane — only while finger-swiped open on phones */}
        {showSwipeDelete && (
          <button
            type="button"
            aria-label="Delete chat"
            onClick={(e) => {
              e.stopPropagation();
              requestDelete();
            }}
            className="absolute inset-y-0 right-0 w-[88px] z-0
              bg-error text-error-content
              flex flex-col items-center justify-center gap-0.5
              active:brightness-90 md:hidden"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[11px] font-bold leading-none">Delete</span>
          </button>
        )}

        <div
          className={`relative z-[1] ${rowBgClass} will-change-transform`}
          style={{
            transform: `translateX(${offset}px)`,
            transition: swiping ? "none" : "transform 0.2s ease-out",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => {
            clearLongPress();
            mode.current = null;
            setSwiping(false);
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={handleRowClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRowClick();
              }
            }}
            className={`w-full px-3 sm:px-4 py-3 flex items-center gap-3 cursor-pointer outline-none relative ${rowBgClass} ${unreadAccent}`}
          >
            {children}

            {/* Desktop wide sidebar only — delete for active chats */}
            {showDelete && (
            <button
              ref={menuBtnRef}
              type="button"
              aria-label="Chat options"
              className="hidden lg:flex flex-shrink-0 w-8 h-8 rounded-full items-center justify-center
                text-base-content/40 hover:text-base-content hover:bg-base-300/70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop menu via portal — never clipped by list overflow */}
      {menuOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[140]"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="fixed z-[150] min-w-[176px] rounded-xl bg-base-100 border border-base-300
                shadow-2xl overflow-hidden animate-[menuPop_0.12s_ease-out]"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-error
                  hover:bg-error/10 transition-colors"
                onClick={requestDelete}
              >
                <Trash2 className="w-4 h-4" />
                Delete chat
              </button>
            </div>
            <style>{`
              @keyframes menuPop {
                from { opacity: 0; transform: scale(0.96) translateY(-4px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
          </>,
          document.body
        )}

      {/* Confirm sheet */}
      {confirmOpen &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !deleting && setConfirmOpen(false)}
            />
            <div
              className="relative w-full sm:max-w-sm bg-base-100 rounded-t-3xl sm:rounded-2xl
                shadow-2xl border border-base-200 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4
                animate-[sidebarSheetIn_0.2s_ease-out]"
            >
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-base-300" />
              </div>
              <div className="px-5 pt-3 pb-2 text-center">
                <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-error/10 flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-error" />
                </div>
                <h3 className="text-lg font-bold">Delete this chat?</h3>
                <p className="text-sm text-base-content/60 mt-1.5 leading-relaxed">
                  Removed for you only. Your friend will still see the chat.
                </p>
              </div>
              <div className="px-4 pt-2 pb-3 space-y-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="w-full py-3.5 rounded-xl bg-error text-error-content font-semibold
                    active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete for me"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(false)}
                  className="w-full py-3 rounded-xl bg-base-200 font-medium hover:bg-base-300"
                >
                  Cancel
                </button>
              </div>
            </div>
            <style>{`
              @keyframes sidebarSheetIn {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>,
          document.body
        )}
    </>
  );
}
