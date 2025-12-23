import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to detect left-edge swipe gestures for back navigation on mobile
 * @param {Function} onSwipeBack - Callback function to execute when swipe-back is detected
 * @param {Object} options - Configuration options
 * @param {number} options.edgeThreshold - Distance from left edge to detect swipe start (default: 30px)
 * @param {number} options.swipeThreshold - Minimum swipe distance to trigger back (default: 75px)
 * @param {boolean} options.enabled - Whether swipe detection is enabled (default: true)
 * @returns {Object} - { swipeProgress, containerRef }
 */
export const useSwipeBack = (onSwipeBack, options = {}) => {
    const {
        edgeThreshold = 30,
        swipeThreshold = 75,
        enabled = true
    } = options;

    const [swipeProgress, setSwipeProgress] = useState(0);
    const touchStartRef = useRef(null);
    const isSwipingRef = useRef(false);
    const containerRef = useRef(null);

    const handleTouchStart = useCallback((e) => {
        if (!enabled) return;

        const touch = e.touches[0];
        // Only detect swipes starting from the left edge
        if (touch.clientX <= edgeThreshold) {
            touchStartRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now()
            };
            isSwipingRef.current = true;
        }
    }, [enabled, edgeThreshold]);

    const handleTouchMove = useCallback((e) => {
        if (!isSwipingRef.current || !touchStartRef.current) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // If vertical movement is greater than horizontal, cancel swipe
        if (deltaY > Math.abs(deltaX)) {
            isSwipingRef.current = false;
            setSwipeProgress(0);
            return;
        }

        // Only track rightward swipes
        if (deltaX > 0) {
            const progress = Math.min(deltaX / swipeThreshold, 1);
            setSwipeProgress(progress);
        }
    }, [swipeThreshold]);

    const handleTouchEnd = useCallback(() => {
        if (!isSwipingRef.current || !touchStartRef.current) {
            return;
        }

        // If swipe progress reached threshold, trigger back navigation
        if (swipeProgress >= 1 && onSwipeBack) {
            onSwipeBack();
        }

        // Reset state
        touchStartRef.current = null;
        isSwipingRef.current = false;
        setSwipeProgress(0);
    }, [swipeProgress, onSwipeBack]);

    useEffect(() => {
        const container = containerRef.current || document;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return {
        swipeProgress,
        containerRef
    };
};

export default useSwipeBack;
