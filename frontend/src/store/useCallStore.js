import { create } from 'zustand';
import toast from 'react-hot-toast';

export const useCallStore = create((set, get) => ({
    // State
    isInCall: false,
    callType: null, // 'audio' or 'video'
    caller: null,
    receiver: null,
    incomingCall: null,
    callStatus: 'idle', // 'idle', 'ringing', 'connecting', 'connected'
    isMuted: false,
    isVideoOff: false,
    callStartTime: null,
    roomID: null, // ZegoCloud room ID
    zegoInstance: null, // ZegoCloud instance reference
    isMinimized: false, // Track if call window is minimized

    // Actions
    setIncomingCall: (callData) => set({ incomingCall: callData, callStatus: 'ringing' }),

    clearIncomingCall: () => set({ incomingCall: null, callStatus: 'idle' }),

    setRoomID: (roomID) => set({ roomID }),

    setZegoInstance: (instance) => set({ zegoInstance: instance }),

    setCallStatus: (status) => {
        set({ callStatus: status });
        // Track when call actually connected
        if (status === 'connected' && !get().callStartTime) {
            set({ callStartTime: Date.now() });
        }
    },

    startCall: (user, callType, roomID) => set({
        isInCall: true,
        callType,
        receiver: user,
        callStatus: 'connecting',
        roomID
    }),

    acceptCall: (caller, callType, roomID) => set({
        isInCall: true,
        callType,
        caller,
        callStatus: 'connecting',
        incomingCall: null,
        roomID
    }),

    toggleMute: () => {
        const { isMuted } = get();
        set({ isMuted: !isMuted });
    },

    toggleVideo: () => {
        const { isVideoOff } = get();
        set({ isVideoOff: !isVideoOff });
    },

    toggleMinimize: () => {
        const { isMinimized } = get();
        set({ isMinimized: !isMinimized });
    },

    endCall: () => {
        const { callStartTime, callStatus, zegoInstance } = get();

        // Calculate call duration if call was connected
        if (callStartTime && callStatus === 'connected') {
            const duration = Math.floor((Date.now() - callStartTime) / 1000);
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;

            // Show call summary
            toast.success(`Call ended • Duration: ${durationText}`, {
                duration: 4000,
                icon: '📞'
            });
        }

        // Clean up ZegoCloud instance and media streams
        if (zegoInstance) {
            try {
                console.log('Stopping all media tracks...');

                // Stop all media tracks to release camera/microphone
                const stopAllMediaTracks = () => {
                    // Get all active media streams
                    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                        .then(() => {
                            // Get all video and audio elements
                            const mediaElements = document.querySelectorAll('video, audio');
                            mediaElements.forEach(element => {
                                if (element.srcObject) {
                                    const tracks = element.srcObject.getTracks();
                                    tracks.forEach(track => {
                                        console.log('Stopping track:', track.kind, track.label);
                                        track.stop();
                                    });
                                    element.srcObject = null;
                                }
                            });
                        })
                        .catch(() => {
                            // Ignore errors, streams might already be stopped
                        });
                };

                stopAllMediaTracks();

                // Destroy the ZegoCloud instance
                console.log('Destroying ZegoCloud instance...');
                zegoInstance.destroy();

                console.log('✅ Cleanup complete');
            } catch (error) {
                console.error('Error during cleanup:', error);
            }
        }

        set({
            isInCall: false,
            callType: null,
            caller: null,
            receiver: null,
            callStatus: 'idle',
            isMuted: false,
            isVideoOff: false,
            incomingCall: null,
            callStartTime: null,
            roomID: null,
            zegoInstance: null,
            isMinimized: false
        });
    }
}));
