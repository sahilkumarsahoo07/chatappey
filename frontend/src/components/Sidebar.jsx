import { useEffect, useState, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Search, MessageCircle, Edit, X, Check, CheckCheck } from "lucide-react";
import defaultImg from '../public/avatar.png'

const Sidebar = () => {
    const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading, refreshUsers } = useChatStore();
    const { onlineUsers = [], authUser } = useAuthStore();
    const { theme } = useThemeStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    useEffect(() => {
        getUsers();
    }, [getUsers]);

    // Listen for new messages from ANY user to update the chat list
    useEffect(() => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        const handleNewMessage = (newMessage) => {
            // Refresh user list silently to update last message and reorder
            refreshUsers();
        };

        const handleNewUserSignup = (newUser) => {
            // Refresh user list when a new user signs up
            console.log("New user signed up:", newUser);
            refreshUsers();
        };

        const handleUserListUpdate = (data) => {
            // Refresh user list when any user connects
            console.log("User list updated, user connected:", data.userId);
            refreshUsers();
        };

        socket.on("newMessage", handleNewMessage);
        socket.on("newUserSignup", handleNewUserSignup);
        socket.on("userListUpdate", handleUserListUpdate);

        return () => {
            socket.off("newMessage", handleNewMessage);
            socket.off("newUserSignup", handleNewUserSignup);
            socket.off("userListUpdate", handleUserListUpdate);
        };
    }, [refreshUsers]);

    // Format timestamp like WhatsApp (e.g., "10:30 AM" or "Yesterday")
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "";

        const messageDate = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Check if today
        if (messageDate.toDateString() === today.toDateString()) {
            return messageDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }

        // Check if yesterday
        if (messageDate.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        // Check if within last week
        const daysAgo = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
        if (daysAgo < 7) {
            return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
        }

        // Older messages
        return messageDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    // Get last message display text from user object (comes from backend)
    const getLastMessage = (user) => {
        if (!user.lastMessage) return { text: "Tap to chat", status: null, isMine: false };

        const lastMsg = user.lastMessage;
        const isMine = lastMsg.senderId === authUser._id;

        // Handle deleted messages
        if (lastMsg.text === "This message was deleted") {
            return { text: "This message was deleted", status: null, isMine };
        }

        // Show image indicator or text
        if (lastMsg.image && !lastMsg.text) {
            return { text: "📷 Photo", status: isMine ? lastMsg.status : null, isMine };
        }

        // Show "You: " prefix if the message was sent by the current user
        const prefix = isMine ? "You: " : "";
        return {
            text: prefix + (lastMsg.text || "Tap to chat"),
            status: isMine ? lastMsg.status : null,
            isMine
        };
    };

    // Get unread count from user object (comes from backend)
    const getUnreadCount = (user) => {
        return user.unreadCount || 0;
    };

    // Check if user is new (created within 24 hours and NO chat history at all)
    const isNewUser = (user) => {
        if (!user.createdAt) return false;

        const accountAge = Date.now() - new Date(user.createdAt).getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000;

        // User is new if:
        // 1. Account is less than 24 hours old
        // 2. No chat history exists at all (no lastMessage)
        const isAccountNew = accountAge < oneDayInMs;
        const hasNoChatHistory = !user.lastMessage;

        return isAccountNew && hasNoChatHistory;
    };

    // Sort users by most recent message timestamp
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => {
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
        });
    }, [users]);

    // Filter to only show friends and apply search query
    const filteredUsers = sortedUsers
        .filter((user) => user.isFriend) // Only show friends
        .filter((user) => user.fullName.toLowerCase().includes(searchQuery.toLowerCase()));

    // Handle starting a new chat
    const handleStartChat = (user) => {
        setSelectedUser(user);
        setShowNewChatModal(false);
        setSearchQuery("");
    };

    // Only show skeleton on initial load when we have no users yet
    if (isUsersLoading && users.length === 0) return <SidebarSkeleton />;

    return (
        <>
            <aside className="h-full w-full md:w-20 lg:w-80 border-r border-base-300 flex flex-col bg-base-100">
                {/* Header */}
                <div className="p-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-xl font-bold text-base-content md:hidden lg:block">ChatAppey</h1>
                        <button
                            className="p-1.5 rounded-lg hover:bg-base-200 transition-colors md:hidden lg:block"
                            onClick={() => setShowNewChatModal(true)}
                            title="New Chat"
                        >
                            <Edit className="size-5 text-primary" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="md:hidden lg:block">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-base-content/40" />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-base-200 rounded-lg border-none focus:outline-none focus:ring-0 text-sm placeholder:text-base-content/40"
                            />
                        </div>
                    </div>
                </div>

                {/* User List */}
                <div className="overflow-y-auto w-full flex-1 custom-scrollbar">
                    {filteredUsers.map((user) => {
                        const lastMessageData = getLastMessage(user);
                        const timestamp = user.lastMessage ? formatTimestamp(user.lastMessage.createdAt) : "";
                        const unreadCount = getUnreadCount(user);
                        const isOnline = onlineUsers.includes(user._id);

                        // Highlight if there are unread messages AND user is not currently selected
                        const hasUnreadMessages = unreadCount > 0 && selectedUser?._id !== user._id;

                        return (
                            <button
                                key={user._id}
                                onClick={() => setSelectedUser(user)}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200/50 transition-all ${selectedUser?._id === user._id
                                    ? "bg-base-200"
                                    : hasUnreadMessages
                                        ? "bg-primary/5"
                                        : ""
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0 md:mx-auto lg:mx-0">
                                    <img
                                        src={user.hasBlockedMe ? defaultImg : (user.profilePic || defaultImg)}
                                        alt={user.fullName}
                                        className="size-12 object-cover rounded-full"
                                    />
                                    {isOnline && !user.hasBlockedMe && (
                                        <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100" />
                                    )}
                                </div>

                                {/* User Info */}
                                <div className="md:hidden lg:flex flex-1 min-w-0">
                                    <div className="w-full flex flex-col">
                                        {/* Name and Timestamp Row */}
                                        <div className="w-full flex items-baseline justify-between mb-1">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className={`text-[15px] truncate ${hasUnreadMessages ? "font-bold" : "font-semibold"
                                                    } ${theme === 'light' ? 'text-gray-900' : 'text-base-content'}`}>
                                                    {user.fullName}
                                                </span>
                                                {/* NEW Badge for newly created accounts */}
                                                {isNewUser(user) && (
                                                    <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-primary to-secondary text-white uppercase tracking-wide">
                                                        NEW
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-xs flex-shrink-0 ${hasUnreadMessages ? "text-primary font-semibold" : "text-base-content/50"
                                                }`}>
                                                {timestamp}
                                            </span>
                                        </div>
                                        {/* Last Message Row */}
                                        <div className="w-full flex items-center justify-between">
                                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                                <p className={`text-[13px] truncate flex-1 text-left ${hasUnreadMessages
                                                    ? `font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-base-content'}`
                                                    : `${theme === 'light' ? 'text-gray-600' : 'text-base-content opacity-70'}`
                                                    }`}>
                                                    {lastMessageData.text}
                                                </p>
                                                {/* Status indicator for messages sent by me */}
                                                {lastMessageData.isMine && lastMessageData.status && (
                                                    <span className="flex-shrink-0">
                                                        {lastMessageData.status === "read" ? (
                                                            <CheckCheck className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />
                                                        ) : lastMessageData.status === "delivered" ? (
                                                            <CheckCheck className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            {unreadCount > 0 && (
                                                <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-primary text-primary-content rounded-full text-xs flex items-center justify-center font-semibold">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    {filteredUsers.length === 0 && (
                        <div className="text-center text-base-content/40 py-8 px-4">
                            <MessageCircle className="size-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-semibold mb-1">No chats yet</p>
                            <p className="text-xs">Add friends to start chatting</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-base-300 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-base-content">New Chat</h2>
                            <button
                                onClick={() => setShowNewChatModal(false)}
                                className="p-2 rounded-lg hover:bg-base-200 transition-colors"
                            >
                                <X className="size-5 text-base-content/60" />
                            </button>
                        </div>

                        {/* Search in Modal */}
                        <div className="p-4 border-b border-base-300">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-base-content/40" />
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-base-200 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* User List in Modal */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredUsers.map((user) => {
                                const isOnline = onlineUsers.includes(user._id);

                                return (
                                    <button
                                        key={user._id}
                                        onClick={() => handleStartChat(user)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200/50 transition-all"
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <img
                                                src={user.hasBlockedMe ? defaultImg : (user.profilePic || defaultImg)}
                                                alt={user.fullName}
                                                className="size-12 object-cover rounded-full"
                                            />
                                            {isOnline && !user.hasBlockedMe && (
                                                <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100" />
                                            )}
                                        </div>

                                        {/* User Info */}
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold text-[15px] text-base-content truncate">
                                                    {user.fullName}
                                                </div>
                                                {/* NEW Badge for newly created accounts */}
                                                {isNewUser(user) && (
                                                    <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-primary to-secondary text-white uppercase tracking-wide">
                                                        NEW
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-base-content/60">
                                                {user.hasBlockedMe ? "Unavailable" : (isOnline ? "Online" : "Offline")}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {filteredUsers.length === 0 && (
                                <div className="text-center text-base-content/40 py-12 px-4">
                                    <MessageCircle className="size-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-semibold mb-1">No friends yet</p>
                                    <p className="text-xs">Go to Contacts to add friends</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;