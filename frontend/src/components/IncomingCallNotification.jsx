import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { useWebRTC } from '../hooks/useWebRTC';
import { useEffect, useState, useRef } from 'react';

const IncomingCallNotification = () => {
    const { incomingCall } = useCallStore();
    const { answerCall, rejectCall } = useWebRTC();
    const [ringing, setRinging] = useState(false);
    const ringtoneRef = useRef(null);

    // Create incoming call ringtone (different from outgoing)
    useEffect(() => {
        if (!ringtoneRef.current) {
            const audio = new Audio();
            // Different tone pattern for incoming call
            audio.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T';
            ringtoneRef.current = audio;
        }
    }, []);

    useEffect(() => {
        if (incomingCall) {
            setRinging(true);
            // Play incoming call ringtone
            if (ringtoneRef.current) {
                ringtoneRef.current.loop = true;
                ringtoneRef.current.volume = 0.7;
                const playPromise = ringtoneRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Auto-play was prevented. This is normal in recent browsers.
                        console.log('Ringtone autoplay prevented which is expected:', error.message);
                    });
                }
            }
        } else {
            setRinging(false);
            // Stop ringtone
            if (ringtoneRef.current) {
                ringtoneRef.current.pause();
                ringtoneRef.current.currentTime = 0;
            }
        }

        return () => {
            if (ringtoneRef.current) {
                ringtoneRef.current.pause();
                ringtoneRef.current.currentTime = 0;
            }
        };
    }, [incomingCall]);

    if (!incomingCall) return null;

    const handleAccept = () => {
        // Stop ringtone
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
        answerCall(incomingCall.fromData, incomingCall.callType, incomingCall.roomID);
    };

    const handleReject = () => {
        // Stop ringtone
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
        rejectCall(incomingCall.from);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-base-100 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-base-300 animate-slideUp">
                {/* Caller Info */}
                <div className="text-center mb-8">
                    <div className={`w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden ring-4 ${ringing ? 'ring-success animate-pulse' : 'ring-base-300'}`}>
                        <img
                            src={incomingCall.fromData?.profilePic || '/avatar.png'}
                            alt={incomingCall.fromData?.fullName}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{incomingCall.fromData?.fullName}</h2>
                    <p className="text-base-content/70 flex items-center justify-center gap-2 text-lg font-medium">
                        {incomingCall.callType === 'video' ? (
                            <>
                                <Video size={20} className="text-primary animate-pulse" />
                                Incoming Video Call
                            </>
                        ) : (
                            <>
                                <Phone size={20} className="text-primary animate-pulse" />
                                Incoming Voice Call
                            </>
                        )}
                    </p>
                </div>

                {/* Call Actions */}
                <div className="flex gap-4 justify-center">
                    {/* Reject Button */}
                    <button
                        onClick={handleReject}
                        className="w-16 h-16 rounded-full bg-error hover:bg-error/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
                        title="Reject"
                    >
                        <PhoneOff size={28} className="text-white" />
                    </button>

                    {/* Accept Button */}
                    <button
                        onClick={handleAccept}
                        className="w-16 h-16 rounded-full bg-success hover:bg-success/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg animate-pulse"
                        title="Accept"
                    >
                        <Phone size={28} className="text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallNotification;
