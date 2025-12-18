import { create } from 'zustand';
import toast from 'react-hot-toast';

export const useCallStore = create((set, get) => ({
    // State
    isInCall: false,
    callType: null, // 'audio' or 'video'
    caller: null,
    receiver: null,
    localStream: null,
    remoteStream: null,
    peer: null,
    incomingCall: null,
    callStatus: 'idle', // 'idle', 'ringing', 'connecting', 'connected'
    isMuted: false,
    isVideoOff: false,
    callStartTime: null, // Track when call started

    // Actions
    setIncomingCall: (callData) => set({ incomingCall: callData, callStatus: 'ringing' }),

    clearIncomingCall: () => set({ incomingCall: null, callStatus: 'idle' }),

    setLocalStream: (stream) => set({ localStream: stream }),

    setRemoteStream: (stream) => set({ remoteStream: stream }),

    setPeer: (peer) => set({ peer }),

    setCallStatus: (status) => {
        set({ callStatus: status });
        // Track when call actually connected
        if (status === 'connected' && !get().callStartTime) {
            set({ callStartTime: Date.now() });
        }
    },

    startCall: (user, callType) => set({
        isInCall: true,
        callType,
        receiver: user,
        callStatus: 'connecting'
    }),

    acceptCall: (caller, callType) => set({
        isInCall: true,
        callType,
        caller,
        callStatus: 'connecting',
        incomingCall: null
    }),

    toggleMute: () => {
        const { localStream, isMuted } = get();
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isMuted;
            });
            set({ isMuted: !isMuted });
        }
    },

    toggleVideo: () => {
        const { localStream, isVideoOff } = get();
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoOff;
            });
            set({ isVideoOff: !isVideoOff });
        }
    },

    endCall: () => {
        const { localStream, remoteStream, peer, callStartTime, callStatus } = get();

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

        // Stop all tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
        }

        // Destroy peer connection
        if (peer) {
            peer.destroy();
        }

        set({
            isInCall: false,
            callType: null,
            caller: null,
            receiver: null,
            localStream: null,
            remoteStream: null,
            peer: null,
            callStatus: 'idle',
            isMuted: false,
            isVideoOff: false,
            incomingCall: null,
            callStartTime: null
        });
    }
}));
