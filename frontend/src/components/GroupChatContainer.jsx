import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import GroupChatHeader from "./GroupChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime, formatDateSeparator, getMessageDateKey } from "../lib/utils";
import { sortMessages } from "../lib/messageSync";
import defaultAvatar from "../public/avatar.png";
import { useGroupVibeStore } from "../store/useGroupVibeStore";
import { Trash2, Forward, Search, Users, X, Download, ZoomIn, ZoomOut, Check, CheckCheck, Clock, ChevronDown } from "lucide-react";
import { formatGroupTypingLabel, formatGroupRecordingLabel } from "../lib/groupPresence";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useSwipeBack } from "../hooks/useSwipeBack";
import MessageActionMenu, {
    MessageMenuTrigger,
    buildGroupChatActions,
} from "./MessageActionMenu";
import SwipeableMessageBubble from "./SwipeableMessageBubble";
import VideoMessage from "./chat/VideoMessage";
import VirtualMessageList from "./chat/VirtualMessageList";
import VoiceMessagePlayer from "./chat/VoiceMessagePlayer";
import ChatSearchBar, { highlightText } from "./chat/ChatSearchBar";
import DeleteMessageSheet from "./chat/DeleteMessageSheet";
import MessageEditField from "./MessageEditField";
import DeletedMessageBubble from "./chat/DeletedMessageBubble";
import GroupMessageInfoDialog from "./chat/GroupMessageInfoDialog";
import { isMessageDeleted } from "../lib/messageDelete";
import { useChatFeaturesStore } from "../store/useChatFeaturesStore";
import { useShallow } from "zustand/react/shallow";
import "./ChatContainer.css";

const EMPTY_MEMBERS = [];

const formatSystemMessageText = (text, authUser) => {
    if (!text) return "";
    let str = text;
    const myName = authUser?.fullName;

    if (myName) {
        if (str === `${myName} left the group`) {
            return "You left";
        }
        if (str.startsWith(`${myName} created group`)) {
            return str.replace(`${myName} created group`, "You created group");
        }
        if (str.startsWith(`${myName} added `)) {
            return str.replace(`${myName} added `, "You added ");
        }
        if (str.endsWith(` added ${myName}`)) {
            return str.replace(` added ${myName}`, " added You");
        }
        if (str.startsWith(`${myName} removed `)) {
            return str.replace(`${myName} removed `, "You removed ");
        }
        if (str.endsWith(` removed ${myName}`)) {
            return str.replace(` removed ${myName}`, " removed You");
        }
        if (str.startsWith(`${myName} changed`)) {
            return str.replace(`${myName} changed`, "You changed");
        }
        if (str === `${myName} is now an admin`) {
            return "You are now an admin";
        }
    }

    if (str.endsWith(" left the group")) {
        return str.replace(" left the group", " left");
    }

    return str;
};

const GroupChatContainer = () => {
    const {
        selectedGroup,
        groupMessages,
        isGroupMessagesLoading,
        isLoadingOlderGroup,
        groupMessagesMeta,
        loadOlderGroupMessages,
        getGroupMessages,
        sendGroupMessage,
        deleteGroupMessageForAll,
        deleteGroupMessageForMe,
        pinMessage,
        unpinMessage,
        groups,
        votePoll,
        typingUsers,
        recordingUsers,
        markGroupMessagesAsRead,
        scrollTargetIndex,
        scrollTargetKey,
        setScrollTarget,
        editGroupMessage,
    } = useGroupStore(useShallow((s) => ({
        selectedGroup: s.selectedGroup,
        groupMessages: s.groupMessages,
        isGroupMessagesLoading: s.isGroupMessagesLoading,
        isLoadingOlderGroup: s.isLoadingOlderGroup,
        groupMessagesMeta: s.groupMessagesMeta,
        loadOlderGroupMessages: s.loadOlderGroupMessages,
        getGroupMessages: s.getGroupMessages,
        sendGroupMessage: s.sendGroupMessage,
        deleteGroupMessageForAll: s.deleteGroupMessageForAll,
        deleteGroupMessageForMe: s.deleteGroupMessageForMe,
        pinMessage: s.pinMessage,
        unpinMessage: s.unpinMessage,
        groups: s.groups,
        votePoll: s.votePoll,
        typingUsers: s.typingUsers,
        recordingUsers: s.recordingUsers,
        markGroupMessagesAsRead: s.markGroupMessagesAsRead,
        scrollTargetIndex: s.scrollTargetIndex,
        scrollTargetKey: s.scrollTargetKey,
        setScrollTarget: s.setScrollTarget,
        editGroupMessage: s.editGroupMessage,
    })));
    const { users, setSelectedUser, setReplyingToMessage } = useChatStore(useShallow((s) => ({
        users: s.users,
        setSelectedUser: s.setSelectedUser,
        setReplyingToMessage: s.setReplyingToMessage,
    })));
    const authUser = useAuthStore((s) => s.authUser);
    const setSelectedGroup = useGroupStore((s) => s.setSelectedGroup);
    const fetchGroupMessageInfo = useGroupStore((s) => s.fetchGroupMessageInfo);
    const refreshMessageInfo = useCallback(
        (gid, mid) => {
            if (gid && mid) fetchGroupMessageInfo(gid, mid);
        },
        [fetchGroupMessageInfo]
    );
    const toggleStar = useChatFeaturesStore((s) => s.toggleStar);
    const isStarred = useChatFeaturesStore((s) => s.isStarred);
    const loadStarredIds = useChatFeaturesStore((s) => s.loadStarredIds);

    useEffect(() => {
        loadStarredIds();
    }, [loadStarredIds]);

    // Remark as read when returning to an open group (WhatsApp-style)
    useEffect(() => {
        if (!selectedGroup?._id) return;
        const rematch = () => {
            if (document.hidden) return;
            markGroupMessagesAsRead(selectedGroup._id);
        };
        rematch();
        document.addEventListener("visibilitychange", rematch);
        window.addEventListener("focus", rematch);
        return () => {
            document.removeEventListener("visibilitychange", rematch);
            window.removeEventListener("focus", rematch);
        };
    }, [selectedGroup?._id, markGroupMessagesAsRead]);

    // Swipe back hook for mobile navigation
    useSwipeBack(() => {
        setSelectedGroup(null);
        setSelectedUser(null);
    });
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const prevSelectedGroupIdRef = useRef(null);
    const isAtBottomRef = useRef(true);
    const prevLastMsgIdRef = useRef(null);
    const prevMsgLenRef = useRef(0);
        const [pendingNewCount, setPendingNewCount] = useState(0);
    const [scrollEpoch, setScrollEpoch] = useState(0);
    const [showScrollDown, setShowScrollDown] = useState(false);

    const sortedGroupMessages = useMemo(
        () => sortMessages(groupMessages),
        [groupMessages]
    );

    const firstUnreadIndex = useMemo(() => {
        if (!authUser?._id || !sortedGroupMessages?.length) return -1;
        const myId = String(authUser._id);
        return sortedGroupMessages.findIndex((msg) => {
            const senderId = msg.senderId?._id || msg.senderId;
            if (String(senderId) === myId) return false;
            if (msg.messageType === "system") return false;
            const readers = msg.readBy || [];
            const alreadyRead = readers.some((r) => String(r?._id || r?.userId || r) === myId);
            return !alreadyRead;
        });
    }, [sortedGroupMessages, authUser?._id]);

    // Menu state
    const [anchorEl, setAnchorEl] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [deleteDialogMessageId, setDeleteDialogMessageId] = useState(null);
    const [forwardDialogMessageId, setForwardDialogMessageId] = useState(null);
    const [forwardSearchQuery, setForwardSearchQuery] = useState("");
    const [forwardTab, setForwardTab] = useState("users"); // "users" or "groups"
    const [infoDialogMessageId, setInfoDialogMessageId] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [imageZoom, setImageZoom] = useState(1);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchActiveId, setSearchActiveId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch messages when group is selected
    useEffect(() => {
        if (selectedGroup?._id) {
            getGroupMessages(selectedGroup._id);
            isAtBottomRef.current = true;
            setPendingNewCount(0);
            setShowScrollDown(false);
            setScrollEpoch((n) => n + 1);
            prevLastMsgIdRef.current = null;
            prevMsgLenRef.current = 0;
            setSearchOpen(false);
            setSearchQuery("");
            setSearchActiveId(null);
            setInfoDialogMessageId(null);
            setOpenMenuId(null);
            setDeleteDialogMessageId(null);
            setForwardDialogMessageId(null);
        }
    }, [selectedGroup?._id, getGroupMessages]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isFar = scrollHeight - scrollTop - clientHeight > 300;
        setShowScrollDown(isFar);
        const atBottom = scrollHeight - scrollTop - clientHeight < 100;
        isAtBottomRef.current = atBottom;
        if (atBottom) setPendingNewCount(0);
    };

    const handleAtBottomChange = useCallback((atBottom) => {
        isAtBottomRef.current = atBottom;
        if (atBottom) {
            setPendingNewCount(0);
            setShowScrollDown(false);
        } else {
            if (containerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
                setShowScrollDown(scrollHeight - scrollTop - clientHeight > 300);
            }
        }
    }, []);

    const jumpToLatest = useCallback(() => {
        setPendingNewCount(0);
        isAtBottomRef.current = true;
        setShowScrollDown(false);
        setScrollEpoch((n) => n + 1);
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, []);

    const handleImageLoad = useCallback(() => {
        if (containerRef.current && isAtBottomRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, []);

    // Track new messages for chip — VirtualMessageList owns scroll position
    useLayoutEffect(() => {
        if (isLoadingOlderGroup) return;

        const lastMessage = sortedGroupMessages[sortedGroupMessages.length - 1];
        const lastId = lastMessage?.optimisticId || lastMessage?._id || null;
        const len = sortedGroupMessages.length;
        const isNewGroup = selectedGroup?._id !== prevSelectedGroupIdRef.current;
        const lastChanged = lastId !== prevLastMsgIdRef.current;
        const prepended = len > prevMsgLenRef.current && !lastChanged;
        const isMyMessage =
            lastMessage?.senderId?._id === authUser?._id ||
            lastMessage?.senderId === authUser?._id;

        if (isNewGroup) {
            isAtBottomRef.current = true;
            prevSelectedGroupIdRef.current = selectedGroup?._id;
            setPendingNewCount(0);
        } else if (prepended) {
            // VirtualMessageList preserves viewport
        } else if (lastChanged) {
            if (isMyMessage) {
                isAtBottomRef.current = true;
                setPendingNewCount(0);
                setScrollEpoch((n) => n + 1);
            } else if (isAtBottomRef.current) {
                setPendingNewCount(0);
            } else {
                setPendingNewCount((c) => c + 1);
            }
        }

        prevLastMsgIdRef.current = lastId;
        prevMsgLenRef.current = len;
    }, [
        sortedGroupMessages.length,
        selectedGroup?._id,
        sortedGroupMessages[sortedGroupMessages.length - 1]?._id,
        sortedGroupMessages[sortedGroupMessages.length - 1]?.optimisticId,
        authUser?._id,
        isLoadingOlderGroup,
    ]);

    const scrollToBottomKey = useMemo(
        () => `${selectedGroup?._id}:${scrollEpoch}`,
        [selectedGroup?._id, scrollEpoch]
    );

    const handleSendMessage = useCallback(async (messageData) => {
        await sendGroupMessage(messageData);
    }, [sendGroupMessage]);

    const groupMembers = selectedGroup?.members || EMPTY_MEMBERS;

    const handleCopyText = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => toast.success("Text copied to clipboard"))
            .catch(() => toast.error("Failed to copy text"));
    };

    const handleDeleteForEveryone = async (messageId) => {
        await deleteGroupMessageForAll(selectedGroup._id, messageId);
    };

    const handleDeleteForMe = async (messageId) => {
        await deleteGroupMessageForMe(selectedGroup._id, messageId);
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
        const isCurrentlyPinned = selectedGroup?.pinnedMessages?.some(
            m => (m._id || m) === messageId
        ) || selectedGroup?.pinnedMessage?._id === messageId;

        if (isCurrentlyPinned) {
            await unpinMessage(selectedGroup._id, messageId);
        } else {
            await pinMessage(selectedGroup._id, messageId);
        }
    };

    const isOwner = selectedGroup?.admin?._id === authUser?._id;
    const currentUserMember = selectedGroup?.members?.find(m => (m.user?._id || m.user || m).toString() === authUser?._id);
    const isAdmin = isOwner || currentUserMember?.role === "admin";

    // Long press / menu open — WhatsApp style (gestures live in SwipeableMessageBubble)
    const openMessageMenu = (messageId, el) => {
        setAnchorEl(el || null);
        setOpenMenuId(messageId);
    };

    const handleSwipeReply = useCallback((message) => {
        const sender = message.senderId;
        setReplyingToMessage({
            ...message,
            senderName:
                sender?._id === authUser._id
                    ? "You"
                    : sender?.fullName || "Member",
        });
    }, [authUser._id, setReplyingToMessage]);

    const menuMessage = openMenuId
        ? groupMessages.find(
            (m) =>
                String(m._id) === String(openMenuId) ||
                String(m.realId) === String(openMenuId) ||
                String(m.optimisticId) === String(openMenuId)
          )
        : null;

    const menuActions = menuMessage
        ? buildGroupChatActions({
            message: menuMessage,
            isAdmin,
            isPinned: selectedGroup?.pinnedMessages?.some(m => (m._id || m) === menuMessage._id) || selectedGroup?.pinnedMessage?._id === menuMessage._id,
            isStarred: isStarred(menuMessage._id),
            onReply: () => handleSwipeReply(menuMessage),
            onStar: () => toggleStar(menuMessage._id, "group", selectedGroup._id, isStarred(menuMessage._id)),
            // Message Info for every accessible message (own or others)
            onInfo: () =>
                setInfoDialogMessageId(
                    menuMessage.realId || menuMessage._id || menuMessage.clientMessageId
                ),
            onPin: () => handlePinMessage(menuMessage._id),
            onCopy: () => handleCopyText(menuMessage.text),
            onForward: () => setForwardDialogMessageId(menuMessage._id),
            onEdit: () => setEditingMessageId(menuMessage._id),
            onDelete: () => setDeleteDialogMessageId(menuMessage._id),
        })
        : [];

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

    const renderGroupMessage = useCallback((message, index) => {
        const msgs = sortedGroupMessages;
        const isMyMessage = message.senderId?._id === authUser._id;
        const sender = message.senderId;
        const showSender = !isMyMessage && (
            index === 0 ||
            msgs[index - 1]?.senderId?._id !== sender?._id
        );
        const isDeleted = isMessageDeleted(message);

        const currentDateKey = getMessageDateKey(message.createdAt);
        const previousDateKey = index > 0 ? getMessageDateKey(msgs[index - 1].createdAt) : null;
        const showDateSeparator = currentDateKey !== previousDateKey;

        const DateSeparator = showDateSeparator ? (
            <div className="flex justify-center my-4">
                <div className="bg-base-300/80 text-base-content/70 px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm backdrop-blur-sm">
                    {formatDateSeparator(message.createdAt)}
                </div>
            </div>
        ) : null;

        const UnreadDivider = index === firstUnreadIndex ? (
            <div className="flex items-center justify-center my-4">
                <div className="flex-grow border-t border-red-500/30"></div>
                <span className="mx-4 text-xs font-semibold uppercase tracking-wider text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                    Unread Messages
                </span>
                <div className="flex-grow border-t border-red-500/30"></div>
            </div>
        ) : null;

        if (message.messageType === "system") {
            return (
                <div className="mb-2.5">
                    {DateSeparator}
                    {UnreadDivider}
                    <div className="flex justify-center my-1.5 px-4 select-none">
                        <div className="bg-base-200/90 dark:bg-base-300/80 text-base-content/75 dark:text-base-content/70 px-3.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium backdrop-blur-sm border border-base-content/5 shadow-xs text-center max-w-[85%] sm:max-w-[75%] inline-block leading-snug">
                            {formatSystemMessageText(message.text, authUser)}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="mb-4">
                {DateSeparator}
                {UnreadDivider}
                <div
                    id={`msg-${message.realId || message._id}`}
                    data-message-id={message.realId || message._id}
                    className={`flex ${isMyMessage ? "justify-end" : "justify-start"} ${searchActiveId === message._id ? "ring-2 ring-amber-400/70 rounded-xl" : ""}`}
                >
                    <div className={`flex gap-2 max-w-[80%] ${isMyMessage ? "flex-row-reverse" : ""}`}>
                        {!isMyMessage && showSender && (
                            <img
                                src={sender?.profilePic || defaultAvatar}
                                alt={sender?.fullName}
                                className="w-8 h-8 rounded-full object-cover self-end"
                                loading="lazy"
                            />
                        )}
                        {!isMyMessage && !showSender && (
                            <div className="w-8" />
                        )}

                        <div className="relative group">
                            {showSender && !isMyMessage && (
                                <p className="text-xs text-base-content/60 mb-1 ml-1">
                                    {sender?.fullName}
                                </p>
                            )}

                            <SwipeableMessageBubble
                                isMine={isMyMessage}
                                disabled={false}
                                onReply={isDeleted ? undefined : () => handleSwipeReply(message)}
                                onLongPress={(el) => openMessageMenu(message._id, el)}
                                className="group"
                            >
                                <div
                                    className={`rounded-2xl p-3 w-fit max-w-full whitespace-pre-wrap break-words ${isMyMessage
                                        ? "bg-primary text-primary-content rounded-br-md"
                                        : "bg-base-200 text-base-content rounded-bl-md"
                                        } ${isDeleted ? "opacity-90" : ""}`}
                                >
                                    {isDeleted ? (
                                        <DeletedMessageBubble
                                            message={message}
                                            authUserId={authUser._id}
                                            isMyMessage={isMyMessage}
                                        />
                                    ) : (
                                    <>
                                    {message.replyToMessage && (
                                        <div
                                            className={`mb-2 p-2 rounded-lg border-l-4 cursor-pointer transition-colors ${
                                                isMyMessage
                                                    ? "bg-black/10 border-primary-content/50 hover:bg-black/20"
                                                    : "bg-black/10 dark:bg-black/20 border-primary hover:bg-black/20 dark:hover:bg-black/30"
                                            }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const vibeId = message.replyToMessage?.vibeId;
                                                const isVibeReply = vibeId || (message.replyToMessage?.text && message.replyToMessage.text.includes("Vibe"));
                                                if (isVibeReply) {
                                                    useGroupVibeStore.getState().openViewer(selectedGroup._id, vibeId || null);
                                                    return;
                                                }
                                                const replyId = message.replyTo;
                                                const idx = sortedGroupMessages.findIndex(m => String(m.realId || m._id) === String(replyId));
                                                if (idx !== -1) {
                                                    setScrollTarget(idx);
                                                    setTimeout(() => {
                                                        const el = document.getElementById(`msg-${replyId}`);
                                                        if (el) {
                                                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                                                            el.classList.add("highlight-message");
                                                            setTimeout(() => el.classList.remove("highlight-message"), 2000);
                                                        }
                                                    }, 500);
                                                } else {
                                                    toast("Original message not loaded", { icon: "🔍" });
                                                }
                                            }}
                                        >
                                            <p className={`text-xs font-bold opacity-80 mb-0.5 ${isMyMessage ? "text-primary-content" : "text-primary"}`}>
                                                {String(message.replyToMessage.senderId) === String(authUser._id) ||
                                                message.replyToMessage.senderId?._id === authUser._id
                                                    ? "You"
                                                    : message.replyToMessage.senderName || "Member"}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {message.replyToMessage.image && !isMessageDeleted(message.replyToMessage) && (
                                                    <img
                                                        src={message.replyToMessage.image}
                                                        alt="Thumbnail"
                                                        className="w-8 h-8 rounded object-cover"
                                                        loading="lazy"
                                                        onLoad={handleImageLoad}
                                                    />
                                                )}
                                                <p className="text-xs opacity-70 truncate max-w-[150px]">
                                                    {message.replyToMessage.text ||
                                                        (message.replyToMessage.image ? "Photo" : "")}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {message.isForwarded && (
                                        <div className={`flex items-center gap-1 text-xs mb-1.5 ${isMyMessage ? "text-primary-content/70" : "text-base-content/50"}`}>
                                            <Forward className="w-3 h-3" />
                                            <span className="italic">Forwarded</span>
                                        </div>
                                    )}
                                    {message.image && (
                                        <img
                                            src={message.image}
                                            alt="Attachment"
                                            loading="lazy"
                                            decoding="async"
                                            className={`rounded-lg mb-2 max-w-xs ${message.image.toLowerCase().includes('.gif') ? '' : 'cursor-pointer hover:opacity-90'} transition-opacity`}
                                            onClick={() => !message.image.toLowerCase().includes('.gif') && setPreviewImage(message.image)}
                                            onLoad={handleImageLoad}
                                        />
                                    )}
                                    {message.video && (
                                        <VideoMessage
                                            video={message.video}
                                            thumbnail={message.videoThumbnail}
                                            duration={message.videoDuration}
                                            isMyMessage={isMyMessage}
                                        />
                                    )}
                                    {message.audio && (
                                        <VoiceMessagePlayer
                                            audioUrl={message.audio}
                                            isMyMessage={isMyMessage}
                                        />
                                    )}
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
                                    {message.text && !message.audio && (
                                        <div className="relative">
                                            {message.isForwarded && (
                                                <div className="forwarded-badge mb-1 text-[11px] opacity-70 flex items-center gap-1"><Forward className="w-3 h-3" /><span>Forwarded</span></div>
                                            )}
                                            <div className="relative px-0.5 pb-0.5">
                                                {editingMessageId === message._id ? (
                                                    <MessageEditField
                                                        initialText={message.text}
                                                        onSave={(newText) => {
                                                            editGroupMessage(selectedGroup._id, message._id, newText);
                                                            setEditingMessageId(null);
                                                        }}
                                                        onCancel={() => setEditingMessageId(null)}
                                                        isMyMessage={isMyMessage}
                                                    />
                                                ) : (
                                                    <>
                                                        <p className="text-[15px] md:text-base whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] leading-[1.3]">
                                                            {searchQuery
                                                                ? highlightText(message.text, searchQuery, searchActiveId === message._id)
                                                                : renderMessageWithMentions(message.text, message.mentions, isMyMessage)}
                                                            <span className={`inline-block h-1 ${message.isEdited ? 'w-[125px] md:w-[130px]' : 'w-[70px] md:w-[75px]'}`}></span>
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className={`flex items-center justify-end gap-1 mt-1 ${
                                            isMyMessage ? "text-primary-content/70" : "text-base-content/50"
                                        }`}
                                    >
                                        {message.isEdited && (
                                            <span className="text-[10px] leading-none opacity-70 italic mr-0.5">
                                                Edited
                                            </span>
                                        )}
                                        <time className="text-[10px] leading-none">
                                            {formatMessageTime(message.createdAt)}
                                        </time>
                                        {isMyMessage && (
                                            <span className="inline-flex items-center status-container">
                                                {message.status === "pending" || message.pending || message.isOptimistic ? (
                                                    <Clock className="w-3.5 h-3.5 opacity-70" />
                                                ) : message.status === "read" ? (
                                                    <CheckCheck className="w-3.5 h-3.5 tick-read message-status-icon text-sky-300" />
                                                ) : message.status === "delivered" ? (
                                                    <CheckCheck className="w-3.5 h-3.5 tick-delivered message-status-icon opacity-80" />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5 tick-sent message-status-icon opacity-80" />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    </>
                                    )}
                                </div>
                                <MessageMenuTrigger
                                    isMine={isMyMessage}
                                    onOpen={(el) => openMessageMenu(message._id, el)}
                                />
                            </SwipeableMessageBubble>
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [
        sortedGroupMessages,
        authUser._id,
        searchActiveId,
        searchQuery,
        handleImageLoad,
        votePoll,
        handleSwipeReply,
    ]);

    if (!selectedGroup) return null;

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden overflow-x-hidden chat-shell chat-shell--mobile-composer">
            <div className="chat-topbar shrink-0">
                {searchOpen ? (
                    <ChatSearchBar
                        open={searchOpen}
                        onOpenChange={setSearchOpen}
                        messages={groupMessages}
                        containerRef={containerRef}
                        onActiveMatchChange={setSearchActiveId}
                        onSearchQueryChange={setSearchQuery}
                    />
                ) : (
                    <GroupChatHeader onSearchOpen={() => setSearchOpen(true)} />
                )}
            </div>

            {/* Messages Area — WhatsApp reverse infinite scroll */}
            <div className="flex-1 min-h-0 relative flex flex-col">
                <VirtualMessageList
                    items={sortedGroupMessages}
                    containerRef={containerRef}
                    onScroll={handleScroll}
                    onReachTop={loadOlderGroupMessages}
                    hasMoreOlder={groupMessagesMeta?.hasMoreOlder}
                    isLoadingOlder={isLoadingOlderGroup}
                    scrollToBottomKey={scrollToBottomKey}
                    onAtBottomChange={handleAtBottomChange}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar messages-container relative z-10"
                    getItemKey={(message) => message.optimisticId || message._id}
                    renderItem={renderGroupMessage}
                    initialScrollIndex={firstUnreadIndex}
                    scrollTargetIndex={scrollTargetIndex}
                    scrollTargetKey={scrollTargetKey}
                    header={
                        groupMessages.length === 0 && isGroupMessagesLoading ? (
                            <MessageSkeleton />
                        ) : groupMessages.length === 0 && !isGroupMessagesLoading ? (
                            <div className="flex flex-col items-center justify-center min-h-[50vh] text-base-content/50">
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="text-4xl">👥</span>
                                </div>
                                <p className="text-lg font-semibold">No messages yet</p>
                                <p className="text-sm">Be the first to send a message!</p>
                            </div>
                        ) : groupMessagesMeta?.hasMoreOlder === false && groupMessages.length > 0 ? (
                            <div className="flex justify-center my-4">
                                <div className="bg-base-300/70 text-base-content/60 px-4 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
                                    Beginning of conversation
                                </div>
                            </div>
                        ) : null
                    }
                    footer={
                        <>
                            {(recordingUsers.length > 0 || typingUsers.length > 0) && (
                                <div className="chat chat-start mb-2 px-2">
                                    <div className="chat-bubble bg-base-200 text-base-content px-4 py-2 flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-base-content/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                        <span className="text-xs opacity-70">
                                            {formatGroupRecordingLabel(recordingUsers) ||
                                                formatGroupTypingLabel(typingUsers)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} style={{ overflowAnchor: "auto", height: 1 }} />
                            <div
                                className="md:hidden"
                                aria-hidden
                                style={{
                                    height: "calc(var(--composer-height, 76px) + env(safe-area-inset-bottom, 0px))",
                                }}
                            />
                        </>
                    }
                />
                {showScrollDown && (
                    <button
                        type="button"
                        onClick={jumpToLatest}
                        className="absolute bottom-16 md:bottom-20 right-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-base-100/70 md:bg-base-100 text-base-content border border-base-content/10 shadow-lg hover:bg-base-200 active:scale-95 transition-all"
                        aria-label="Scroll to bottom"
                    >
                        <ChevronDown className="w-5 h-5" />
                        {pendingNewCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-base-100 animate-pulse">
                                {pendingNewCount}
                            </span>
                        )}
                    </button>
                )}
            </div>

            <GroupMessageInfoDialog
                open={!!infoDialogMessageId}
                messageId={infoDialogMessageId}
                messages={groupMessages}
                members={selectedGroup?.members || EMPTY_MEMBERS}
                authUser={authUser}
                groupId={selectedGroup?._id}
                onRefreshInfo={refreshMessageInfo}
                onClose={() => setInfoDialogMessageId(null)}
            />

            <MessageActionMenu
                open={!!menuMessage}
                onClose={() => setOpenMenuId(null)}
                anchorEl={anchorEl}
                isMine={
                    String(menuMessage?.senderId?._id || menuMessage?.senderId) ===
                    String(authUser._id)
                }
                actions={menuActions}
            />

            {/* Delete Dialog — WhatsApp-style sheet */}
            <DeleteMessageSheet
                open={!!deleteDialogMessageId}
                messageId={deleteDialogMessageId}
                mode="group"
                groupId={selectedGroup?._id}
                onClose={() => setDeleteDialogMessageId(null)}
                onDeleteForEveryone={handleDeleteForEveryone}
                onDeleteForMe={handleDeleteForMe}
            />

            {/* Forward Dialog */}
            {forwardDialogMessageId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            setForwardDialogMessageId(null);
                            setForwardSearchQuery("");
                        }}
                    />
                    <div className="relative bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-base-300 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Forward className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold">Forward Message</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setForwardDialogMessageId(null);
                                    setForwardSearchQuery("");
                                }}
                                className="p-2 rounded-full hover:bg-base-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
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
                        <div className="flex border-b border-base-300">
                            <button
                                onClick={() => setForwardTab("users")}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                    forwardTab === "users"
                                        ? "text-primary border-b-2 border-primary"
                                        : "text-base-content/60 hover:text-base-content"
                                }`}
                            >
                                Contacts
                            </button>
                            <button
                                onClick={() => setForwardTab("groups")}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                    forwardTab === "groups"
                                        ? "text-primary border-b-2 border-primary"
                                        : "text-base-content/60 hover:text-base-content"
                                }`}
                            >
                                Groups
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {forwardTab === "users" ? (
                                filteredUsers.length === 0 ? (
                                    <p className="text-center text-base-content/50 py-8">No contacts found</p>
                                ) : (
                                    filteredUsers.map((user) => (
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
                            ) : filteredGroups.length === 0 ? (
                                <p className="text-center text-base-content/50 py-8">No groups found</p>
                            ) : (
                                filteredGroups.map((group) => (
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
                                            <p className="text-xs text-base-content/50">
                                                {group.members?.length || 0} members
                                            </p>
                                        </div>
                                        <Forward className="w-4 h-4 text-base-content/30" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Message Input */}
            <MessageInput
                onSend={handleSendMessage}
                isGroupChat={true}
                isAdmin={isAdmin}
                announcementOnly={selectedGroup.announcementOnly}
                groupMembers={groupMembers}
            />

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={() => { setPreviewImage(null); setImageZoom(1); }}
                    onWheel={(e) => {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? 0.1 : -0.1;
                        setImageZoom(prev => Math.min(Math.max(prev + delta, 0.5), 3));
                    }}
                >
                    {/* Close Button */}
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                        onClick={() => { setPreviewImage(null); setImageZoom(1); }}
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>

                    {/* Top Center Controls - Zoom */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 z-10">
                        <button
                            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setImageZoom(prev => Math.max(prev - 0.25, 0.5)); }}
                        >
                            <ZoomOut className="w-5 h-5 text-white" />
                        </button>
                        <span className="text-white text-sm font-medium min-w-[50px] text-center">{Math.round(imageZoom * 100)}%</span>
                        <button
                            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setImageZoom(prev => Math.min(prev + 0.25, 3)); }}
                        >
                            <ZoomIn className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Download Button */}
                    <button
                        className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 flex items-center gap-2"
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                const response = await fetch(previewImage);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `image_${Date.now()}.jpg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                            } catch (error) {
                                toast.error("Failed to download");
                            }
                        }}
                    >
                        <Download className="w-5 h-5 text-white" />
                        <span className="text-white text-sm hidden md:inline">Download</span>
                    </button>

                    {/* Image Container */}
                    <div
                        className="flex items-center justify-center animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="rounded-lg shadow-2xl transition-transform duration-200 ease-out"
                            style={{
                                transform: `scale(${imageZoom})`,
                                maxWidth: '90vw',
                                maxHeight: '90vh',
                                objectFit: 'contain',
                                cursor: imageZoom > 1 ? 'zoom-out' : 'zoom-in'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupChatContainer;
