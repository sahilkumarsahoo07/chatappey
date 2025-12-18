import { Phone, Video, PhoneMissed, PhoneOutgoing, PhoneIncoming } from 'lucide-react';
import defaultImg from '../public/avatar.png';
import { useCallStore } from '../store/useCallStore';
import { useAuthStore } from '../store/useAuthStore';

const CallHistoryItem = ({ call }) => {
    const { authUser } = useAuthStore();
    const { startCall } = useCallStore();

    // Determine if this is an incoming or outgoing call for current user
    const isIncoming = call.receiver._id === authUser._id;
    const isOutgoing = call.caller._id === authUser._id;
    const isMissed = call.status === 'missed' || call.status === 'unanswered' || call.status === 'rejected';

    // Get the other user's data
    const otherUser = isIncoming ? call.caller : call.receiver;

    // Format call duration
    const formatDuration = (seconds) => {
        if (seconds === 0) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    };

    // Format timestamp
    const formatTimestamp = (date) => {
        const callDate = new Date(date);
        const now = new Date();
        const diffMs = now - callDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Today - show time
        if (diffDays === 0) {
            return callDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        // Yesterday
        if (diffDays === 1) {
            return 'Yesterday';
        }

        // This week - show day name
        if (diffDays < 7) {
            return callDate.toLocaleDateString('en-US', { weekday: 'long' });
        }

        // Older - show date
        return callDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    // Get call type icon and color
    const getCallTypeDisplay = () => {
        if (isMissed && isIncoming) {
            return {
                icon: PhoneMissed,
                label: 'Missed incoming',
                color: 'text-red-500',
                bgColor: 'bg-red-50'
            };
        }
        if (isIncoming) {
            return {
                icon: PhoneIncoming,
                label: 'Incoming',
                color: 'text-blue-500',
                bgColor: 'bg-blue-50'
            };
        }
        return {
            icon: PhoneOutgoing,
            label: 'Outgoing',
            color: 'text-green-500',
            bgColor: 'bg-green-50'
        };
    };

    const callTypeDisplay = getCallTypeDisplay();
    const CallTypeIcon = callTypeDisplay.icon;

    const handleCallClick = () => {
        startCall(otherUser, call.callType, `room_${Date.now()}_${authUser._id}_${otherUser._id}`);
    };

    return (
        <div
            className="flex items-center gap-3 p-3 hover:bg-base-200/50 rounded-lg transition-colors cursor-pointer"
            onClick={handleCallClick}
        >
            {/* User Avatar */}
            <div className="relative">
                <img
                    src={otherUser.profilePic || defaultImg}
                    alt={otherUser.fullName}
                    className="w-12 h-12 rounded-full object-cover"
                />
            </div>

            {/* Call Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base-content truncate">
                        {otherUser.fullName}
                    </h3>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <div className={`flex items-center gap-1 ${callTypeDisplay.color}`}>
                        <CallTypeIcon className="w-4 h-4" />
                        <span>{callTypeDisplay.label}</span>
                    </div>
                    {call.status === 'completed' && (
                        <>
                            <span className="text-base-content/40">•</span>
                            <span className="text-base-content/60">
                                {formatDuration(call.duration)}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Timestamp and Call Type Icon */}
            <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-base-content/60">
                    {formatTimestamp(call.createdAt)}
                </span>
                <div className={`p-1.5 rounded-full ${callTypeDisplay.bgColor}`}>
                    {call.callType === 'video' ? (
                        <Video className={`w-4 h-4 ${callTypeDisplay.color}`} />
                    ) : (
                        <Phone className={`w-4 h-4 ${callTypeDisplay.color}`} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallHistoryItem;
