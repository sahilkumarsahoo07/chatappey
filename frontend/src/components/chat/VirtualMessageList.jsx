import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

const BOTTOM_THRESHOLD = 80;

/**
 * Virtualized scroll container for chat messages.
 * Opens pinned to the latest message (WhatsApp-style, no scroll animation).
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
}) {
  const reachTopLock = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const wasLoadingOlderRef = useRef(false);
  const pinBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 88,
    overscan: 8,
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
    if (items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: "end", behavior: "auto" });
    }
    el.scrollTop = el.scrollHeight;
  }, [containerRef, items.length, virtualizer]);

  // New chat / new messages at bottom — jump before paint (no animated scroll)
  useLayoutEffect(() => {
    pinBottomRef.current = true;
    scrollToBottomInstant();
  }, [scrollToBottomKey, scrollToBottomInstant]);

  // Keep bottom pinned while row heights are measured (images, etc.)
  useLayoutEffect(() => {
    if (!pinBottomRef.current || items.length === 0) return;
    scrollToBottomInstant();
  }, [totalSize, items.length, scrollToBottomInstant]);

  useLayoutEffect(() => {
    if (isLoadingOlder) {
      wasLoadingOlderRef.current = true;
      prevScrollHeightRef.current = containerRef.current?.scrollHeight || 0;
      pinBottomRef.current = false;
      return;
    }
    if (wasLoadingOlderRef.current && containerRef.current) {
      const el = containerRef.current;
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) el.scrollTop += delta;
      wasLoadingOlderRef.current = false;
    }
  }, [isLoadingOlder, items.length, containerRef]);

  const handleScroll = useCallback(
    (e) => {
      onScroll?.(e);
      const el = containerRef.current;
      if (el) {
        const atBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
        if (!atBottom) pinBottomRef.current = false;
      }
      if (!el || !onReachTop || !hasMoreOlder || isLoadingOlder) return;
      if (el.scrollTop < 120 && !reachTopLock.current) {
        reachTopLock.current = true;
        Promise.resolve(onReachTop()).finally(() => {
          reachTopLock.current = false;
        });
      }
    },
    [onScroll, onReachTop, hasMoreOlder, isLoadingOlder, containerRef]
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
        <div className="flex justify-center py-2">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      )}

      <div
        style={{
          height: virtualizer.getTotalSize(),
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
