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

    const otherUser = receiver || caller;
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Minimized view (Microsoft Teams style)
    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden">
                {/* Hidden audio element - CRITICAL for hearing remote audio */}
                <audio ref={remoteAudioRef} autoPlay playsInline />

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

                {/* Small video preview when minimized */}
                {callType === 'video' && remoteStream && (
                    <div className="relative h-40">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
            </div>
        );
    }

    // Full screen view
    return (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* CRITICAL: Hidden audio element for remote stream - this is what allows you to hear the other person */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* Remote Video (Full Screen) */}
            <div className="absolute inset-0">
                {callType === 'video' && remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                        <div className="text-center">
                            <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden ring-4 ring-primary/50">
                                <img
                                    src={otherUser?.profilePic || '/avatar.png'}
                                    alt={otherUser?.fullName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">{otherUser?.fullName}</h2>
                            <p className="text-white/70">
                                {callStatus === 'connecting' ? (receiver ? 'Ringing...' : 'Connecting...') : formatDuration(callDuration)}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Local Video (Picture-in-Picture) */}
            {callType === 'video' && localStream && (
                <div className="absolute top-4 right-4 w-48 h-36 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform scale-x-[-1]"
                    />
                </div>
            )}

            {/* Call Info Overlay */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md rounded-2xl px-6 py-3">
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
                className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-3 rounded-full hover:bg-black/70 transition-all"
                title="Minimize"
            >
                <Minimize2 size={20} className="text-white" />
            </button>

            {/* Call Controls */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                <div className="bg-black/50 backdrop-blur-md rounded-full px-6 py-4 flex items-center gap-4 shadow-2xl">
                    {/* Mute Button */}
                    <button
                        onClick={toggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isMuted ? 'bg-error' : 'bg-white/20 hover:bg-white/30'
                            }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? (
                            <MicOff size={24} className="text-white" />
                        ) : (
                            <Mic size={24} className="text-white" />
                        )}
                    </button>

                    {/* End Call Button */}
                    <button
                        onClick={endCall}
                        className="w-16 h-16 rounded-full bg-error hover:bg-error/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
                        title="End Call"
                    >
                        <PhoneOff size={28} className="text-white" />
                    </button>

                    {/* Video Toggle Button (only for video calls) */}
                    {callType === 'video' && (
                        <button
                            onClick={toggleVideo}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isVideoOff ? 'bg-error' : 'bg-white/20 hover:bg-white/30'
                                }`}
                            title={isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
                        >
                            {isVideoOff ? (
                                <VideoOff size={24} className="text-white" />
                            ) : (
                                <Video size={24} className="text-white" />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallWindow;
