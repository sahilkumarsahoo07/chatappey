import { useCallback, useEffect, useRef, useState } from "react";
import { onStoryReactionFx } from "../lib/storyReactionFx";
import { fetchStatusEngagementApi } from "../lib/statusApi";

const MAX_PARTICLES = 14;
const BURST_WINDOW_MS = 850;
const BURST_THRESHOLD = 3;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeParticle(emoji, overrides = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    emoji,
    x: overrides.x ?? rand(12, 78),
    size: overrides.size ?? rand(0.9, 1.25),
    rotate: overrides.rotate ?? rand(-18, 18),
    duration: overrides.duration ?? rand(2.0, 2.8),
    delay: overrides.delay ?? 0,
    drift: overrides.drift ?? rand(-28, 28),
  };
}

/**
 * Manages floating reaction particles + center-heart like burst for story owners.
 */
export function useStoryReactionFx({ enabled, statusId }) {
  const [particles, setParticles] = useState([]);
  const [centerHeart, setCenterHeart] = useState(false);
  const pendingRef = useRef([]);
  const burstTimerRef = useRef(null);
  const playedInitialRef = useRef(new Set());
  const heartTimerRef = useRef(null);

  const removeParticle = useCallback((id) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const pushParticles = useCallback((items) => {
    setParticles((prev) => [...prev, ...items].slice(-MAX_PARTICLES));
  }, []);

  const showCenterHeart = useCallback(() => {
    setCenterHeart(true);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    heartTimerRef.current = setTimeout(() => setCenterHeart(false), 950);
  }, []);

  const spawnFloat = useCallback(
    (emoji, opts = {}) => {
      pushParticles([makeParticle(emoji, opts)]);
    },
    [pushParticles]
  );

  const spawnBurst = useCallback(
    (events) => {
      const emojis = events.map((e) => (e.type === "like" ? "❤️" : e.emoji)).filter(Boolean);
      const batch = emojis.map((emoji, i) =>
        makeParticle(emoji, {
          x: 8 + (i / Math.max(emojis.length - 1, 1)) * 76 + rand(-8, 8),
          size: rand(0.75, 1.35),
          duration: rand(1.7, 2.6),
          delay: i * 70,
          rotate: rand(-24, 24),
          drift: rand(-40, 40),
        })
      );
      pushParticles(batch);
      if (emojis.some((e) => e === "❤️")) showCenterHeart();
    },
    [pushParticles, showCenterHeart]
  );

  const flushPending = useCallback(() => {
    const batch = pendingRef.current.splice(0);
    if (!batch.length) return;

    if (batch.length >= BURST_THRESHOLD) {
      spawnBurst(batch);
      return;
    }

    batch.forEach((evt, i) => {
      const delay = i * 380;
      setTimeout(() => {
        if (evt.type === "like") {
          showCenterHeart();
          spawnFloat("❤️", { size: 1.15, x: rand(30, 70) });
        } else if (evt.type === "react" && evt.emoji) {
          spawnFloat(evt.emoji, { x: rand(15, 75) });
        }
      }, delay);
    });
  }, [spawnBurst, showCenterHeart, spawnFloat]);

  const enqueue = useCallback(
    (event) => {
      if (!enabled) return;
      if (event.type === "unlike" || event.type === "unreact") return;
      pendingRef.current.push(event);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (pendingRef.current.length >= BURST_THRESHOLD) {
        flushPending();
        return;
      }
      burstTimerRef.current = setTimeout(flushPending, BURST_WINDOW_MS);
    },
    [enabled, flushPending]
  );

  useEffect(() => {
    if (!enabled || !statusId) return undefined;
    return onStoryReactionFx((evt) => {
      if (String(evt.statusId) !== String(statusId)) return;
      enqueue(evt);
    });
  }, [enabled, statusId, enqueue]);

  useEffect(() => {
    if (!enabled || !statusId) return undefined;
    const key = String(statusId);
    if (playedInitialRef.current.has(key)) return undefined;
    playedInitialRef.current.add(key);

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStatusEngagementApi(statusId);
        if (cancelled || !data) return;

        const items = [
          ...(data.likes || []).slice(-3).map((l) => ({ type: "like", at: l.likedAt })),
          ...(data.reactions || [])
            .slice(-4)
            .map((r) => ({ type: "react", emoji: r.emoji, at: r.reactedAt })),
        ]
          .sort((a, b) => new Date(a.at) - new Date(b.at))
          .slice(-5);

        if (items.length >= BURST_THRESHOLD) {
          setTimeout(() => {
            if (!cancelled) spawnBurst(items);
          }, 500);
          return;
        }

        items.forEach((item, i) => {
          setTimeout(() => {
            if (cancelled) return;
            if (item.type === "like") spawnFloat("❤️", { size: 1.05, x: rand(20, 65) });
            else if (item.emoji) spawnFloat(item.emoji, { x: rand(18, 72) });
          }, 550 + i * 420);
        });
      } catch {
        /* non-critical */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, statusId, spawnBurst, spawnFloat]);

  useEffect(
    () => () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    },
    []
  );

  return { particles, centerHeart, removeParticle };
}
