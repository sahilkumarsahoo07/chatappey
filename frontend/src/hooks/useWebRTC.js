import { useEffect } from 'react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import { generateRoomID } from '../config/zegoConfig';
import toast from 'react-hot-toast';

export const useWebRTC = () => {
    const { socket, authUser } = useAuthStore();
    const { endCall, setCallStatus, startCall } = useCallStore();

    const initiateCall = async (receiverId, receiverData, callType) => {
        try {
            console.log('=== INITIATING CALL ===');
            console.log('Caller:', authUser.fullName, '(', authUser._id, ')');
            console.log('Receiver:', receiverData.fullName, '(', receiverId, ')');
            console.log('Call Type:', callType);
            console.log('Socket connected:', socket?.connected);

            if (!socket || !socket.connected) {
                toast.error('Not connected to server. Please refresh the page.');
                return;
            }

            // Generate a unique room ID for this call
            const roomID = generateRoomID(authUser._id, receiverId);
            console.log('Generated Room ID:', roomID);

            // Start the call in the store
            startCall(receiverData, callType, roomID);

            // Prepare call data
            const callData = {
                to: receiverId,
                from: authUser._id,
                fromData: {
                    _id: authUser._id,
                    fullName: authUser.fullName,
                    profilePic: authUser.profilePic
                },
                callType,
                roomID
            };

            console.log('Emitting call:initiate with data:', callData);

            // Send call initiation via socket
            socket.emit('call:initiate', callData);

            console.log('✅ Call initiation event emitted');

        } catch (error) {
            console.error('Error initiating call:', error);
            toast.error('Could not start call');
            endCall();
        }
    };

    const answerCall = async (caller, callType, roomID) => {
        try {
            // Accept the call with the provided room ID
            useCallStore.getState().acceptCall(caller, callType, roomID);

            // Send answer via socket
            socket.emit('call:answer', {
                to: caller._id,
                roomID
            });

        } catch (error) {
            console.error('Error answering call:', error);
            toast.error('Could not answer call');
            endCall();
        }
    };

    const rejectCall = (callerId) => {
        socket.emit('call:reject', { to: callerId });
        useCallStore.getState().clearIncomingCall();
        toast.info('Call declined');
    };

    const endCallWithNotification = () => {
        const { receiver, caller } = useCallStore.getState();
        const targetId = receiver?._id || caller?._id;

        if (targetId) {
            socket.emit('call:end', { to: targetId });
        }

        endCall();
    };

    // Listen for call events
    useEffect(() => {
        if (!socket) return;

        const handleCallAnswered = ({ roomID }) => {
            console.log('Call answered, room ID:', roomID);
            setCallStatus('connecting');
        };

        const handleCallEnded = () => {
            console.log('Call ended by other user');
            endCall();
        };

        const handleCallRejected = () => {
            console.log('Call was rejected');
            toast.error('Call was not answered', {
                icon: '📵'
            });
            endCall();
        };

        socket.on('call:answered', handleCallAnswered);
        socket.on('call:ended', handleCallEnded);
        socket.on('call:rejected', handleCallRejected);

        return () => {
            socket.off('call:answered', handleCallAnswered);
            socket.off('call:ended', handleCallEnded);
            socket.off('call:rejected', handleCallRejected);
        };
    }, [socket, endCall, setCallStatus]);

    return { initiateCall, answerCall, rejectCall, endCall: endCallWithNotification };
};
