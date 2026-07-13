import { useEffect, useState, useMemo, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { useGroupStore } from "../store/useGroupStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import CreateGroupModal from "./CreateGroupModal";
import { Search, MessageCircle, Edit, X, Check, CheckCheck, Users, Plus, CircleDashed } from "lucide-react";
import defaultImg from '../public/avatar.png'
import SidebarChatRow from "./SidebarChatRow";
import StatusRingList from "./status/StatusRingList";
import { useStatusStore } from "../store/useStatusStore";
import { useChatFeaturesStore } from "../store/useChatFeaturesStore";
import { Archive, BellOff } from "lucide-react";

const Sidebar = () => {
    const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading, refreshUsers, deleteChatForMe } = useChatStore();
    const { onlineUsers = [], authUser } = useAuthStore();
    const { theme } = useThemeStore();
    const { groups, selectedGroup, setSelectedGroup, getGroups } = useGroupStore();
    const openCreateStatus = useStatusStore((s) => s.openCreate);
    const openStatusViewer = useStatusStore((s) => s.openViewer);
    const statusFeed = useStatusStore((s) => s.feed);
    const myStatusGroup = useStatusStore((s) => s.myStatus);
    const { archivedDms, archivedGroups, loadArchived, setArchive, isArchivedLoading } = useChatFeaturesStore();
    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [friendSearchQuery, setFriendSearchQuery] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [activeTab, setActiveTab] = useState("chats"); // "chats" or "groups"
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = useRef(null);
    const refreshUsersTimeoutRef = useRef(null); // Debounce refresh

    const openSearch = () => {
        setIsSearchOpen(true);
    };

    const closeSearch = () => {
        setIsSearchOpen(false);
        setSearchQuery("");
    };

    useEffect(() => {
        if (!isSearchOpen) return;
        const id = requestAnimationFrame(() => searchInputRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [isSearchOpen]);

    useEffect(() => {
        getUsers();
        getGroups();
        loadArchived();
    }, [getUsers, getGroups, loadArchived]);

    // Sync sidebar tab when notification/store opens a chat or group
    useEffect(() => {
        if (selectedUser) setActiveTab("chats");
        else if (selectedGroup) setActiveTab("groups");
    }, [selectedUser?._id, selectedGroup?._id]);

    // Listen for new messages from ANY user to update the chat list
    useEffect(() => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        // Debounced refresh to prevent excessive API calls
        const debouncedRefresh = () => {
            if (refreshUsersTimeoutRef.current) {
                clearTimeout(refreshUsersTimeoutRef.current);
            }
            refreshUsersTimeoutRef.current = setTimeout(() => {
                refreshUsers();
            }, 500); // Wait 500ms before refreshing
        };

        const handlePrivacyUpdate = (data) => {
            console.log("Privacy settings updated for user:", data.userId);
            debouncedRefresh();
        };

        socket.on("privacy-settings-updated", handlePrivacyUpdate);

        return () => {
            if (refreshUsersTimeoutRef.current) {
                clearTimeout(refreshUsersTimeoutRef.current);
            }
            socket.off("privacy-settings-updated", handlePrivacyUpdate);
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
        const isMine =
            String(lastMsg.senderId?._id || lastMsg.senderId) === String(authUser._id);

        // Handle deleted messages
        if (lastMsg.text === "This message was deleted" || lastMsg.deletedForEveryone || lastMsg.deleted) {
            return { text: "This message was deleted", status: null, isMine };
        }

        // Show image indicator or text
        if (lastMsg.image && !lastMsg.text) {
            return { text: "📷 Photo", status: isMine ? lastMsg.status : null, isMine };
        }
        if (lastMsg.video && !lastMsg.text) {
            return { text: "🎬 Video", status: isMine ? lastMsg.status : null, isMine };
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

    // Calculate total unread counts for badges on tabs
    const totalChatUnread = useMemo(() => {
        return users.reduce((acc, user) => {
            if (user.chatDeletedForMe || !user.lastMessage) return acc;
            return acc + (user.unreadCount || 0);
        }, 0);
    }, [users]);

    const totalGroupUnread = useMemo(() => {
        return groups.reduce((acc, group) => acc + (group.unreadCount || 0), 0);
    }, [groups]);

    // Empty search = active chats only. Typing = search ALL friends (incl. deleted / never messaged).
    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const friends = sortedUsers.filter((user) => user.isFriend);

        if (!q) {
            return friends.filter((user) => !user.chatDeletedForMe && !!user.lastMessage && !user.isArchived);
        }

        return friends.filter(
            (user) =>
                user.fullName?.toLowerCase().includes(q) ||
                user.email?.toLowerCase().includes(q)
        );
    }, [sortedUsers, searchQuery]);

    const isFriendSearchActive = searchQuery.trim().length > 0;

    // Friends for New Chat modal (friends only)
    const searchableFriends = useMemo(() => {
        const q = friendSearchQuery.trim().toLowerCase();
        return sortedUsers
            .filter((user) => user.isFriend)
            .filter((user) => {
                if (!q) return true;
                return (
                    user.fullName?.toLowerCase().includes(q) ||
                    user.email?.toLowerCase().includes(q)
                );
            });
    }, [sortedUsers, friendSearchQuery]);

    // Open chat with a friend (restores deleted chats into the list after you message)
    const handleStartChat = (user) => {
        setSelectedGroup(null);
        if (user.chatDeletedForMe) {
            useChatStore.setState({
                users: useChatStore.getState().users.map((u) =>
                    u._id === user._id ? { ...u, chatDeletedForMe: false } : u
                ),
            });
        }
        setSelectedUser({ ...user, chatDeletedForMe: false });
        setShowNewChatModal(false);
        setFriendSearchQuery("");
        setSearchQuery("");
        setIsSearchOpen(false);
    };

    // Handle selecting a group
    const handleSelectGroup = (group) => {
        setSelectedUser(null); // Clear user selection
        setSelectedGroup(group);
    };

    // Filter groups by search query
    const filteredGroups = groups.filter(group => {
        const matches = group.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchQuery.trim()) return matches && !group.isArchived;
        return matches;
    });

    // Only show skeleton on initial load when we have no users yet
    if (isUsersLoading && users.length === 0) return <SidebarSkeleton />;

    return (
        <>
            <aside className="h-full w-full md:w-20 lg:w-80 border-r border-base-300 flex flex-col bg-base-100">
                {/* Header */}
                <div className="px-4 pt-[calc(0.85rem+env(safe-area-inset-top,0px))] pb-3 md:px-2 lg:px-4 md:pt-4">
                    {/* Header row — title + two action icons only */}
                    <div className="flex items-center justify-between gap-2 mb-3 md:mb-0 lg:mb-3">
                        <h1 className="text-[1.35rem] font-bold tracking-tight text-base-content md:hidden lg:block">
                            Chats
                        </h1>
                        <div className="flex items-center gap-0.5 flex-shrink-0 md:hidden lg:flex">
                            <button
                                type="button"
                                className={`p-2.5 rounded-xl transition-colors touch-target ${
                                    isSearchOpen
                                        ? "bg-primary/12 text-primary"
                                        : "hover:bg-base-200 text-base-content/70"
                                }`}
                                onClick={() => (isSearchOpen ? closeSearch() : openSearch())}
                                title={isSearchOpen ? "Close search" : "Search friends"}
                                aria-label={isSearchOpen ? "Close search" : "Search friends"}
                                aria-expanded={isSearchOpen}
                            >
                                {isSearchOpen ? (
                                    <X className="size-5" />
                                ) : (
                                    <Search className="size-5" />
                                )}
                            </button>
                            <button
                                type="button"
                                className="p-2.5 rounded-xl hover:bg-base-200 transition-colors touch-target"
                                onClick={() => setShowNewChatModal(true)}
                                title="New chat"
                                aria-label="New chat"
                            >
                                <Edit className="size-5 text-primary" />
                            </button>
                        </div>
                    </div>

                    {/* Search input — only when search icon is tapped */}
                    {isSearchOpen && (
                        <div className="md:hidden lg:block mb-3 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40 pointer-events-none z-[1]" aria-hidden />
                            <input
                                ref={searchInputRef}
                                type="search"
                                placeholder="Search friends"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") closeSearch();
                                }}
                                className="w-full h-11 pl-10 pr-10 rounded-xl bg-base-200 text-[15px] text-base-content placeholder:text-base-content/40 outline-none border border-primary/35 focus:border-primary focus:ring-2 focus:ring-primary/15"
                                aria-label="Search friends"
                                autoComplete="off"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-base-300 text-base-content/45"
                                    aria-label="Clear search"
                                >
                                    <X className="size-3.5" />
                                </button>
                            ) : null}
                        </div>
                    )}

                    {/* Tablet (md): icon-only rail — search opens friends modal */}
                    <div className="hidden md:flex lg:hidden flex-col items-center gap-2 mb-2">
                        <button
                            type="button"
                            onClick={() => setShowNewChatModal(true)}
                            className="p-2.5 rounded-xl bg-base-200 hover:bg-primary/15 text-base-content/70 hover:text-primary transition-colors"
                            title="Search friends"
                            aria-label="Search friends"
                        >
                            <Search className="size-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab(activeTab === "chats" ? "groups" : "chats")}
                            className={`p-2.5 rounded-xl transition-colors ${
                                activeTab === "groups"
                                    ? "bg-primary text-primary-content"
                                    : "bg-base-200 text-base-content/70 hover:bg-primary/15 hover:text-primary"
                            }`}
                            title={activeTab === "chats" ? "Show groups" : "Show chats"}
                            aria-label={activeTab === "chats" ? "Show groups" : "Show chats"}
                        >
                            {activeTab === "chats" ? (
                                <Users className="size-5" />
                            ) : (
                                <MessageCircle className="size-5" />
                            )}
                        </button>
                        {activeTab === "groups" && (
                            <button
                                type="button"
                                onClick={() => setShowCreateGroupModal(true)}
                                className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                title="Create group"
                                aria-label="Create group"
                            >
                                <Plus className="size-5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (myStatusGroup?.statuses?.length || statusFeed?.length) {
                                    openStatusViewer(statusFeed.length ? statusFeed : [myStatusGroup].filter(Boolean), 0, 0);
                                } else {
                                    openCreateStatus();
                                }
                            }}
                            className="p-2.5 rounded-xl bg-base-200 text-base-content/70 hover:bg-emerald-500/15 hover:text-emerald-600 transition-colors"
                            title="Status"
                            aria-label="Status"
                        >
                            <CircleDashed className="size-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-3 md:hidden lg:flex">
                        <button
                            onClick={() => setActiveTab("chats")}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all relative ${activeTab === "chats"
                                ? "bg-primary text-primary-content"
                                : "hover:bg-base-200"
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <MessageCircle className="w-4 h-4" />
                                Chats
                                {totalChatUnread > 0 && (
                                    <span className={`flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center font-bold transition-all ${activeTab === 'chats'
                                        ? 'bg-white text-primary'
                                        : 'bg-primary text-primary-content'
                                        }`}>
                                        {totalChatUnread > 99 ? "99+" : totalChatUnread}
                                    </span>
                                )}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab("groups")}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all relative ${activeTab === "groups"
                                ? "bg-primary text-primary-content"
                                : "hover:bg-base-200"
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Users className="w-4 h-4" />
                                Groups
                                {totalGroupUnread > 0 && (
                                    <span className={`flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center font-bold transition-all ${activeTab === 'groups'
                                        ? 'bg-white text-primary'
                                        : 'bg-primary text-primary-content'
                                        }`}>
                                        {totalGroupUnread > 99 ? "99+" : totalGroupUnread}
                                    </span>
                                )}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Create Group Button (when on groups tab) */}
                {activeTab === "groups" && (
                    <button
                        onClick={() => setShowCreateGroupModal(true)}
                        className="mx-4 mb-2 py-2.5 px-4 bg-primary/10 hover:bg-primary/20 rounded-lg flex items-center gap-2 text-primary transition-colors md:hidden lg:flex"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Create New Group</span>
                    </button>
                )}

                {/* User List (Chats Tab) — Status scrolls with the list (not pinned) */}
                {activeTab === "chats" && (
                    <div className="overflow-y-auto w-full flex-1 custom-scrollbar">
                        {(archivedDms.length > 0 || archivedGroups.length > 0) && !isFriendSearchActive && (
                            <button
                                type="button"
                                onClick={() => setShowArchived((v) => !v)}
                                className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-base-content/70 hover:bg-base-200/60 border-b border-base-200/50"
                            >
                                <Archive className="w-4 h-4" />
                                Archived
                                <span className="ml-auto text-xs opacity-60">
                                    {archivedDms.length + archivedGroups.length}
                                </span>
                            </button>
                        )}

                        {showArchived && !isFriendSearchActive && (
                            <div className="border-b border-base-200/50 bg-base-200/30">
                                {isArchivedLoading ? (
                                    <p className="text-center text-xs py-4 opacity-50">Loading…</p>
                                ) : (
                                    <>
                                        {archivedDms.map((user) => (
                                            <button
                                                key={`arch-dm-${user._id}`}
                                                type="button"
                                                onClick={() => handleStartChat(user)}
                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200/50 text-left"
                                            >
                                                <img src={user.profilePic || defaultImg} alt="" className="size-10 rounded-full object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{user.fullName}</p>
                                                    <p className="text-xs opacity-60">Direct chat</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setArchive("dm", user._id, false);
                                                    }}
                                                    className="text-xs text-primary font-medium px-2 py-1"
                                                >
                                                    Unarchive
                                                </button>
                                            </button>
                                        ))}
                                        {archivedGroups.map((group) => (
                                            <button
                                                key={`arch-grp-${group._id}`}
                                                type="button"
                                                onClick={() => handleSelectGroup(group)}
                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200/50 text-left"
                                            >
                                                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <Users className="w-5 h-5 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{group.name}</p>
                                                    <p className="text-xs opacity-60">Group</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setArchive("group", group._id, false);
                                                    }}
                                                    className="text-xs text-primary font-medium px-2 py-1"
                                                >
                                                    Unarchive
                                                </button>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        <StatusRingList />

                        {filteredUsers.map((user) => {
                            const hasActiveChat = !!user.lastMessage && !user.chatDeletedForMe;
                            const lastMessageData = getLastMessage(user);
                            const timestamp = hasActiveChat && user.lastMessage
                                ? formatTimestamp(user.lastMessage.createdAt)
                                : "";
                            const unreadCount = hasActiveChat ? getUnreadCount(user) : 0;
                            const isOnline = onlineUsers.includes(user._id);
                            const hasUnreadMessages = unreadCount > 0 && selectedUser?._id !== user._id;
                            const previewText = hasActiveChat
                                ? lastMessageData.text
                                : user.chatDeletedForMe
                                    ? "Tap to start chat"
                                    : "Tap to chat";

                            return (
                                <SidebarChatRow
                                    key={user._id}
                                    isSelected={selectedUser?._id === user._id}
                                    hasUnread={hasUnreadMessages}
                                    showDelete={hasActiveChat}
                                    onOpen={() => handleStartChat(user)}
                                    onDelete={() => deleteChatForMe(user._id)}
                                >
                                    {/* Avatar + unread badge (visible on all breakpoints, especially md icon rail) */}
                                    <div className="relative flex-shrink-0 md:mx-auto lg:mx-0">
                                        <img
                                            src={user.hasBlockedMe ? defaultImg : (user.profilePic || defaultImg)}
                                            alt={user.fullName}
                                            className="size-11 sm:size-12 object-cover rounded-full"
                                        />
                                        {isOnline && !user.hasBlockedMe && (
                                            <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100 z-[1]" />
                                        )}
                                        {hasUnreadMessages && (
                                            <span
                                                className="absolute -top-0.5 -right-0.5 z-[2] min-w-[18px] h-[18px] px-1
                                                  bg-primary text-primary-content rounded-full
                                                  text-[10px] font-bold items-center justify-center
                                                  ring-2 ring-base-100 shadow-sm
                                                  hidden md:flex lg:hidden"
                                                aria-label={`${unreadCount} unread`}
                                            >
                                                {unreadCount > 99 ? "99+" : unreadCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div className="md:hidden lg:flex flex-1 min-w-0">
                                        <div className="w-full flex flex-col">
                                            {/* Name and Timestamp Row */}
                                            <div className="w-full flex items-baseline justify-between mb-1 gap-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className={`text-[14px] sm:text-[15px] truncate ${hasUnreadMessages ? "font-bold" : "font-semibold"
                                                        } ${theme === 'light' ? 'text-gray-900' : 'text-base-content'}`}>
                                                        {user.fullName}
                                                    </span>
                                                    {user.isMuted && (
                                                        <BellOff className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
                                                    )}
                                                    {isNewUser(user) && (
                                                        <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-primary to-secondary text-white uppercase tracking-wide">
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[11px] sm:text-xs flex-shrink-0 ${hasUnreadMessages ? "text-primary font-semibold" : "text-base-content/50"
                                                    }`}>
                                                    {timestamp}
                                                </span>
                                            </div>
                                            {/* Last Message Row */}
                                            <div className="w-full flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    <p className={`text-[12px] sm:text-[13px] truncate flex-1 text-left ${hasUnreadMessages
                                                        ? `font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-base-content'}`
                                                        : `${theme === 'light' ? 'text-gray-600' : 'text-base-content opacity-70'}`
                                                        }`}>
                                                        {previewText}
                                                    </p>
                                                    {hasActiveChat && lastMessageData.isMine && lastMessageData.status && (
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
                                                {hasUnreadMessages && (
                                                    <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-primary text-primary-content rounded-full text-xs flex items-center justify-center font-semibold">
                                                        {unreadCount > 99 ? "99+" : unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </SidebarChatRow>
                            );
                        })}

                        {filteredUsers.length === 0 && (
                            <div className="text-center text-base-content/40 py-8 px-4">
                                <MessageCircle className="size-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-semibold mb-1">
                                    {isFriendSearchActive ? "No friends found" : "No chats yet"}
                                </p>
                                <p className="text-xs">
                                    {isFriendSearchActive
                                        ? "Only your friends appear here — try another name"
                                        : "Add friends, then search their name above"}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Groups List (Groups Tab) */}
                {activeTab === "groups" && (
                    <div className="overflow-y-auto w-full flex-1 custom-scrollbar">
                        {filteredGroups.map((group) => {
                            const lastMsg = group.lastMessage;
                            const timestamp = lastMsg ? formatTimestamp(lastMsg.createdAt) : "";
                            const unreadCount = group.unreadCount || 0;

                            // Highlight if there are unread messages AND group is not currently selected
                            const hasUnreadMessages = unreadCount > 0 && selectedGroup?._id !== group._id;

                            return (
                                <button
                                    key={group._id}
                                    onClick={() => handleSelectGroup(group)}
                                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200/50 transition-all ${selectedGroup?._id === group._id
                                        ? "bg-base-200"
                                        : hasUnreadMessages
                                            ? "bg-primary/5"
                                            : ""
                                        }`}
                                >
                                    {/* Group Avatar */}
                                    <div className="relative flex-shrink-0 md:mx-auto lg:mx-0">
                                        <div className="size-11 sm:size-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                                            {group.image ? (
                                                <img
                                                    src={group.image}
                                                    alt={group.name}
                                                    className="size-11 sm:size-12 object-cover"
                                                />
                                            ) : (
                                                <Users className="size-6 text-primary" />
                                            )}
                                        </div>
                                        {hasUnreadMessages && (
                                            <span
                                                className="absolute -top-0.5 -right-0.5 z-[2] min-w-[18px] h-[18px] px-1
                                                  bg-primary text-primary-content rounded-full
                                                  text-[10px] font-bold items-center justify-center
                                                  ring-2 ring-base-100 shadow-sm
                                                  hidden md:flex lg:hidden"
                                                aria-label={`${unreadCount} unread`}
                                            >
                                                {unreadCount > 99 ? "99+" : unreadCount}
                                            </span>
                                        )}
                                    </div>

                                    {/* Group Info */}
                                    <div className="md:hidden lg:flex flex-1 min-w-0">
                                        <div className="w-full flex flex-col">
                                            {/* Name and Timestamp Row */}
                                            <div className="w-full flex items-baseline justify-between mb-1">
                                                <span className={`text-[15px] truncate ${hasUnreadMessages ? "font-bold" : "font-semibold"} ${theme === 'light' ? 'text-gray-900' : 'text-base-content'
                                                    }`}>
                                                    {group.name}
                                                </span>
                                                <span className={`text-xs flex-shrink-0 ${hasUnreadMessages ? "text-primary font-semibold" : "text-base-content/50"
                                                    }`}>
                                                    {timestamp}
                                                </span>
                                            </div>
                                            {/* Last Message Row */}
                                            <div className="w-full flex items-center justify-between">
                                                <p className={`text-[13px] truncate flex-1 text-left ${hasUnreadMessages
                                                    ? `font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-base-content'}`
                                                    : `${theme === 'light' ? 'text-gray-600' : 'text-base-content opacity-70'}`
                                                    }`}>
                                                    {lastMsg ? (
                                                        <>
                                                            <span className="font-medium">
                                                                {(() => {
                                                                    const senderId = String(
                                                                        lastMsg.senderId?._id ||
                                                                            lastMsg.senderId ||
                                                                            ""
                                                                    );
                                                                    const isMine =
                                                                        senderId &&
                                                                        String(authUser?._id) === senderId;
                                                                    if (isMine) return "You";
                                                                    const fromField = lastMsg.senderName?.trim();
                                                                    if (fromField) {
                                                                        return fromField.split(" ")[0];
                                                                    }
                                                                    const member = (group.members || []).find(
                                                                        (m) =>
                                                                            String(m.user?._id || m.user || m) ===
                                                                            senderId
                                                                    );
                                                                    const name =
                                                                        member?.user?.fullName ||
                                                                        member?.fullName ||
                                                                        "";
                                                                    return name
                                                                        ? name.split(" ")[0]
                                                                        : "Member";
                                                                })()}
                                                                :{" "}
                                                            </span>
                                                            {lastMsg.text || "📷 Photo"}
                                                        </>
                                                    ) : (
                                                        `${group.members?.length || 0} members`
                                                    )}
                                                </p>
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

                        {filteredGroups.length === 0 && (
                            <div className="text-center text-base-content/40 py-8 px-4">
                                <Users className="size-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-semibold mb-1">No groups yet</p>
                                <p className="text-xs">Create a group to start chatting</p>
                            </div>
                        )}
                    </div>
                )}
            </aside>

            {/* New Chat / Search friends (friends only — includes deleted chats) */}
            {showNewChatModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-base-100 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[80vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
                        <div className="flex justify-center pt-3 sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-base-300" />
                        </div>
                        <div className="p-4 border-b border-base-300 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-base-content">Search friends</h2>
                                <p className="text-xs text-base-content/50 mt-0.5">Friends only — start or reopen a chat</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowNewChatModal(false);
                                    setFriendSearchQuery("");
                                }}
                                className="p-2 rounded-lg hover:bg-base-200 transition-colors"
                            >
                                <X className="size-5 text-base-content/60" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-base-300">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-base-content/40" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={friendSearchQuery}
                                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-base-200 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {searchableFriends.map((user) => {
                                const isOnline = onlineUsers.includes(user._id);
                                const wasDeleted = !!user.chatDeletedForMe || !user.lastMessage;

                                return (
                                    <button
                                        key={user._id}
                                        onClick={() => handleStartChat(user)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200/50 transition-all"
                                    >
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

                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold text-[15px] text-base-content truncate">
                                                    {user.fullName}
                                                </div>
                                                {isNewUser(user) && (
                                                    <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-primary to-secondary text-white uppercase tracking-wide">
                                                        NEW
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-base-content/60 truncate">
                                                {user.hasBlockedMe
                                                    ? "Unavailable"
                                                    : wasDeleted
                                                        ? "Tap to start chat"
                                                        : isOnline
                                                            ? "Online"
                                                            : "Offline"}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {searchableFriends.length === 0 && (
                                <div className="text-center text-base-content/40 py-12 px-4">
                                    <MessageCircle className="size-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-semibold mb-1">
                                        {friendSearchQuery.trim() ? "No friends found" : "No friends yet"}
                                    </p>
                                    <p className="text-xs">
                                        {friendSearchQuery.trim()
                                            ? "Try another name — only your friends are listed"
                                            : "Go to Contacts to add friends"}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={showCreateGroupModal}
                onClose={() => setShowCreateGroupModal(false)}
            />
        </>
    );
};

export default Sidebar;