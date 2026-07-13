import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { Minimize2 } from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import { ZEGO_CONFIG, getCallConfig, isZegoConfigured } from '../config/zegoConfig';
import VoiceCallScreen from './call/VoiceCallScreen';
import MinimizedCallBubble from './call/MinimizedCallBubble';
import {
  formatCallDuration,
} from './call/CallPrimitives';
import './call/call-ui.css';
import toast from 'react-hot-toast';

const CallWindow = () => {
    const isInCall = useCallStore((s) => s.isInCall);
    const callType = useCallStore((s) => s.callType);
    const roomID = useCallStore((s) => s.roomID);
    const endCall = useCallStore((s) => s.endCall);
    const setZegoInstance = useCallStore((s) => s.setZegoInstance);
    const setCallStatus = useCallStore((s) => s.setCallStatus);
    const isMinimized = useCallStore((s) => s.isMinimized);
    const toggleMinimize = useCallStore((s) => s.toggleMinimize);
    const callStatus = useCallStore((s) => s.callStatus);
    const toggleMute = useCallStore((s) => s.toggleMute);
    const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);
    const receiver = useCallStore((s) => s.receiver);
    const caller = useCallStore((s) => s.caller);
    const callStartTime = useCallStore((s) => s.callStartTime);

    const { authUser } = useAuthStore();
    const containerRef = useRef(null);
    const zegoInstanceRef = useRef(null);
    const [chromeVisible, setChromeVisible] = useState(true);
    const hideTimerRef = useRef(null);

    const participant = receiver || caller;
    const isVideoConnected = callType === 'video' && callStatus === 'connected';

    useEffect(() => {
        if (!isInCall || !roomID || !containerRef.current || !authUser) {
            return;
        }

        let cancelled = false;

        const initializeCall = async () => {
            try {
                if (!isZegoConfigured()) {
                    toast.error(
                        'Calls are not configured. Add VITE_ZEGO_APP_ID and VITE_ZEGO_SERVER_SECRET to frontend/.env',
                        { duration: 6000 }
                    );
                    endCall('unavailable');
                    return;
                }

                const appID = ZEGO_CONFIG.appID;
                const serverSecret = ZEGO_CONFIG.serverSecret;
                const userID = authUser._id.toString();
                const userName = authUser.fullName || 'User';

                const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                    appID,
                    serverSecret,
                    roomID,
                    userID,
                    userName
                );

                if (!kitToken) throw new Error('Failed to generate kit token');
                if (cancelled) return;

                const zp = ZegoUIKitPrebuilt.create(kitToken);
                zegoInstanceRef.current = zp;
                setZegoInstance(zp);

                const callConfig = getCallConfig(userID, userName, callType);

                callConfig.onJoinRoom = () => {
                    setCallStatus('connected');
                };

                callConfig.onLeaveRoom = () => {
                    endCall('ended');
                };

                callConfig.onUserLeave = (users) => {
                    if (users && users.length > 0) {
                        endCall('ended');
                    }
                };

                callConfig.container = containerRef.current;
                await zp.joinRoom(callConfig);
            } catch (error) {
                console.error('Error initializing ZegoCloud call:', error);
                const msg = String(error?.msg || error?.message || '');
                if (msg.toLowerCase().includes('appid') || error?.code === 1001004) {
                    toast.error(
                        'Zego AppID invalid. Check VITE_ZEGO_APP_ID / ServerSecret in console.zegocloud.com',
                        { duration: 7000 }
                    );
                } else {
                    toast.error('Could not start call. Check Zego credentials.');
                }
                if (!cancelled) endCall('unavailable');
            }
        };

        initializeCall();

        return () => {
            cancelled = true;
            if (zegoInstanceRef.current) {
                try {
                    document.querySelectorAll('video, audio').forEach((element) => {
                        if (element.srcObject) {
                            element.srcObject.getTracks().forEach((t) => t.stop());
                            element.srcObject = null;
                        }
                    });
                    zegoInstanceRef.current.destroy();
                } catch (_) {
                    /* ignore */
                }
                zegoInstanceRef.current = null;
            }
        };
    }, [isInCall, roomID, authUser, callType, endCall, setZegoInstance, setCallStatus]);

    const bumpChrome = useCallback(() => {
        setChromeVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setChromeVisible(false), 4000);
    }, []);

    useEffect(() => {
        if (!isVideoConnected || isMinimized) return;
        bumpChrome();
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [isVideoConnected, isMinimized, bumpChrome]);

    const handleEnd = useCallback(() => {
        endCall('ended');
    }, [endCall]);

    if (!isInCall) return null;

    const hideZegoChrome = callType === 'audio' || callStatus !== 'connected';

    return (
        <>
            {isMinimized && <MinimizedCallBubble onEnd={handleEnd} />}

            {/* Zego media surface — kept mounted for audio even when custom UI covers it */}
            <div
                ref={containerRef}
                onClick={isVideoConnected ? bumpChrome : undefined}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9998,
                    backgroundColor: '#0b141a',
                    display: isMinimized ? 'none' : 'block',
                    // Hide Zego's default chrome for voice / pre-connect; keep streams alive
                    opacity: hideZegoChrome ? 0 : 1,
                    pointerEvents: hideZegoChrome ? 'none' : 'auto',
                }}
            />

            {/* WhatsApp voice / outgoing overlay */}
            {!isMinimized && (
                <VoiceCallScreen
                    onEnd={handleEnd}
                    onToggleMute={toggleMute}
                    onToggleSpeaker={toggleSpeaker}
                />
            )}

            {/* Video in-call chrome (minimize + status) */}
            {!isMinimized && isVideoConnected && (
                <VideoCallChrome
                    visible={chromeVisible}
                    participant={participant}
                    callStartTime={callStartTime}
                    onToggleMinimize={toggleMinimize}
                    onReveal={bumpChrome}
                />
            )}
        </>
    );
};

const VideoCallChrome = memo(function VideoCallChrome({
    visible,
    participant,
    callStartTime,
    onToggleMinimize,
    onReveal,
}) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!callStartTime) return;
        const tick = () => setElapsed(Math.floor((Date.now() - callStartTime) / 1000));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [callStartTime]);

    return (
        <div
            className={`call-wa-video-chrome${visible ? '' : ' call-wa-video-chrome--hidden'}`}
            onClick={onReveal}
        >
            <div className="call-wa-video-top">
                <div className="call-wa-video-chip">
                    <img
                        src={participant?.profilePic || '/avatar.png'}
                        alt=""
                    />
                    <span>
                        {participant?.fullName || 'User'}
                        {' · '}
                        {formatCallDuration(elapsed)}
                    </span>
                </div>
                <button
                    type="button"
                    className="call-wa-icon-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleMinimize();
                    }}
                    aria-label="Minimize call"
                    title="Minimize"
                >
                    <Minimize2 size={18} />
                </button>
            </div>
        </div>
    );
});

export default CallWindow;
