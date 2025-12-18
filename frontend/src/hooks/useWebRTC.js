import { useEffect, useRef } from 'react';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

export const useWebRTC = () => {
    const { socket, authUser } = useAuthStore();
    const { setPeer, setRemoteStream, setLocalStream, endCall, setCallStatus, startCall } = useCallStore();
    const peerConnectionRef = useRef(null);

    const createPeerConnection = () => {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(configuration);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate:', event.candidate);
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote stream with tracks:', event.streams[0].getTracks());
            const remoteStream = event.streams[0];

            // Log audio tracks
            const audioTracks = remoteStream.getAudioTracks();
            console.log('Remote audio tracks:', audioTracks.length, audioTracks);

            setRemoteStream(remoteStream);
            setCallStatus('connected');
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                endCall();
            }
        };

        return pc;
    };

    const initiateCall = async (receiverId, receiverData, callType) => {
        try {
            // Get user media with explicit constraints
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callType === 'video' ? { width: 1280, height: 720 } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            console.log('Local stream tracks:', stream.getTracks());
            setLocalStream(stream);
            startCall(receiverData, callType);

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local stream to peer connection
            stream.getTracks().forEach(track => {
                console.log('Adding track to peer connection:', track.kind, track.enabled);
                pc.addTrack(track, stream);
            });

            // Create offer
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
            });
            await pc.setLocalDescription(offer);

            // Send offer via socket
            socket.emit('call:initiate', {
                to: receiverId,
                from: authUser._id,
                fromData: {
                    _id: authUser._id,
                    fullName: authUser.fullName,
                    profilePic: authUser.profilePic
                },
                callType,
                offer: offer
            });

        } catch (error) {
            console.error('Error accessing media devices:', error);
            toast.error('Could not access camera/microphone');
            endCall();
        }
    };

    const answerCall = async (offer, caller, callType) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callType === 'video' ? { width: 1280, height: 720 } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            console.log('Local stream tracks (answering):', stream.getTracks());
            setLocalStream(stream);
            useCallStore.getState().acceptCall(caller, callType);

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local stream
            stream.getTracks().forEach(track => {
                console.log('Adding track to peer connection (answer):', track.kind, track.enabled);
                pc.addTrack(track, stream);
            });

            // Set remote description (offer)
            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            // Create answer
            const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
            });
            await pc.setLocalDescription(answer);

            // Send answer via socket
            socket.emit('call:answer', {
                to: caller._id,
                answer: answer
            });

        } catch (error) {
            console.error('Error answering call:', error);
            toast.error('Could not access camera/microphone');
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

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        endCall();
    };

    // Listen for call answer, call end, and call reject
    useEffect(() => {
        if (!socket) return;

        const handleCallAnswered = async ({ answer }) => {
            console.log('Call answered, setting remote description');
            const pc = peerConnectionRef.current;
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleCallEnded = () => {
            console.log('Call ended by other user - cleaning up');
            // Close peer connection
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            // This will trigger the endCall in the store which shows the duration toast
        };

        const handleCallRejected = () => {
            console.log('Call was rejected');
            toast.error('Call was not answered', {
                icon: '📵'
            });
            // Close peer connection
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
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
    }, [socket]);

    return { initiateCall, answerCall, rejectCall, endCall: endCallWithNotification };
};
