/**
 * Network quality detection via Network Information API + RTT heuristics.
 */

export const NetworkTier = {
  OFFLINE: "offline",
  SLOW_2G: "slow-2g",
  TWO_G: "2g",
  THREE_G: "3g",
  FOUR_G: "4g",
  FIVE_G: "5g",
  WIFI: "wifi",
  UNKNOWN: "unknown",
};

/** Map tier → preferred video height */
export const TierToQuality = {
  [NetworkTier.OFFLINE]: 240,
  [NetworkTier.SLOW_2G]: 240,
  [NetworkTier.TWO_G]: 240,
  [NetworkTier.THREE_G]: 360,
  [NetworkTier.FOUR_G]: 720,
  [NetworkTier.FIVE_G]: 1080,
  [NetworkTier.WIFI]: 1080,
  [NetworkTier.UNKNOWN]: 480,
};

function readConnection() {
  if (typeof navigator === "undefined") return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

export function detectNetwork() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      tier: NetworkTier.OFFLINE,
      effectiveType: "offline",
      downlink: 0,
      rtt: Infinity,
      saveData: false,
      type: "none",
    };
  }

  const conn = readConnection();
  if (!conn) {
    return {
      tier: NetworkTier.UNKNOWN,
      effectiveType: "unknown",
      downlink: null,
      rtt: null,
      saveData: false,
      type: "unknown",
    };
  }

  const type = (conn.type || "").toLowerCase();
  const effectiveType = (conn.effectiveType || "").toLowerCase();
  const downlink = typeof conn.downlink === "number" ? conn.downlink : null;
  const rtt = typeof conn.rtt === "number" ? conn.rtt : null;
  const saveData = !!conn.saveData;

  let tier = NetworkTier.UNKNOWN;

  if (type === "wifi" || type === "ethernet") {
    tier = NetworkTier.WIFI;
  } else if (effectiveType === "slow-2g") {
    tier = NetworkTier.SLOW_2G;
  } else if (effectiveType === "2g") {
    tier = NetworkTier.TWO_G;
  } else if (effectiveType === "3g") {
    tier = NetworkTier.THREE_G;
  } else if (effectiveType === "4g") {
    // Heuristic: very high downlink may indicate 5G
    if (downlink != null && downlink >= 50) tier = NetworkTier.FIVE_G;
    else tier = NetworkTier.FOUR_G;
  } else if (type === "cellular") {
    tier = NetworkTier.FOUR_G;
  }

  if (saveData && (tier === NetworkTier.WIFI || tier === NetworkTier.FOUR_G || tier === NetworkTier.FIVE_G)) {
    // Prefer lower media when Data Saver is on
    tier = NetworkTier.THREE_G;
  }

  return { tier, effectiveType, downlink, rtt, saveData, type: type || "unknown" };
}

export function recommendedQuality(tier) {
  return TierToQuality[tier] || 480;
}

/** Subscribe to network changes; returns unsubscribe */
export function subscribeNetwork(callback) {
  if (typeof window === "undefined") return () => {};

  const emit = () => callback(detectNetwork());
  const conn = readConnection();

  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
  if (conn?.addEventListener) conn.addEventListener("change", emit);

  emit();

  return () => {
    window.removeEventListener("online", emit);
    window.removeEventListener("offline", emit);
    if (conn?.removeEventListener) conn.removeEventListener("change", emit);
  };
}
