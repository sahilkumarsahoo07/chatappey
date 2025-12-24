import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import GroupChatHeader from "./GroupChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime, formatDateSeparator, getMessageDateKey } from "../lib/utils";
import defaultAvatar from "../public/avatar.png";
import { MoreVertical, Copy, Trash2, Forward, Search, Users, X, Pin, Info, Shield, Clock, Check, CheckCheck } from "lucide-react";
import { Menu, MenuItem, Dialog, DialogTitle, DialogContent } from "@mui/material";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useSwipeBack } from "../hooks/useSwipeBack";

const GroupChatContainer = () => {
    const {
        selectedGroup,
        groupMessages,
        isGroupMessagesLoading,
        getGroupMessages,
        sendGroupMessage,
        deleteGroupMessageForAll,
        deleteGroupMessageForMe,
        pinMessage,
        unpinMessage,
        groups,
        votePoll,
        typingUsers
    } = useGroupStore();
    const { users, setSelectedUser } = useChatStore();
    const { authUser } = useAuthStore();
    const { setSelectedGroup } = useGroupStore();

    // Swipe back hook for mobile navigation
    useSwipeBack(() => {
        setSelectedGroup(null);
        setSelectedUser(null);
    });
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Menu state
    const [anchorEl, setAnchorEl] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deleteDialogMessageId, setDeleteDialogMessageId] = useState(null);
    const [forwardDialogMessageId, setForwardDialogMessageId] = useState(null);
    const [forwardSearchQuery, setForwardSearchQuery] = useState("");
    const [forwardTab, setForwardTab] = useState("users"); // "users" or "groups"
    const [infoDialogMessageId, setInfoDialogMessageId] = useState(null);
    const longPressTimerRef = useRef(null);
    const longPressMessageRef = useRef(null);

    // Fetch messages when group is selected
    useEffect(() => {
        if (selectedGroup?._id) {
            getGroupMessages(selectedGroup._id);
        }
    }, [selectedGroup?._id, getGroupMessages]);

    // Auto scroll to bottom - always scroll like regular chat
    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    useLayoutEffect(() => {
        if (containerRef.current && groupMessages) {
            scrollToBottom();
        }
    }, [groupMessages]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100);
    };

    const handleSendMessage = async (messageData) => {
        await sendGroupMessage(messageData);
    };

    const handleCopyText = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => toast.success("Text copied to clipboard"))
            .catch(() => toast.error("Failed to copy text"));
    };

    const handleDeleteForEveryone = async (messageId) => {
        await deleteGroupMessageForAll(selectedGroup._id, messageId);
        setDeleteDialogMessageId(null);
    };

    const handleDeleteForMe = async (messageId) => {
        await deleteGroupMessageForMe(selectedGroup._id, messageId);
        setDeleteDialogMessageId(null);
    };

    const handleForwardToUser = async (userId) => {
        const message = groupMessages.find(m => m._id === forwardDialogMessageId);
        if (!message) return;

        try {
            // Send the message content directly to the user via API
            await axiosInstance.post(`/messages/send/${userId}`, {
                text: message.text,
                image: message.image
            });
            toast.success("Message forwarded");
            setForwardDialogMessageId(null);
            setForwardSearchQuery("");
        } catch (error) {
            console.error("Forward error:", error);
            toast.error("Failed to forward message");
        }
    };

    const handleForwardToGroup = async (groupId) => {
        const message = groupMessages.find(m => m._id === forwardDialogMessageId);
        if (!message) return;

        try {
            // Send message to group with forwarded flag
            await sendGroupMessage({
                text: message.text,
                image: message.image,
                isForwarded: true
            }, groupId);
            toast.success("Message forwarded to group");
            setForwardDialogMessageId(null);
            setForwardSearchQuery("");
        } catch (error) {
            console.error("Forward to group error:", error);
            toast.error("Failed to forward message");
        }
    };

    const handlePinMessage = async (messageId) => {
        setOpenMenuId(null);
        if (selectedGroup.pinnedMessage?._id === messageId) {
            await unpinMessage(selectedGroup._id);
        } else {
            await pinMessage(selectedGroup._id, messageId);
        }
    };

    const isOwner = selectedGroup?.admin?._id === authUser?._id;
    const currentUserMember = selectedGroup?.members?.find(m => (m.user?._id || m.user || m).toString() === authUser?._id);
    const isAdmin = isOwner || currentUserMember?.role === "admin";

    // Long press handlers for mobile
    const handleTouchStart = (e, messageId) => {
        longPressMessageRef.current = e.currentTarget;
        longPressTimerRef.current = setTimeout(() => {
            setAnchorEl(longPressMessageRef.current);
            setOpenMenuId(messageId);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    // Filter users and groups for forward dialog - only show friends
    const filteredUsers = users.filter(user =>
        user._id !== authUser._id &&
        user.isFriend === true &&
        user.fullName.toLowerCase().includes(forwardSearchQuery.toLowerCase())
    );

    const filteredGroups = groups.filter(group =>
        group._id !== selectedGroup?._id &&
        group.name.toLowerCase().includes(forwardSearchQuery.toLowerCase())
    );

    // Helper to render message text with highlighted mentions
    const renderMessageWithMentions = (text, mentions, isMyMessage) => {
        if (!text) return null;
        if (!mentions || mentions.length === 0) return text;

        // Create a regex to find @mentions
        const mentionNames = mentions.map(m => m.fullName).filter(Boolean);
        if (mentionNames.length === 0) return text;

        const mentionPattern = new RegExp(`(@(?:${mentionNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'gi');
        const parts = text.split(mentionPattern);

        return parts.map((part, index) => {
            const isMention = mentionNames.some(name =>
                part.toLowerCase() === `@${name.toLowerCase()}`
            );

            if (isMention) {
                return (
                    <span
                        key={index}
                        className={`font-semibold ${isMyMessage ? 'text-white/90 bg-white/20' : 'text-primary bg-primary/10'} px-1 rounded`}
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    if (!selectedGroup) return null;

    return (
        <div className="flex flex-col h-full">
            <GroupChatHeader />

            {/* Messages Area */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                onScroll={handleScroll}
            >
                {isGroupMessagesLoading ? (
                    <MessageSkeleton />
                ) : (
                    <>
                        {groupMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="text-4xl">👥</span>
                                </div>
                                <p className="text-lg font-semibold">No messages yet</p>
                                <p className="text-sm">Be the first to send a message!</p>
                            </div>
                        ) : (
                            groupMessages.map((message, index) => {
                                const isMyMessage = message.senderId?._id === authUser._id;
                                const sender = message.senderId;
                                const showSender = !isMyMessage && (
                                    index === 0 ||
                                    groupMessages[index - 1]?.senderId?._id !== sender?._id
                                );
                                const isDeleted = message.text === "This message was deleted";

                                // Check if we need to show a date separator
                                const currentDateKey = getMessageDateKey(message.createdAt);
                                const previousDateKey = index > 0 ? getMessageDateKey(groupMessages[index - 1].createdAt) : null;
                                const showDateSeparator = currentDateKey !== previousDateKey;

                                // Date Separator Component
                                const DateSeparator = showDateSeparator ? (
                                    <div className="flex justify-center my-4">
                                        <div className="bg-base-300/80 text-base-content/70 px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm backdrop-blur-sm">
                                            {formatDateSeparator(message.createdAt)}
                                        </div>
                                    </div>
                                ) : null;

                                if (message.messageType === "system") {
                                    return (
                                        <div key={message._id}>
                                            {DateSeparator}
                                            <div className="flex justify-center my-2">
                                                <div className="bg-base-300/30 text-base-content/60 px-4 py-1.5 rounded-lg text-[11px] font-medium backdrop-blur-sm border border-base-content/5 shadow-sm">
                                                    {message.text}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={message._id}>
                                        {DateSeparator}
                                        <div
                                            className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
                                        >
                                            <div className={`flex gap-2 max-w-[80%] ${isMyMessage ? "flex-row-reverse" : ""}`}>
                                                {/* Avatar for other users */}
                                                {!isMyMessage && showSender && (
                                                    <img
                                                        src={sender?.profilePic || defaultAvatar}
                                                        alt={sender?.fullName}
                                                        className="w-8 h-8 rounded-full object-cover self-end"
                                                    />
                                                )}
                                                {!isMyMessage && !showSender && (
                                                    <div className="w-8" />
                                                )}

                                                <div className="relative group">
                                                    {/* Sender name */}
                                                    {showSender && !isMyMessage && (
                                                        <p className="text-xs text-base-content/60 mb-1 ml-1">
                                                            {sender?.fullName}
                                                        </p>
                                                    )}

                                                    {/* Message bubble */}
                                                    <div
                                                        className={`rounded-2xl p-3 ${isMyMessage
                                                            ? "bg-primary text-primary-content rounded-br-md"
                                                            : "bg-base-200 text-base-content rounded-bl-md"
                                                            } ${isDeleted ? "opacity-60 italic" : ""}`}
                                                        onTouchStart={(e) => !isDeleted && handleTouchStart(e, message._id)}
                                                        onTouchEnd={handleTouchEnd}
                                                        onTouchMove={handleTouchEnd}
                                                    >
                                                        {/* Forwarded badge */}
                                                        {message.isForwarded && !isDeleted && (
                                                            <div className={`flex items-center gap-1 text-xs mb-1.5 ${isMyMessage ? "text-primary-content/70" : "text-base-content/50"
                                                                }`}>
                                                                <Forward className="w-3 h-3" />
                                                                <span className="italic">Forwarded</span>
                                                            </div>
                                                        )}
                                                        {message.image && (
                                                            <img
                                                                src={message.image}
                                                                alt="Attachment"
                                                                className="rounded-lg mb-2 max-w-xs"
                                                            />
                                                        )}
                                                        {/* Poll support */}
                                                        {message.poll && message.poll.question && message.poll.options && Array.isArray(message.poll.options) && message.poll.options.length > 0 && (
                                                            <div className="bg-base-100/10 p-3 rounded-xl my-1 w-full min-w-[220px] md:min-w-[260px] border border-base-content/10">
                                                                <h4 className="font-bold mb-3 flex items-center gap-2 text-sm">{message.poll.question}</h4>
                                                                <div className="space-y-2">
                                                                    {message.poll.options.map((opt, i) => {
                                                                        const totalVotes = message.poll.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
                                                                        const percent = totalVotes === 0 ? 0 : Math.round(((opt.votes?.length || 0) / totalVotes) * 100);
                                                                        const isVoted = opt.votes?.includes(authUser._id) || false;
                                                                        return (
                                                                            <div key={i} className="relative cursor-pointer group" onClick={() => votePoll(message._id, i)}>
                                                                                <div className="flex justify-between text-xs mb-1 font-medium">
                                                                                    <span className={isVoted ? 'text-secondary' : ''}>{opt.text} {isVoted && '✓'}</span>
                                                                                    <span>{percent}%</span>
                                                                                </div>
                                                                                <div className="w-full h-2 bg-base-100/20 rounded-full overflow-hidden">
                                                                                    <div className={`h-full transition-all duration-500 ease-out ${isVoted ? 'bg-secondary' : 'bg-base-content/50'}`} style={{ width: `${percent}%` }}></div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="mt-3 text-xs opacity-60 flex justify-between"><span>{message.poll.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0)} votes</span><span>Poll</span></div>
                                                            </div>
                                                        )}
                                                        {message.text && (
                                                            <p className="whitespace-pre-wrap break-words">
                                                                {renderMessageWithMentions(message.text, message.mentions, isMyMessage)}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* 3-dot menu button - desktop only */}
                                                    {!isDeleted && (
                                                        <button
                                                            className={`absolute top-2 p-1 hidden md:block opacity-0 group-hover:opacity-100 transition-all hover:bg-base-200 rounded-full ${isMyMessage ? "left-[-28px]" : "right-[-28px]"
                                                                }`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAnchorEl(e.currentTarget);
                                                                setOpenMenuId(message._id);
                                                            }}
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Message Menu */}
                                                    <Menu
                                                        anchorEl={anchorEl}
                                                        open={openMenuId === message._id}
                                                        onClose={() => setOpenMenuId(null)}
                                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                                                        PaperProps={{ sx: { width: 180, borderRadius: "12px" } }}
                                                    >
                                                        {!isDeleted && (
                                                            <MenuItem onClick={() => { setOpenMenuId(null); setInfoDialogMessageId(message._id); }}>
                                                                <Info className="w-4 h-4 mr-2" /> Message Info
                                                            </MenuItem>
                                                        )}
                                                        {isAdmin && !isDeleted && (
                                                            <MenuItem onClick={() => handlePinMessage(message._id)}>
                                                                <Pin className="w-4 h-4 mr-2" /> {selectedGroup.pinnedMessage?._id === message._id ? "Unpin Message" : "Pin Message"}
                                                            </MenuItem>
                                                        )}
                                                        {!message.image && message.text && message.text !== "This message was deleted" && (
                                                            <MenuItem onClick={() => { handleCopyText(message.text); setOpenMenuId(null); }}>
                                                                <Copy className="w-4 h-4 mr-2" /> Copy
                                                            </MenuItem>
                                                        )}
                                                        {message.text !== "This message was deleted" && (
                                                            <MenuItem onClick={() => { setOpenMenuId(null); setForwardDialogMessageId(message._id); }}>
                                                                <Forward className="w-4 h-4 mr-2" /> Forward
                                                            </MenuItem>
                                                        )}
                                                        <MenuItem
                                                            sx={{ color: "error.main" }}
                                                            onClick={() => { setOpenMenuId(null); setDeleteDialogMessageId(message._id); }}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                        </MenuItem>
                                                    </Menu>

                                                    {/* Delete Dialog */}
                                                    {deleteDialogMessageId === message._id && (
                                                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                                            <div
                                                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                                                onClick={() => setDeleteDialogMessageId(null)}
                                                            />
                                                            <div className="relative bg-base-100 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                                                                <div className="p-6 pb-4 text-center">
                                                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
                                                                        <Trash2 className="w-8 h-8 text-error" />
                                                                    </div>
                                                                    <h3 className="text-xl font-bold text-base-content mb-2">Delete Message?</h3>
                                                                    <p className="text-sm text-base-content/60">Choose how you want to delete this message</p>
                                                                </div>
                                                                <div className="p-4 pt-0 space-y-3">
                                                                    {isMyMessage && (
                                                                        <button
                                                                            onClick={() => handleDeleteForEveryone(message._id)}
                                                                            className="w-full py-3.5 px-4 rounded-xl bg-error hover:bg-error/90 text-white font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                                                        >
                                                                            <Trash2 className="w-5 h-5" />
                                                                            Delete for Everyone
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDeleteForMe(message._id)}
                                                                        className="w-full py-3.5 px-4 rounded-xl bg-base-200 hover:bg-base-300 text-base-content font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                                                    >
                                                                        Delete for Me
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteDialogMessageId(null)}
                                                                        className="w-full py-3 px-4 rounded-xl text-base-content/70 hover:text-base-content hover:bg-base-200/50 font-medium transition-all"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Forward Dialog */}
                                                    {forwardDialogMessageId === message._id && (
                                                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                                            <div
                                                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                                                onClick={() => { setForwardDialogMessageId(null); setForwardSearchQuery(""); }}
                                                            />
                                                            <div className="relative bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in max-h-[80vh] flex flex-col">
                                                                {/* Header */}
                                                                <div className="p-4 border-b border-base-300 flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                                            <Forward className="w-5 h-5 text-primary" />
                                                                        </div>
                                                                        <h3 className="text-lg font-bold">Forward Message</h3>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => { setForwardDialogMessageId(null); setForwardSearchQuery(""); }}
                                                                        className="p-2 rounded-full hover:bg-base-200 transition-colors"
                                                                    >
                                                                        <X className="w-5 h-5" />
                                                                    </button>
                                                                </div>

                                                                {/* Search */}
                                                                <div className="p-3 border-b border-base-300">
                                                                    <div className="flex items-center gap-2 bg-base-200 rounded-full px-4 py-2">
                                                                        <Search className="w-4 h-4 text-base-content/50" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Search..."
                                                                            value={forwardSearchQuery}
                                                                            onChange={(e) => setForwardSearchQuery(e.target.value)}
                                                                            className="flex-1 bg-transparent outline-none text-sm"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Tabs */}
                                                                <div className="flex border-b border-base-300">
                                                                    <button
                                                                        onClick={() => setForwardTab("users")}
                                                                        className={`flex-1 py-3 text-sm font-medium transition-colors ${forwardTab === "users"
                                                                            ? "text-primary border-b-2 border-primary"
                                                                            : "text-base-content/60 hover:text-base-content"
                                                                            }`}
                                                                    >
                                                                        Contacts
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setForwardTab("groups")}
                                                                        className={`flex-1 py-3 text-sm font-medium transition-colors ${forwardTab === "groups"
                                                                            ? "text-primary border-b-2 border-primary"
                                                                            : "text-base-content/60 hover:text-base-content"
                                                                            }`}
                                                                    >
                                                                        Groups
                                                                    </button>
                                                                </div>

                                                                {/* List */}
                                                                <div className="flex-1 overflow-y-auto p-2">
                                                                    {forwardTab === "users" ? (
                                                                        filteredUsers.length === 0 ? (
                                                                            <p className="text-center text-base-content/50 py-8">No contacts found</p>
                                                                        ) : (
                                                                            filteredUsers.map(user => (
                                                                                <button
                                                                                    key={user._id}
                                                                                    onClick={() => handleForwardToUser(user._id)}
                                                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-colors"
                                                                                >
                                                                                    <img
                                                                                        src={user.profilePic || defaultAvatar}
                                                                                        alt={user.fullName}
                                                                                        className="w-10 h-10 rounded-full object-cover"
                                                                                    />
                                                                                    <div className="flex-1 text-left">
                                                                                        <p className="font-medium">{user.fullName}</p>
                                                                                        <p className="text-xs text-base-content/50">{user.email}</p>
                                                                                    </div>
                                                                                    <Forward className="w-4 h-4 text-base-content/30" />
                                                                                </button>
                                                                            ))
                                                                        )
                                                                    ) : (
                                                                        filteredGroups.length === 0 ? (
                                                                            <p className="text-center text-base-content/50 py-8">No groups found</p>
                                                                        ) : (
                                                                            filteredGroups.map(group => (
                                                                                <button
                                                                                    key={group._id}
                                                                                    onClick={() => handleForwardToGroup(group._id)}
                                                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-colors"
                                                                                >
                                                                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                                                                                        {group.image ? (
                                                                                            <img
                                                                                                src={group.image}
                                                                                                alt={group.name}
                                                                                                className="w-10 h-10 object-cover"
                                                                                            />
                                                                                        ) : (
                                                                                            <Users className="w-5 h-5 text-primary" />
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex-1 text-left">
                                                                                        <p className="font-medium">{group.name}</p>
                                                                                        <p className="text-xs text-base-content/50">{group.members?.length || 0} members</p>
                                                                                    </div>
                                                                                    <Forward className="w-4 h-4 text-base-content/30" />
                                                                                </button>
                                                                            ))
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Typing Indicator */}
                        {typingUsers.length > 0 && (
                            <div className="chat chat-start mb-2 px-2">
                                <div className="chat-bubble bg-base-200 text-base-content px-4 py-2 flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <span className="text-xs opacity-70">
                                        {typingUsers.length === 1
                                            ? `${typingUsers[0].userName} is typing...`
                                            : typingUsers.length === 2
                                                ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
                                                : `${typingUsers.length} people are typing...`
                                        }
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Read Receipts Dialog */}
            <Dialog
                open={!!infoDialogMessageId}
                onClose={() => setInfoDialogMessageId(null)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle className="flex items-center justify-between border-b border-base-300 bg-base-100">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-primary" />
                        <span className="text-lg font-semibold">Message Info</span>
                    </div>
                    <button onClick={() => setInfoDialogMessageId(null)} className="btn btn-ghost btn-sm btn-circle">
                        <X className="w-4 h-4" />
                    </button>
                </DialogTitle>
                <DialogContent className="p-0 bg-base-100">
                    <div className="p-4">
                        <h4 className="text-xs font-bold text-base-content/40 uppercase mb-3 px-2">Read by</h4>
                        <div className="space-y-1">
                            {(() => {
                                const msg = groupMessages.find(m => m._id === infoDialogMessageId);
                                const readers = msg?.readBy || [];
                                if (readers.length === 1 && readers[0]._id === authUser._id) {
                                    return <p className="text-sm text-center py-4 text-base-content/50">No one else has read this yet</p>;
                                }
                                return readers
                                    .filter(r => r._id !== authUser._id)
                                    .map(reader => (
                                        <div key={reader._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors">
                                            <img
                                                src={reader.profilePic || defaultAvatar}
                                                alt={reader.fullName}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{reader.fullName}</p>
                                                <div className="flex items-center gap-1 text-[10px] text-success">
                                                    <CheckCheck className="w-3 h-3" />
                                                    Read
                                                </div>
                                            </div>
                                        </div>
                                    ));
                            })()}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Message Input */}
            <MessageInput
                onSend={handleSendMessage}
                isGroupChat={true}
                isAdmin={isAdmin}
                announcementOnly={selectedGroup.announcementOnly}
                groupMembers={selectedGroup?.members || []}
            />
        </div>
    );
};

export default GroupChatContainer;
