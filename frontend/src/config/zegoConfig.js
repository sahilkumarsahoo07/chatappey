// ZegoCloud Configuration
// Docs: https://www.zegocloud.com/docs/uikit/callkit-react/quick-start
// Get AppID + ServerSecret from: https://console.zegocloud.com → Project → AppID / ServerSecret

const getAppID = () => {
  const raw = import.meta.env.VITE_ZEGO_APP_ID;
  if (raw == null || String(raw).trim() === "") return null;
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getServerSecret = () => {
  const raw = import.meta.env.VITE_ZEGO_SERVER_SECRET;
  if (!raw || typeof raw !== "string") return null;
  const secret = raw.trim();
  return secret.length >= 32 ? secret : null;
};

export const ZEGO_CONFIG = {
  appID: getAppID(),
  serverSecret: getServerSecret(),
};

/** True when both credentials are present and look valid */
export const isZegoConfigured = () =>
  typeof ZEGO_CONFIG.appID === "number" &&
  typeof ZEGO_CONFIG.serverSecret === "string";

export const validateZegoConfig = () => {
  if (!isZegoConfigured()) {
    console.error(
      "[Zego] Missing credentials. Set VITE_ZEGO_APP_ID and VITE_ZEGO_SERVER_SECRET in frontend/.env then restart Vite."
    );
    return false;
  }

  console.log("✅ ZegoCloud configuration loaded:", {
    appID: ZEGO_CONFIG.appID,
    serverSecretLength: ZEGO_CONFIG.serverSecret.length,
  });
  return true;
};

export const getCallConfig = (userID, userName, callType = "video") => {
  const isAudioOnly = callType === "audio";
  const isMobile =
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    window.innerWidth < 768;

  return {
    turnOnMicrophoneWhenJoining: true,
    turnOnCameraWhenJoining: !isAudioOnly,
    showMyCameraToggleButton: !isAudioOnly,
    showMyMicrophoneToggleButton: !isAudioOnly,
    showAudioVideoSettingsButton: false,
    showScreenSharingButton: false,
    showTextChat: false,
    showUserList: false,
    maxUsers: 2,
    layout: "Auto",
    showLayoutButton: false,
    showNonVideoUser: true,
    showOnlyAudioUser: true,
    showPinButton: false,
    showRoomTimer: !isAudioOnly,
    showLeavingView: false,
    showPreJoinView: false,
    videoResolutionDefault: isMobile ? "360p" : "720p",
    scenario: {
      mode: "OneONoneCall",
      config: { role: "Host" },
    },
    branding: { logoURL: "" },
  };
};

export const generateRoomID = (user1Id, user2Id) => {
  const ids = [user1Id, user2Id].sort();
  return `call_${ids[0]}_${ids[1]}_${Date.now()}`;
};
