import { Users, Mail, UserPlus, Clock, Bell, Search, X, Send } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect, useState } from "react";
import defaultImg from '../public/avatar.png';

const ContactPage = () => {
    const { users, getUsers, sendFriendRequest } = useChatStore();
    const { onlineUsers, authUser } = useAuthStore();
    const [sendingRequest, setSendingRequest] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [requestMessage, setRequestMessage] = useState("");

    useEffect(() => {
        getUsers();
    }, [getUsers]);

    const handleOpenRequestModal = (user) => {
        setSelectedUser(user);
        setRequestMessage("");
        setShowRequestModal(true);
    };

    const handleSendRequest = async () => {
        if (!selectedUser) return;

        setSendingRequest(selectedUser._id);
        try {
            await sendFriendRequest(selectedUser._id, requestMessage.trim());
            setShowRequestModal(false);
            setSelectedUser(null);
            setRequestMessage("");
        } catch (error) {
            console.error("Error sending friend request:", error);
        } finally {
            setSendingRequest(null);
        }
    };

    // Filter out: current user, existing friends, and apply search
    const filteredUsers = users.filter((user) => {
        const isMe = user._id === authUser._id;
        const isFriend = user.isFriend;
        const matchesSearch = user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());

        return !isMe && !isFriend && matchesSearch;
    });

    const renderActionButton = (user) => {
        const isSending = sendingRequest === user._id;

        // If pending request sent by me
        if (user.hasPendingRequest && user.pendingRequestSentByMe) {
            return (
                <div className="flex flex-col items-center gap-1 w-full">
                    <button
                        disabled
                        className="btn btn-sm btn-outline gap-2 w-full"
                    >
                        <Clock className="w-4 h-4" />
                        Pending
                    </button>
                    <span className="text-xs text-base-content/50">Request sent</span>
                </div>
            );
        }

        // If pending request from them
        if (user.hasPendingRequest && !user.pendingRequestSentByMe) {
            return (
                <div className="flex flex-col items-center gap-1 w-full">
                    <button
                        onClick={() => window.location.href = '/notifications'}
                        className="btn btn-sm btn-success gap-2 w-full animate-pulse"
                    >
                        <Bell className="w-4 h-4" />
                        View Request
                    </button>
                    <span className="text-xs text-success font-medium">Wants to connect!</span>
                </div>
            );
        }

        // Two buttons for new connections
        return (
            <div className="flex flex-col gap-2 w-full">
                <button
                    onClick={() => handleQuickRequest(user._id)}
                    disabled={isSending}
                    className="btn btn-primary btn-sm gap-2 w-full"
                >
                    <UserPlus className="w-4 h-4" />
                    {isSending ? "Sending..." : "Add Friend"}
                </button>
                <button
                    onClick={() => handleOpenRequestModal(user)}
                    disabled={isSending}
                    className="btn btn-outline btn-sm gap-2 w-full"
                >
                    <Send className="w-4 h-4" />
                    Send Message
                </button>
            </div>
        );
    };

    const handleQuickRequest = async (userId) => {
        setSendingRequest(userId);
        try {
            await sendFriendRequest(userId, ""); // Send without message
        } catch (error) {
            console.error("Error sending friend request:", error);
        } finally {
            setSendingRequest(null);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-base-200/30">
                <div className="container mx-auto px-4 pt-20 pb-8 max-w-7xl">
                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-3xl font-bold flex items-center gap-3">
                                    <div className="p-3 bg-primary/10 rounded-2xl">
                                        <Users className="w-7 h-7 text-primary" />
                                    </div>
                                    Discover People
                                </h1>
                                <p className="text-base-content/60 mt-2 ml-1">
                                    Find and connect with {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'}
                                </p>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative max-w-md">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/40" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-base-100 rounded-xl border-2 border-base-300 focus:border-primary focus:outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Users Grid */}
                    {filteredUsers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredUsers.map((user) => {
                                const isOnline = onlineUsers.includes(user._id);

                                return (
                                    <div
                                        key={user._id}
                                        className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 border border-base-300 hover:border-primary/50"
                                    >
                                        <div className="card-body p-6">
                                            {/* Avatar Section */}
                                            <div className="flex flex-col items-center mb-4">
                                                <div className="relative mb-3">
                                                    <div className="avatar">
                                                        <div className="w-20 h-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                                            <img
                                                                src={user.profilePic || defaultImg}
                                                                alt={user.fullName}
                                                            />
                                                        </div>
                                                    </div>
                                                    {isOnline && (
                                                        <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full ring-2 ring-base-100"></span>
                                                    )}
                                                </div>

                                                {/* User Info */}
                                                <h3 className="font-bold text-lg text-center truncate w-full">
                                                    {user.fullName}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`badge badge-sm ${isOnline ? 'badge-success' : 'badge-ghost'}`}>
                                                        {isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Email */}
                                            <div className="flex items-center gap-2 text-sm text-base-content/70 mb-4 justify-center">
                                                <Mail className="w-4 h-4 flex-shrink-0" />
                                                <span className="truncate">{user.email}</span>
                                            </div>

                                            {/* About */}
                                            {user.about && (
                                                <p className="text-sm text-base-content/60 italic text-center line-clamp-2 mb-4 min-h-[2.5rem]">
                                                    "{user.about}"
                                                </p>
                                            )}

                                            {/* Action Button */}
                                            <div className="card-actions justify-center mt-auto">
                                                {renderActionButton(user)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="text-center py-16">
                            <div className="inline-block p-6 bg-base-100 rounded-3xl shadow-lg mb-4">
                                <Users className="w-16 h-16 text-base-content/30 mx-auto" />
                            </div>
                            <h3 className="text-2xl font-bold text-base-content/70 mb-2">
                                {searchQuery ? 'No users found' : 'No new people to connect'}
                            </h3>
                            <p className="text-base-content/50 max-w-md mx-auto">
                                {searchQuery
                                    ? 'Try searching with a different name or email'
                                    : 'You\'ve already connected with everyone! Check your notifications for pending requests.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Friend Request Modal */}
            {showRequestModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-base-300">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Send Friend Request</h2>
                                <button
                                    onClick={() => setShowRequestModal(false)}
                                    className="btn btn-sm btn-ghost btn-circle"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {/* User Info */}
                            <div className="flex items-center gap-4 mb-6 p-4 bg-base-200 rounded-xl">
                                <div className="avatar">
                                    <div className="w-14 h-14 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                        <img
                                            src={selectedUser.profilePic || defaultImg}
                                            alt={selectedUser.fullName}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg truncate">{selectedUser.fullName}</h3>
                                    <p className="text-sm text-base-content/60 truncate">{selectedUser.email}</p>
                                </div>
                            </div>

                            {/* Message Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-base-content/80">
                                    Add a message (optional)
                                </label>
                                <textarea
                                    value={requestMessage}
                                    onChange={(e) => setRequestMessage(e.target.value)}
                                    placeholder="Hi! I'd like to connect with you..."
                                    className="textarea textarea-bordered w-full h-24 resize-none focus:textarea-primary"
                                    maxLength={200}
                                />
                                <div className="text-xs text-base-content/50 text-right">
                                    {requestMessage.length}/200
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-base-300 flex gap-3">
                            <button
                                onClick={() => setShowRequestModal(false)}
                                className="btn btn-ghost flex-1"
                                disabled={sendingRequest}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendRequest}
                                disabled={sendingRequest}
                                className="btn btn-primary flex-1 gap-2"
                            >
                                {sendingRequest ? (
                                    <>
                                        <span className="loading loading-spinner loading-sm"></span>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ContactPage;
