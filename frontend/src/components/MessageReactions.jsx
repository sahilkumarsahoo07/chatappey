import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

const MessageReactions = ({ messageId, reactions = [], senderId }) => {
    const { authUser } = useAuthStore();
    const { sendReaction, users } = useChatStore();
    const isSenderMe = senderId === authUser?._id;

    if (!reactions || reactions.length === 0) return null;

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, curr) => {
        if (!acc[curr.emoji]) acc[curr.emoji] = [];
        acc[curr.emoji].push(curr.userId);
        return acc;
    }, {});

    const handleReactionClick = (e, emoji) => {
        e.stopPropagation();
        if (isSenderMe) return; // Prevent toggling reaction to your own message
        sendReaction(messageId, emoji);
    };

    const getUserName = (userId) => {
        if (userId === authUser?._id) return "You";
        const user = users.find(u => u._id === userId);
        return user?.fullName || "Someone";
    };

    return (
        <div className={`absolute -bottom-3 ${senderId === authUser?._id ? 'left-2' : 'right-2'} flex flex-wrap gap-1 z-20`}>
            {Object.entries(groupedReactions).map(([emoji, userIds]) => {
                const hasReacted = userIds.includes(authUser?._id);
                const usersList = userIds.map(id => getUserName(id)).join(', ');

                return (
                    <div
                        key={emoji}
                        className={`tooltip tooltip-top tooltip-primary ${isSenderMe ? 'cursor-default' : 'cursor-pointer'} transition-all duration-200 hover:scale-110 active:scale-95`}
                        data-tip={usersList}
                        onClick={(e) => handleReactionClick(e, emoji)}
                    >
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md text-[11px] sm:text-xs
              ${hasReacted
                                ? 'bg-primary border-primary text-primary-content font-bold scale-105'
                                : 'bg-base-100/90 border-base-300 text-base-content font-medium'
                            }`}
                        >
                            <span className="leading-none">{emoji}</span>
                            {userIds.length > 1 && (
                                <span className="opacity-90">{userIds.length}</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MessageReactions;
