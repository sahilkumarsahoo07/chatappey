/** Lightweight event bus for story-owner reaction animations (no React re-renders in store). */

const listeners = new Set();

/**
 * @param {(event: StoryReactionFxEvent) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onStoryReactionFx(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * @param {StoryReactionFxEvent} event
 */
export function emitStoryReactionFx(event) {
  if (!event?.statusId) return;
  listeners.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.error("storyReactionFx listener", e);
    }
  });
}

/**
 * @typedef {Object} StoryReactionFxEvent
 * @property {string} statusId
 * @property {'like'|'react'|'unlike'|'unreact'} type
 * @property {string} [emoji]
 * @property {string} [userId]
 */
