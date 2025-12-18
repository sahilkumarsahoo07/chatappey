import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2, Maximize2 } from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useWebRTC } from '../hooks/useWebRTC';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const CallWindow = () => {
    const {
        isInCall,
        callType,
        caller,
        receiver,
        localStream,
        remoteStream,
        callStatus,
        isMuted,
        isVideoOff,
        toggleMute,
        toggleVideo
    } = useCallStore();

    const { endCall } = useWebRTC();
    const { authUser } = useAuthStore();
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Outgoing call ringing tone (what caller hears)
    const [outgoingRingTone] = useState(() => {
        const audio = new Audio();
        // Simple repeating beep pattern for outgoing call
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        return audio;
    });

    // Set up video streams
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream) {
            // Set video stream
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            // IMPORTANT: Set audio stream separately and ensure it plays
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.volume = 1.0; // Max volume
                // Force play with user interaction
                remoteAudioRef.current.play().catch(e => {
                    console.log('Audio autoplay blocked, will play on user interaction:', e);
                    // Try again after a short delay
                    setTimeout(() => {
                        remoteAudioRef.current.play().catch(err => console.log('Audio play retry failed:', err));
                    }, 100);
                });
            }
        }
    }, [remoteStream]);

    // Call duration timer
    useEffect(() => {
        if (callStatus === 'connected') {
            const interval = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setCallDuration(0);
        }
    }, [callStatus]);

    // Play outgoing ringing tone when caller is waiting (only for caller, not receiver)
    useEffect(() => {
        if (callStatus === 'connecting' && receiver) {
            // This is the caller (has receiver), play outgoing ring
            outgoingRingTone.loop = true;
            outgoingRingTone.volume = 0.5;
            outgoingRingTone.play().catch(e => console.log('Outgoing ring tone error:', e));
        } else {
            outgoingRingTone.pause();
            outgoingRingTone.currentTime = 0;
        }

        return () => {
            outgoingRingTone.pause();
            outgoingRingTone.currentTime = 0;
        };
    }, [callStatus, receiver, outgoingRingTone]);

    if (!isInCall) return null;

    // Use a persistent layout strategy:
    // Always render the heavy media elements (audio/video) in a hidden container or fixed position
    // and overlay the UI (minimized or full) on top, or reposition them with CSS.
    // However, moving DOM elements can still interrupt playback in some browsers.
    // The safest way is to keep the structure flat or use portals, but for simple toggle,
    // we can just use CSS classes to change appearance instead of completely different DOM trees.

    const otherUser = receiver || caller;
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const renderContent = () => {
        if (isMinimized) {
            return (
                <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-secondary p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/30">
                                    <img
                                        src={otherUser?.profilePic || '/avatar.png'}
                                        alt={otherUser?.fullName}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="text-white">
                                    <h3 className="font-semibold text-sm">{otherUser?.fullName}</h3>
                                    <p className="text-xs opacity-80">
                                        {callStatus === 'connecting' ? 'Connecting...' : formatDuration(callDuration)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMinimized(false)}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="Maximize"
                            >
                                <Maximize2 size={18} className="text-white" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={toggleMute}
                                className={`flex-1 py-2 rounded-lg transition-all ${isMuted ? 'bg-error' : 'bg-white/20 hover:bg-white/30'
                                    }`}
                            >
                                {isMuted ? <MicOff size={18} className="text-white mx-auto" /> : <Mic size={18} className="text-white mx-auto" />}
                            </button>

                            <button
                                onClick={endCall}
                                className="flex-1 py-2 rounded-lg bg-error hover:bg-error/80 transition-all"
                            >
                                <PhoneOff size={18} className="text-white mx-auto" />
                            </button>

                            {callType === 'video' && (
                                <button
                                    onClick={toggleVideo}
                                    className={`flex-1 py-2 rounded-lg transition-all ${isVideoOff ? 'bg-error' : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    {isVideoOff ? <VideoOff size={18} className="text-white mx-auto" /> : <Video size={18} className="text-white mx-auto" />}
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Video preview area for minimized view - we use the main video element but style it here if needed, 
                        BUT to avoid re-renders we will just show a placeholder or handle it via CSS visibility in the main block */}
                </div>
            );
        }

        return (
            <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                {/* Controls and Overlay UI */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                    {/* Info Overlay */}
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md rounded-2xl px-6 py-3 pointer-events-auto">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/30">
                                <img
                                    src={otherUser?.profilePic || '/avatar.png'}
                                    alt={otherUser?.fullName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">{otherUser?.fullName}</h3>
                                <p className="text-white/70 text-sm">
                                    {callStatus === 'connecting' ? (receiver ? 'Ringing...' : 'Connecting...') : formatDuration(callDuration)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Minimize Button */}
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-3 rounded-full hover:bg-black/70 transition-all pointer-events-auto"
                        title="Minimize"
                    >
                        <Minimize2 size={20} className="text-white" />
                    </button>

                    {/* Controls */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                        <div className="bg-black/50 backdrop-blur-md rounded-full px-6 py-4 flex items-center gap-4 shadow-2xl">
                            <button
                                onClick={toggleMute}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isMuted ? 'bg-error' : 'bg-white/20 hover:bg-white/30'
                                    }`}
                            >
                                {isMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
                            </button>
                            <button
                                onClick={endCall}
                                className="w-16 h-16 rounded-full bg-error hover:bg-error/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
                            >
                                <PhoneOff size={28} className="text-white" />
                            </button>
                            {callType === 'video' && (
                                <button
                                    onClick={toggleVideo}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isVideoOff ? 'bg-error' : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    {isVideoOff ? <VideoOff size={24} className="text-white" /> : <Video size={24} className="text-white" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* PERSISTENT MEDIA ELEMENTS */}
            {/* Remote Audio - Always active */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* Video Containers - Positioned based on state but always mounted if in video call */}
            {callType === 'video' && (
                <>
                    {/* Remote Video */}
                    <div
                        className={`fixed transition-all duration-300 ease-in-out bg-black overflow-hidden ${isMinimized
                                ? 'bottom-20 right-4 w-72 h-40 rounded-lg z-[9998] shadow-lg border border-gray-700'
                                : 'inset-0 z-0'
                            }`}
                    >
                        {remoteStream ? (
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            // Placeholder when no remote video
                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <p className="text-white/50 text-sm">Waiting for video...</p>
                            </div>
                        )}
                    </div>

                    {/* Local Video - PiP */}
                    {localStream && (
                        <div
                            className={`fixed transition-all duration-300 ease-in-out bg-gray-900 overflow-hidden shadow-xl border border-white/20 ${isMinimized
                                    ? 'hidden' // Hide local video in minimized mode to save space/complexity
                                    : 'top-4 right-16 w-48 h-36 rounded-xl z-20' // Adjusted right position to not overlap minimize btn
                                }`}
                        >
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                        </div>
                    )}
                </>
            )}

            {/* UI Layer */}
            {renderContent()}
        </>
    );
};

export default CallWindow;
