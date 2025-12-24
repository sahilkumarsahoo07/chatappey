import { useEffect, useState } from "react";
import { Bell, UserPlus, MessageSquare, Check, X, Loader, User as UserIcon, Trash2, Sparkles } from "lucide-react";
import { useNotificationStore } from "../store/useNotificationStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import defaultImg from '../public/avatar.png';
import { formatDistanceToNow } from 'date-fns';

const NotificationPage = () => {
    const [activeTab, setActiveTab] = useState("requests");
    const { notifications, isLoading, fetchNotifications, markAsRead, deleteNotification } = useNotificationStore();
    const { acceptFriendRequest, rejectFriendRequest } = useChatStore();
    const { socket } = useAuthStore();
    const [processingRequests, setProcessingRequests] = useState(new Set());
    const [selectedNotifications, setSelectedNotifications] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Listen for real-time friend request notifications
    useEffect(() => {
        if (!socket) return;

        const handleFriendRequestSent = (data) => {
            fetchNotifications();
        };

        const handleFriendRequestAccepted = (data) => {
            fetchNotifications();
        };

        const handleNewRequestMessage = (data) => {
            fetchNotifications();
        };

        socket.on("friendRequestSent", handleFriendRequestSent);
        socket.on("friendRequestAccepted", handleFriendRequestAccepted);
        socket.on("newRequestMessage", handleNewRequestMessage);

        return () => {
            socket.off("friendRequestSent", handleFriendRequestSent);
            socket.off("friendRequestAccepted", handleFriendRequestAccepted);
            socket.off("newRequestMessage", handleNewRequestMessage);
        };
    }, [socket, fetchNotifications]);

    const handleAccept = async (requestId, notificationId) => {
        setProcessingRequests(prev => new Set(prev).add(requestId));
        try {
            await acceptFriendRequest(requestId);
            await markAsRead(notificationId);
            await fetchNotifications();
        } catch (error) {
            console.error("Error accepting request:", error);
        } finally {
            setProcessingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    const handleReject = async (requestId, notificationId) => {
        setProcessingRequests(prev => new Set(prev).add(requestId));
        try {
            await rejectFriendRequest(requestId);
            await markAsRead(notificationId);
            await fetchNotifications();
        } catch (error) {
            console.error("Error rejecting request:", error);
        } finally {
            setProcessingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    // Filter notifications by type
    const friendRequestNotifications = notifications.filter(
        n => n.type === "friend_request" && n.friendRequestId?.status === "pending"
    );

    const requestMessageNotifications = notifications.filter(
        n => n.type === "request_message" && n.friendRequestId?.status === "pending"
    );

    const otherNotifications = notifications.filter(
        n => n.type === "request_accepted" || n.type === "request_rejected"
    );

    // Handle checkbox toggle
    const handleToggleNotification = (notificationId) => {
        setSelectedNotifications(prev => {
            const newSet = new Set(prev);
            if (newSet.has(notificationId)) {
                newSet.delete(notificationId);
            } else {
                newSet.add(notificationId);
            }
            return newSet;
        });
    };

    // Handle select all
    const handleSelectAll = () => {
        if (selectedNotifications.size === otherNotifications.length) {
            setSelectedNotifications(new Set());
        } else {
            setSelectedNotifications(new Set(otherNotifications.map(n => n._id)));
        }
    };

    // Handle delete selected
    const handleDeleteSelected = async () => {
        if (selectedNotifications.size === 0) return;

        setIsDeleting(true);
        try {
            await Promise.all(
                Array.from(selectedNotifications).map(id => deleteNotification(id))
            );
            setSelectedNotifications(new Set());
            await fetchNotifications();
        } catch (error) {
            console.error("Error deleting notifications:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const renderNotificationCard = (notification) => {
        const isProcessing = processingRequests.has(notification.friendRequestId?._id);
        const isPending = notification.friendRequestId?.status === "pending";

        return (
            <div
                key={notification._id}
                className={`group relative bg-gradient-to-br from-base-100 to-base-200/50 backdrop-blur-sm 
                    rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl
                    ${notification.isRead
                        ? 'border-base-300/50'
                        : 'border-primary/30 shadow-lg shadow-primary/10'
                    }`}
            >
                {/* Unread glow effect */}
                {!notification.isRead && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl sm:rounded-2xl animate-pulse"></div>
                )}

                <div className="relative flex items-start gap-2.5 sm:gap-3 md:gap-4">
                    {/* Avatar with glow */}
                    <div className="relative flex-shrink-0">
                        <div className="avatar online">
                            <div className="w-10 h-10 sm:w-12 md:w-14 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl ring-2 ring-primary/20 ring-offset-2 ring-offset-base-100">
                                <img
                                    src={notification.fromUserId?.profilePic || defaultImg}
                                    alt={notification.fromUserId?.fullName}
                                    className="object-cover"
                                />
                            </div>
                        </div>
                        {!notification.isRead && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-primary rounded-full border-2 border-base-100 animate-bounce"></div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1 sm:mb-2">
                            <div className="flex-1 min-w-0 mr-2">
                                <h3 className="font-bold text-sm sm:text-base text-base-content group-hover:text-primary transition-colors truncate">
                                    {notification.fromUserId?.fullName}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-base-content/60 flex items-center gap-1 truncate">
                                    <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse flex-shrink-0"></span>
                                    <span className="truncate">{notification.fromUserId?.email}</span>
                                </p>
                            </div>
                        </div>

                        {notification.message && (
                            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-base-200/80 backdrop-blur-sm rounded-lg sm:rounded-xl border border-base-300/50">
                                <p className="text-xs sm:text-sm italic text-base-content/80 line-clamp-3">"{notification.message}"</p>
                            </div>
                        )}

                        <p className="text-[10px] sm:text-xs text-base-content/50 mt-2 sm:mt-3 flex items-center gap-1">
                            <Bell className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                            <span className="truncate">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Action buttons for pending requests */}
                {isPending && (
                    <div className="relative mt-3 sm:mt-4 flex gap-2 justify-end">
                        <button
                            onClick={() => handleReject(notification.friendRequestId._id, notification._id)}
                            disabled={isProcessing}
                            className="btn btn-xs sm:btn-sm bg-error/10 hover:bg-error hover:text-error-content text-error border-error/30 gap-1.5 sm:gap-2 transition-all duration-300 hover:scale-105 text-xs sm:text-sm"
                        >
                            {isProcessing ? (
                                <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                            ) : (
                                <>
                                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span>Reject</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => handleAccept(notification.friendRequestId._id, notification._id)}
                            disabled={isProcessing}
                            className="btn btn-xs sm:btn-sm btn-primary gap-1.5 sm:gap-2 transition-all duration-300 hover:scale-105 shadow-lg shadow-primary/30 text-xs sm:text-sm"
                        >
                            {isProcessing ? (
                                <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span>Accept</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-200 pl-[0px] md:pl-20 overflow-auto">
            <div className="w-full px-2 md:max-w-3xl md:mx-auto pt-5 pb-6 sm:pb-8">
                <div className="space-y-4 sm:space-y-6">
                    {/* Modern Header with gradient */}
                    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-3 sm:p-5 md:p-8 backdrop-blur-sm border border-base-300/50">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/5 rounded-full blur-3xl"></div>

                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <Bell className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                        Notifications
                                    </h1>
                                    <p className="text-[10px] sm:text-xs text-base-content/70 mt-0.5 sm:mt-1">
                                        Stay updated with your connections
                                    </p>
                                </div>
                            </div>

                            {notifications.filter(n => !n.isRead).length > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/30">
                                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                    <span className="text-sm font-semibold text-primary">
                                        {notifications.filter(n => !n.isRead).length} New
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modern Tabs */}
                    <div className="flex gap-1 sm:gap-2 p-1 sm:p-1.5 bg-base-200/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-base-300/50">
                        <button
                            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] md:text-xs font-medium transition-all duration-300
                                ${activeTab === "requests"
                                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-content shadow-lg shadow-primary/30"
                                    : "hover:bg-base-300/50 text-base-content/70"
                                }`}
                            onClick={() => setActiveTab("requests")}
                        >
                            <UserPlus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>Requests</span>
                            {friendRequestNotifications.length > 0 && (
                                <span className={`badge badge-xs ${activeTab === "requests" ? "badge-primary-content" : "badge-primary"}`}>
                                    {friendRequestNotifications.length}
                                </span>
                            )}
                        </button>
                        <button
                            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] md:text-xs font-medium transition-all duration-300
                                ${activeTab === "messages"
                                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-content shadow-lg shadow-primary/30"
                                    : "hover:bg-base-300/50 text-base-content/70"
                                }`}
                            onClick={() => setActiveTab("messages")}
                        >
                            <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>Messages</span>
                            {requestMessageNotifications.length > 0 && (
                                <span className={`badge badge-xs ${activeTab === "messages" ? "badge-primary-content" : "badge-primary"}`}>
                                    {requestMessageNotifications.length}
                                </span>
                            )}
                        </button>
                        <button
                            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] md:text-xs font-medium transition-all duration-300
                                ${activeTab === "other"
                                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-content shadow-lg shadow-primary/30"
                                    : "hover:bg-base-300/50 text-base-content/70"
                                }`}
                            onClick={() => setActiveTab("other")}
                        >
                            <Bell className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>Other</span>
                            {otherNotifications.filter(n => !n.isRead).length > 0 && (
                                <span className={`badge badge-xs ${activeTab === "other" ? "badge-primary-content" : "badge-primary"}`}>
                                    {otherNotifications.filter(n => !n.isRead).length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Delete controls for Other tab */}
                    {activeTab === "other" && otherNotifications.length > 0 && (
                        <div className="flex items-center justify-between p-4 bg-base-200/50 backdrop-blur-sm rounded-2xl border border-base-300/50">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary checkbox-sm"
                                    checked={selectedNotifications.size === otherNotifications.length && otherNotifications.length > 0}
                                    onChange={handleSelectAll}
                                />
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                    Select All ({selectedNotifications.size}/{otherNotifications.length})
                                </span>
                            </label>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedNotifications.size === 0 || isDeleting}
                                className="btn btn-sm btn-error gap-2 shadow-lg shadow-error/20 hover:scale-105 transition-all"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete ({selectedNotifications.size})
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader className="w-12 h-12 animate-spin text-primary mb-4" />
                            <p className="text-sm text-base-content/50">Loading notifications...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Friend Requests Tab */}
                            {activeTab === "requests" && (
                                <>
                                    {friendRequestNotifications.length === 0 ? (
                                        <div className="text-center py-10 sm:py-16 md:py-20">
                                            <div className="inline-flex p-4 sm:p-5 md:p-6 bg-primary/10 rounded-2xl sm:rounded-3xl mb-4 sm:mb-6">
                                                <UserPlus className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-primary/50" />
                                            </div>
                                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-base-content/80 mb-1 sm:mb-2">
                                                No pending requests
                                            </h3>
                                            <p className="text-xs sm:text-sm text-base-content/50 max-w-md mx-auto px-4">
                                                When someone sends you a friend request, it will appear here
                                            </p>
                                        </div>
                                    ) : (
                                        friendRequestNotifications.map(renderNotificationCard)
                                    )}
                                </>
                            )}

                            {/* Request Messages Tab */}
                            {activeTab === "messages" && (
                                <>
                                    {requestMessageNotifications.length === 0 ? (
                                        <div className="text-center py-10 sm:py-16 md:py-20">
                                            <div className="inline-flex p-4 sm:p-5 md:p-6 bg-secondary/10 rounded-2xl sm:rounded-3xl mb-4 sm:mb-6">
                                                <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-secondary/50" />
                                            </div>
                                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-base-content/80 mb-1 sm:mb-2">
                                                No request messages
                                            </h3>
                                            <p className="text-xs sm:text-sm text-base-content/50 max-w-md mx-auto px-4">
                                                Messages from friend requests will appear here
                                            </p>
                                        </div>
                                    ) : (
                                        requestMessageNotifications.map(renderNotificationCard)
                                    )}
                                </>
                            )}

                            {/* Other Notifications Tab */}
                            {activeTab === "other" && (
                                <>
                                    {otherNotifications.length === 0 ? (
                                        <div className="text-center py-10 sm:py-16 md:py-20">
                                            <div className="inline-flex p-4 sm:p-5 md:p-6 bg-accent/10 rounded-2xl sm:rounded-3xl mb-4 sm:mb-6">
                                                <Bell className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-accent/50" />
                                            </div>
                                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-base-content/80 mb-1 sm:mb-2">
                                                No notifications
                                            </h3>
                                            <p className="text-xs sm:text-sm text-base-content/50 max-w-md mx-auto px-4">
                                                Updates about your friend requests will appear here
                                            </p>
                                        </div>
                                    ) : (
                                        otherNotifications.map(notification => (
                                            <div
                                                key={notification._id}
                                                className={`group relative bg-gradient-to-br from-base-100 to-base-200/50 backdrop-blur-sm 
                                                    rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl
                                                    ${notification.isRead
                                                        ? 'border-base-300/50'
                                                        : 'border-primary/30 shadow-lg shadow-primary/10'
                                                    }`}
                                            >
                                                <div className="relative flex items-start gap-4">
                                                    {/* Checkbox */}
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-primary mt-1 flex-shrink-0"
                                                        checked={selectedNotifications.has(notification._id)}
                                                        onChange={() => handleToggleNotification(notification._id)}
                                                    />

                                                    <div className="relative flex-shrink-0">
                                                        <div className="avatar">
                                                            <div className="w-14 h-14 rounded-2xl ring-2 ring-primary/20 ring-offset-2 ring-offset-base-100">
                                                                <img
                                                                    src={notification.fromUserId?.profilePic || defaultImg}
                                                                    alt={notification.fromUserId?.fullName}
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        </div>
                                                        {!notification.isRead && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-base-100 animate-bounce"></div>
                                                        )}
                                                    </div>

                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => !notification.isRead && markAsRead(notification._id)}
                                                    >
                                                        <h3 className="font-bold text-base text-base-content group-hover:text-primary transition-colors">
                                                            {notification.fromUserId?.fullName}
                                                        </h3>
                                                        <p className="text-sm text-base-content/70 mt-1">
                                                            {notification.type === "request_accepted"
                                                                ? "✅ Accepted your friend request"
                                                                : "❌ Rejected your friend request"}
                                                        </p>
                                                        <p className="text-xs text-base-content/50 mt-2 flex items-center gap-1.5">
                                                            <Bell className="w-3 h-3" />
                                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationPage;
