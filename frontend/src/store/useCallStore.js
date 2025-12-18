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

        // Clean up ZegoCloud instance
        if (zegoInstance) {
            try {
                zegoInstance.destroy();
            } catch (error) {
                console.error('Error destroying Zego instance:', error);
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
