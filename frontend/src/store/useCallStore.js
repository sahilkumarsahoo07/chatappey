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
    callStatus: 'idle', // 'idle', 'ringing', 'connecting', 'connected'
    isMuted: false,
    isVideoOff: false,
    callStartTime: null,
    roomID: null, // ZegoCloud room ID
    zegoInstance: null, // ZegoCloud instance reference
    isMinimized: false, // Track if call window is minimized
    callHistory: [], // Array of call records
    isLoadingHistory: false, // Loading state for call history

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

    endCall: async () => {
        const { zegoInstance, roomID, callStartTime, receiver, caller } = get();

        console.log('=== ENDING CALL ===');

        // Calculate call duration
        let duration = 0;
        if (callStartTime) {
            duration = Math.floor((Date.now() - callStartTime) / 1000);
        }

        // Emit call end event to backend with duration
        const { socket, authUser } = useAuthStore.getState();
        const targetId = receiver?._id || caller?._id;

        if (socket && targetId && roomID) {
            socket.emit('call:end', {
                to: targetId,
                roomID,
                duration
            });
        }

        // CRITICAL: Stop all media tracks IMMEDIATELY
        if (zegoInstance) {
            try {
                console.log('🛑 Stopping all media tracks...');

                // Method 1: Stop all getUserMedia streams via browser API
                navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                    .then(stream => {
                        stream.getTracks().forEach(track => {
                            console.log('Stopping getUserMedia track:', track.kind, track.label);
                            track.stop();
                        });
                    })
                    .catch(() => {
                        // Ignore errors, streams might already be stopped
                    });

                // Method 2: Query and stop all media elements
                const stopAllMediaTracks = () => {
                    return new Promise((resolve) => {
                        // Use setTimeout to ensure DOM has updated
                        setTimeout(() => {
                            const mediaElements = document.querySelectorAll('video, audio');
                            console.log(`Found ${mediaElements.length} media elements`);

                            mediaElements.forEach(element => {
                                if (element.srcObject) {
                                    const tracks = element.srcObject.getTracks();
                                    tracks.forEach(track => {
                                        console.log('Stopping track:', track.kind, track.label);
                                        track.stop();
                                    });
                                    element.srcObject = null;
                                }
                                // Remove the element to force cleanup
                                if (element.parentNode) {
                                    element.pause();
                                    element.removeAttribute('src');
                                    element.load();
                                }
                            });
                            resolve();
                        }, 100);
                    });
                };

                await stopAllMediaTracks();

                // Method 3: Destroy the ZegoCloud instance (this should release all resources)
                console.log('Destroying ZegoCloud instance...');
                try {
                    await zegoInstance.destroy();
                } catch (error) {
                    console.log('ZegoCloud destroy error (might be already destroyed):', error);
                }

                // Additional cleanup: Stop all active media stream tracks globally
                setTimeout(() => {
                    navigator.mediaDevices.enumerateDevices().then(() => {
                        // This refreshes the device list and helps release locked devices
                        console.log('✅ Media devices refreshed');
                    });
                }, 200);

                console.log('✅ All media cleanup complete');
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
            incomingCall: null,
            callStartTime: null,
            roomID: null,
            zegoInstance: null,
            isMinimized: false
        });
    },

    // Fetch call history from backend
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
    }
}));
