import { create } from 'zustand';
import toast from 'react-hot-toast';
import { axiosInstance } from '../lib/axios';
import { useAuthStore } from './useAuthStore';

export const useCallStore = create((set, get) => ({
    // State
    isInCall: false,
    callType: null, // 'audio' or 'video'
    caller: null,
    receiver: null,
    incomingCall: null,
    callStatus: 'idle', // idle | calling | ringing | connecting | connected | reconnecting
    isMuted: false,
    isVideoOff: false,
    isSpeakerOn: false,
    callStartTime: null,
    roomID: null,
    zegoInstance: null,
    isMinimized: false,
    callHistory: [],
    isLoadingHistory: false,
    /** Summary shown on WhatsApp-style end screen */
    endedCall: null,

    setIncomingCall: (callData) => set({ incomingCall: callData, callStatus: 'ringing' }),

    clearIncomingCall: () => set({ incomingCall: null, callStatus: 'idle' }),

    setRoomID: (roomID) => set({ roomID }),

    setZegoInstance: (instance) => set({ zegoInstance: instance }),

    setCallStatus: (status) => {
        set({ callStatus: status });
        if (status === 'connected' && !get().callStartTime) {
            set({ callStartTime: Date.now() });
        }
    },

    startCall: (user, callType, roomID) => set({
        isInCall: true,
        callType,
        receiver: user,
        caller: null,
        callStatus: 'calling',
        roomID,
        endedCall: null,
        isMinimized: false,
    }),

    acceptCall: (caller, callType, roomID) => set({
        isInCall: true,
        callType,
        caller,
        receiver: null,
        callStatus: 'connecting',
        incomingCall: null,
        roomID,
        endedCall: null,
        isMinimized: false,
    }),

    toggleMute: () => {
        const { isMuted, zegoInstance } = get();
        const next = !isMuted;
        set({ isMuted: next });
        try {
            const authUser = useAuthStore.getState().authUser;
            const userID = authUser?._id?.toString?.();
            if (!zegoInstance || !userID) return;
            if (typeof zegoInstance.turnMicrophoneOn === 'function') {
                zegoInstance.turnMicrophoneOn(userID, !next);
            } else if (typeof zegoInstance.muteMicrophone === 'function') {
                zegoInstance.muteMicrophone(next);
            }
        } catch (e) {
            console.warn('Mute toggle via Zego failed:', e);
        }
    },

    toggleSpeaker: () => {
        const { isSpeakerOn } = get();
        const next = !isSpeakerOn;
        set({ isSpeakerOn: next });
        try {
            const media = document.querySelectorAll('audio, video');
            media.forEach((el) => {
                if (typeof el.setSinkId === 'function') {
                    // Best-effort: default device when speaker on
                    el.setSinkId('').catch(() => {});
                }
                el.muted = false;
                el.volume = next ? 1 : 0.85;
            });
        } catch (_) {
            /* ignore */
        }
    },

    toggleVideo: () => {
        const { isVideoOff, zegoInstance } = get();
        const next = !isVideoOff;
        set({ isVideoOff: next });
        try {
            const authUser = useAuthStore.getState().authUser;
            const userID = authUser?._id?.toString?.();
            if (zegoInstance && userID && typeof zegoInstance.turnCameraOn === 'function') {
                zegoInstance.turnCameraOn(userID, !next);
            }
        } catch (e) {
            console.warn('Video toggle via Zego failed:', e);
        }
    },

    toggleMinimize: () => {
        const { isMinimized } = get();
        set({ isMinimized: !isMinimized });
    },

    dismissEndedCall: () => set({ endedCall: null }),

    /**
     * @param {string} [reason] ended | declined | rejected | missed | busy | unavailable
     */
    endCall: async (reason = 'ended') => {
        const {
            zegoInstance,
            roomID,
            callStartTime,
            receiver,
            caller,
            callType,
            incomingCall,
        } = get();

        let duration = 0;
        if (callStartTime) {
            duration = Math.floor((Date.now() - callStartTime) / 1000);
        }

        const participant =
            receiver ||
            caller ||
            incomingCall?.fromData ||
            null;

        const endedCall = participant
            ? {
                participant,
                callType: callType || incomingCall?.callType || 'audio',
                duration,
                status: reason,
                endedAt: Date.now(),
            }
            : null;

        const { socket } = useAuthStore.getState();
        const targetId = receiver?._id || caller?._id;

        if (socket && targetId && roomID) {
            socket.emit('call:end', {
                to: targetId,
                roomID,
                duration,
            });
        }

        if (zegoInstance) {
            try {
                navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                    .then((stream) => {
                        stream.getTracks().forEach((track) => track.stop());
                    })
                    .catch(() => {});

                await new Promise((resolve) => {
                    setTimeout(() => {
                        document.querySelectorAll('video, audio').forEach((element) => {
                            if (element.srcObject) {
                                element.srcObject.getTracks().forEach((track) => track.stop());
                                element.srcObject = null;
                            }
                            try {
                                element.pause();
                                element.removeAttribute('src');
                                element.load();
                            } catch (_) {
                                /* ignore */
                            }
                        });
                        resolve();
                    }, 80);
                });

                try {
                    if (typeof zegoInstance.hangUp === 'function') {
                        zegoInstance.hangUp();
                    }
                } catch (_) {
                    /* ignore */
                }

                try {
                    await zegoInstance.destroy();
                } catch (_) {
                    /* ignore */
                }
            } catch (error) {
                console.error('Error during media cleanup:', error);
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
            isSpeakerOn: false,
            incomingCall: null,
            callStartTime: null,
            roomID: null,
            zegoInstance: null,
            isMinimized: false,
            endedCall,
        });
    },

    fetchCallHistory: async (filter = 'all') => {
        set({ isLoadingHistory: true });
        try {
            const res = await axiosInstance.get(`/call/history?filter=${filter}`);
            set({ callHistory: res.data.calls });
        } catch (error) {
            console.error('Error fetching call history:', error);
            toast.error(error.response?.data?.error || 'Failed to fetch call history');
        } finally {
            set({ isLoadingHistory: false });
        }
    },
}));
