// ZegoCloud Configuration
// Documentation: https://www.zegocloud.com/docs/uikit/callkit-react/quick-start

// Get configuration from environment or use defaults
const getAppID = () => {
    const envAppID = import.meta.env.VITE_ZEGO_APP_ID;
    if (envAppID) {
        return typeof envAppID === 'string' ? parseInt(envAppID, 10) : envAppID;
    }
    return 1225819675; // Default AppID
};

const getServerSecret = () => {
    const envSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;
    return envSecret || "1ea02fb5bb02030b33c9810b061704c5"; // Default ServerSecret
};

export const ZEGO_CONFIG = {
    appID: getAppID(),
    serverSecret: getServerSecret(),
};

// Validate configuration
export const validateZegoConfig = () => {
    const { appID, serverSecret } = ZEGO_CONFIG;

    if (!appID || typeof appID !== 'number') {
        console.error('Invalid ZegoCloud AppID:', appID);
        return false;
    }

    if (!serverSecret || typeof serverSecret !== 'string' || serverSecret.length === 0) {
        console.error('Invalid ZegoCloud ServerSecret');
        return false;
    }

    console.log('✅ ZegoCloud configuration valid:', {
        appID,
        serverSecretLength: serverSecret.length,
        serverSecretPreview: serverSecret.substring(0, 8) + '...'
    });

    return true;
};

// Default call configuration matching user requirements
export const getCallConfig = (userID, userName) => {
    return {
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: true,
        showMyCameraToggleButton: true,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        showScreenSharingButton: true,
        showTextChat: true,
        showUserList: true,
        maxUsers: 2,
        layout: "Auto",
        showLayoutButton: false,
        scenario: {
            mode: "OneONoneCall",
            config: {
                role: "Host",
            },
        },
    };
};

// Generate a unique room ID for each call
export const generateRoomID = (user1Id, user2Id) => {
    // Sort IDs to ensure same room ID regardless of who initiates
    const ids = [user1Id, user2Id].sort();
    return `call_${ids[0]}_${ids[1]}_${Date.now()}`;
};
