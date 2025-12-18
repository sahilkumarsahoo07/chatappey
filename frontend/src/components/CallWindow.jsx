import { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import { ZEGO_CONFIG, getCallConfig } from '../config/zegoConfig';
import { Minimize, Maximize, X } from 'lucide-react';

const CallWindow = () => {
    const {
        isInCall,
        callType,
        roomID,
        endCall,
        setZegoInstance,
        setCallStatus,
        isMinimized,
        toggleMinimize
    } = useCallStore();

    const { authUser } = useAuthStore();
    const containerRef = useRef(null);
    const zegoInstanceRef = useRef(null);

    useEffect(() => {
        if (!isInCall || !roomID || !containerRef.current || !authUser) {
            return;
        }

        const initializeCall = async () => {
            try {
                console.log('Initializing ZegoCloud call...', { roomID, callType });

                // Get configuration
                const appID = ZEGO_CONFIG.appID;
                const serverSecret = ZEGO_CONFIG.serverSecret;
                const userID = authUser._id.toString();
                const userName = authUser.fullName || 'User';

                console.log('ZegoCloud config:', {
                    appID,
                    appIDType: typeof appID,
                    serverSecretLength: serverSecret?.length,
                    serverSecretType: typeof serverSecret,
                    userID,
                    userName,
                    roomID
                });

                // Validate credentials with detailed checks
                if (!appID) {
                    throw new Error('ZegoCloud AppID is missing. Please check your .env file.');
                }

                if (typeof appID !== 'number') {
                    throw new Error(`ZegoCloud AppID must be a number, got ${typeof appID}`);
                }

                if (!serverSecret) {
                    throw new Error('ZegoCloud ServerSecret is missing. Please check your .env file.');
                }

                if (typeof serverSecret !== 'string') {
                    throw new Error(`ZegoCloud ServerSecret must be a string, got ${typeof serverSecret}`);
                }

                if (serverSecret.length < 32) {
                    throw new Error('ZegoCloud ServerSecret appears to be invalid (too short)');
                }

                console.log('Generating kit token with validated config...');

                // Create ZegoCloud instance with token
                const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                    appID,
                    serverSecret,
                    roomID,
                    userID,
                    userName
                );

                if (!kitToken) {
                    throw new Error('Failed to generate kit token');
                }

                console.log('✅ Kit token generated successfully');

                // Create instance
                const zp = ZegoUIKitPrebuilt.create(kitToken);
                zegoInstanceRef.current = zp;
                setZegoInstance(zp);

                // Get call configuration with proper callType
                const callConfig = getCallConfig(userID, userName, callType);

                console.log('Call config for', callType, 'call:', {
                    turnOnCameraWhenJoining: callConfig.turnOnCameraWhenJoining,
                    showMyCameraToggleButton: callConfig.showMyCameraToggleButton
                });

                // Add event listeners
                callConfig.onJoinRoom = () => {
                    console.log('✅ Successfully joined ZegoCloud room:', roomID);
                    setCallStatus('connected');
                };

                callConfig.onLeaveRoom = () => {
                    console.log('Left ZegoCloud room');
                    endCall();
                };

                callConfig.onUserLeave = (users) => {
                    console.log('User left:', users);
                    if (users && users.length > 0) {
                        endCall();
                    }
                };

                // Pass the container element to joinRoom
                callConfig.container = containerRef.current;

                console.log('Joining room with config...');

                // Join the room
                await zp.joinRoom(callConfig);

                console.log('✅ Room join initiated successfully');

            } catch (error) {
                console.error('❌ Error initializing ZegoCloud call:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                endCall();
            }
        };

        initializeCall();

        // Cleanup on unmount
        return () => {
            if (zegoInstanceRef.current) {
                try {
                    console.log('Cleaning up ZegoCloud instance...');
                    zegoInstanceRef.current.destroy();
                } catch (error) {
                    console.error('Error destroying Zego instance:', error);
                }
                zegoInstanceRef.current = null;
            }
        };
    }, [isInCall, roomID, authUser, callType, endCall, setZegoInstance, setCallStatus]);

    const handleCancel = () => {
        console.log('User cancelled call');
        endCall();
    };

    if (!isInCall) {
        return null;
    }

    return (
        <>
            {/* Minimized Floating Window - Teams Style */}
            {isMinimized && <MinimizedCallWindow />}

            {/* Minimize Button Overlay - Top Right (only visible when not minimized) */}
            {!isMinimized && (
                <button
                    onClick={toggleMinimize}
                    className="fixed top-4 right-4 z-[10000] bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    title="Minimize call"
                >
                    <Minimize size={20} />
                    <span className="text-sm font-medium">Minimize</span>
                </button>
            )}

            {/* Full Screen Call Window - Always mounted, but hidden when minimized */}
            <div
                ref={containerRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    backgroundColor: '#000',
                    display: isMinimized ? 'none' : 'block'
                }}
            />
        </>
    );
};

// Minimized Call Window Component (Teams Style)
const MinimizedCallWindow = () => {
    const { receiver, caller, callType, toggleMinimize, endCall } = useCallStore();
    const [position, setPosition] = useState({ x: window.innerWidth - 360, y: window.innerHeight - 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const participant = receiver || caller;

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);

    return (
        <div
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: '320px',
                zIndex: 9999,
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            className="select-none"
        >
            {/* Main minimized window */}
            <div className="bg-[#292929] rounded-lg shadow-2xl overflow-hidden border border-gray-700">
                {/* Header - Draggable */}
                <div
                    onMouseDown={handleMouseDown}
                    className="bg-[#1f1f1f] px-4 py-3 flex items-center justify-between"
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                            {participant?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">
                                {participant?.fullName || 'User'}
                            </div>
                            <div className="text-gray-400 text-xs">
                                {callType === 'video' ? 'Video call' : 'Audio call'}
                            </div>
                        </div>
                    </div>

                    {/* Window controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={toggleMinimize}
                            className="p-2 hover:bg-gray-700 rounded transition-colors"
                            title="Maximize"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300">
                                <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                        </button>
                        <button
                            onClick={endCall}
                            className="p-2 hover:bg-red-600 rounded transition-colors"
                            title="End call"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300">
                                <path d="M2 2L10 10M2 10L10 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Preview area */}
                <div className="bg-[#1a1a1a] h-32 flex items-center justify-center">
                    <div className="text-gray-400 text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-2">
                            {participant?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="text-xs">Call in progress...</div>
                    </div>
                </div>

                {/* Controls footer */}
                <div className="bg-[#1f1f1f] px-4 py-2 flex items-center justify-center gap-2">
                    <button
                        onClick={toggleMinimize}
                        className="flex-1 bg-[#464646] hover:bg-[#5a5a5a] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                        Return to call
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallWindow;
