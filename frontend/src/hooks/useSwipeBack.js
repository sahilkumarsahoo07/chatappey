import { useEffect, useRef, useState, useCallback } from 'react';
import { useEdgeSwipeBack } from './useEdgeSwipeBack';

/**
 * Legacy chat swipe-back — delegates to useEdgeSwipeBack for interactive feedback
 * while keeping the containerRef API used by ChatContainer.
 */
export const useSwipeBack = (onSwipeBack, options = {}) => {
    const {
        edgeThreshold = 30,
        swipeThreshold = 75,
        enabled = true
    } = options;

    const containerRef = useRef(null);
    const edge = useEdgeSwipeBack(onSwipeBack, {
        edgeWidth: edgeThreshold,
        threshold: swipeThreshold / (typeof window !== 'undefined' ? window.innerWidth : 375),
        enabled,
    });

    return {
        swipeProgress: edge.progress,
        containerRef,
        offset: edge.offset,
        dragging: edge.dragging,
        style: edge.style,
    };
};

export default useSwipeBack;
