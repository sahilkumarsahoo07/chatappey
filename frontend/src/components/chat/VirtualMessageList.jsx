import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

const BOTTOM_THRESHOLD = 100;
const TOP_LOAD_THRESHOLD = 80;

/**
 * WhatsApp-style virtualized message list:
 * - Opens pinned to latest message
 * - Reverse infinite scroll loads older pages without jumping
 * - Only auto-scrolls to bottom when pinBottom is active
 */
function VirtualMessageList({
  items,
  containerRef,
  className,
  style,
  onScroll,
  getItemKey,
  renderItem,
  header,
  footer,
  onReachTop,
  hasMoreOlder,
  isLoadingOlder,
  scrollToBottomKey,
  onAtBottomChange,
}) {
  const reachTopLock = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const prevItemsLenRef = useRef(0);
  const wasLoadingOlderRef = useRef(false);
  const pinBottomRef = useRef(true);
  const pendingRestoreRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 88,
    overscan: 12,
    getItemKey: (index) => {
      const item = items[index];
      return getItemKey ? getItemKey(item, index) : item?.optimisticId || item?._id || index;
    },
    measureElement:
      typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
        ? (el) => el?.getBoundingClientRect().height
        : undefined,
  });

  const totalSize = virtualizer.getTotalSize();

  const scrollToBottomInstant = useCallback(() => {
    const el = containerRef.current;
    if (!el || items.length === 0) return;
    virtualizer.scrollToIndex(items.length - 1, { align: "end", behavior: "auto" });
    el.scrollTop = el.scrollHeight;
  }, [containerRef, items.length, virtualizer]);

  // Chat open / explicit jump — never tied to message count
  useLayoutEffect(() => {
    pinBottomRef.current = true;
    onAtBottomChange?.(true);
    scrollToBottomInstant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToBottomKey]);

  // Keep bottom pinned while row heights settle (images), unless loading older
  useLayoutEffect(() => {
    if (!pinBottomRef.current || wasLoadingOlderRef.current || isLoadingOlder) return;
    if (items.length === 0) return;
    scrollToBottomInstant();
  }, [totalSize, scrollToBottomInstant, isLoadingOlder, items.length]);

  // Capture scroll height before older messages land
  useLayoutEffect(() => {
    if (isLoadingOlder) {
      wasLoadingOlderRef.current = true;
      pendingRestoreRef.current = true;
      pinBottomRef.current = false;
      onAtBottomChange?.(false);
      const el = containerRef.current;
      if (el) prevScrollHeightRef.current = el.scrollHeight;
      prevItemsLenRef.current = items.length;
      return;
    }

    if (pendingRestoreRef.current && containerRef.current) {
      const el = containerRef.current;
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) {
        el.scrollTop += delta;
      }
      pendingRestoreRef.current = false;
      wasLoadingOlderRef.current = false;
    }
  }, [isLoadingOlder, items.length, containerRef, onAtBottomChange]);

  // Extra restore after virtualizer remeasures prepended rows
  useLayoutEffect(() => {
    if (wasLoadingOlderRef.current || pendingRestoreRef.current) return;
    if (isLoadingOlder) return;
    // no-op: restore already applied above
  }, [totalSize, isLoadingOlder]);

  const handleScroll = useCallback(
    (e) => {
      onScroll?.(e);
      const el = containerRef.current;
      if (!el) return;

      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < BOTTOM_THRESHOLD;
      if (atBottom) {
        pinBottomRef.current = true;
      } else {
        pinBottomRef.current = false;
      }
      onAtBottomChange?.(atBottom);

      if (!onReachTop || !hasMoreOlder || isLoadingOlder) return;
      if (el.scrollTop < TOP_LOAD_THRESHOLD && !reachTopLock.current) {
        reachTopLock.current = true;
        prevScrollHeightRef.current = el.scrollHeight;
        Promise.resolve(onReachTop()).finally(() => {
          reachTopLock.current = false;
        });
      }
    },
    [onScroll, onReachTop, hasMoreOlder, isLoadingOlder, containerRef, onAtBottomChange]
  );

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{ scrollBehavior: "auto", ...style }}
    >
      {header}

      {isLoadingOlder && (
        <div className="flex justify-center py-2 shrink-0" data-older-loader>
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      )}

      <div
        style={{
          height: totalSize,
          width: "100%",
          maxWidth: "100%",
          position: "relative",
          overflow: "visible",
        }}
      >
        {virtualItems.map((vi) => {
          const message = items[vi.index];
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="virtual-message-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderItem(message, vi.index)}
            </div>
          );
        })}
      </div>

      {footer}
    </div>
  );
}

export default memo(VirtualMessageList);
