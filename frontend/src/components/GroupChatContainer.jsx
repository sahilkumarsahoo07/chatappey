import { useEffect, useRef, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import GroupChatHeader from "./GroupChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime } from "../lib/utils";
import defaultAvatar from "../public/avatar.png";
import { MoreVertical, Copy, Trash2, Forward, Search, Users, X } from "lucide-react";
import { Menu, MenuItem } from "@mui/material";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

const GroupChatContainer = () => {
    const {
        selectedGroup,
        groupMessages,
        isGroupMessagesLoading,
        getGroupMessages,
        sendGroupMessage,
        deleteGroupMessageForAll,
        deleteGroupMessageForMe,
        groups
    } = useGroupStore();
    const { users } = useChatStore();
    const { authUser } = useAuthStore();
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
    const longPressTimerRef = useRef(null);
    const longPressMessageRef = useRef(null);

    // Fetch messages when group is selected
    useEffect(() => {
        if (selectedGroup?._id) {
            getGroupMessages(selectedGroup._id);
        }
    }, [selectedGroup?._id, getGroupMessages]);

    // Auto scroll to bottom
    useEffect(() => {
        if (isAtBottom && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [groupMessages, isAtBottom]);

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

                                return (
                                    <div
                                        key={message._id}
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
                                                    {message.text && (
                                                        <p className="whitespace-pre-wrap break-words">
                                                            {message.text}
                                                        </p>
                                                    )}
                                                    <p
                                                        className={`text-xs mt-1 ${isMyMessage
                                                            ? "text-primary-content/70"
                                                            : "text-base-content/50"
                                                            }`}
                                                    >
                                                        {formatMessageTime(message.createdAt)}
                                                    </p>
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
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Message Input */}
            <MessageInput onSend={handleSendMessage} isGroupChat={true} />
        </div>
    );
};

export default GroupChatContainer;
