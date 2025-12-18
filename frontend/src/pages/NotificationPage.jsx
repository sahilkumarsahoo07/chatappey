import { useEffect, useState } from "react";
import { Bell, UserPlus, MessageSquare, Check, X, Loader, User as UserIcon, Trash2 } from "lucide-react";
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
                className={`card bg-base-100 shadow-md border ${notification.isRead ? 'border-base-300' : 'border-primary'
                    } hover:shadow-lg transition-all duration-200`}
            >
                <div className="card-body p-4">
                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="avatar">
                            <div className="w-12 h-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                <img
                                    src={notification.fromUserId?.profilePic || defaultImg}
                                    alt={notification.fromUserId?.fullName}
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate">
                                {notification.fromUserId?.fullName}
                            </h3>
                            <p className="text-sm text-base-content/70">
                                {notification.fromUserId?.email}
                            </p>

                            {notification.message && (
                                <div className="mt-2 p-3 bg-base-200 rounded-lg">
                                    <p className="text-sm italic">"{notification.message}"</p>
                                </div>
                            )}

                            <p className="text-xs text-base-content/50 mt-2">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                        </div>

                        {/* Unread indicator */}
                        {!notification.isRead && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                        )}
                    </div>

                    {/* Action buttons for pending requests */}
                    {isPending && (
                        <div className="card-actions justify-end mt-3 gap-2">
                            <button
                                onClick={() => handleReject(notification.friendRequestId._id, notification._id)}
                                disabled={isProcessing}
                                className="btn btn-sm btn-outline btn-error gap-2"
                            >
                                {isProcessing ? (
                                    <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <X className="w-4 h-4" />
                                        Reject
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => handleAccept(notification.friendRequestId._id, notification._id)}
                                disabled={isProcessing}
                                className="btn btn-sm btn-primary gap-2"
                            >
                                {isProcessing ? (
                                    <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Accept
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 pt-20 max-w-4xl h-full">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Bell className="w-6 h-6" />
                        Notifications
                    </h2>
                    <p className="text-sm text-base-content/70">
                        Manage your friend requests and notifications
                    </p>
                </div>

                {/* Tabs */}
                <div className="tabs tabs-boxed bg-base-200 p-1">
                    <button
                        className={`tab gap-2 ${activeTab === "requests" ? "tab-active" : ""}`}
                        onClick={() => setActiveTab("requests")}
                    >
                        <UserPlus className="w-4 h-4" />
                        Friend Requests
                        {friendRequestNotifications.length > 0 && (
                            <span className="badge badge-primary badge-sm">
                                {friendRequestNotifications.length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`tab gap-2 ${activeTab === "messages" ? "tab-active" : ""}`}
                        onClick={() => setActiveTab("messages")}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Request Messages
                        {requestMessageNotifications.length > 0 && (
                            <span className="badge badge-primary badge-sm">
                                {requestMessageNotifications.length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`tab gap-2 ${activeTab === "other" ? "tab-active" : ""}`}
                        onClick={() => setActiveTab("other")}
                    >
                        <Bell className="w-4 h-4" />
                        Other
                        {otherNotifications.filter(n => !n.isRead).length > 0 && (
                            <span className="badge badge-primary badge-sm">
                                {otherNotifications.filter(n => !n.isRead).length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Delete controls for Other tab */}
                {activeTab === "other" && otherNotifications.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary checkbox-sm"
                                    checked={selectedNotifications.size === otherNotifications.length && otherNotifications.length > 0}
                                    onChange={handleSelectAll}
                                />
                                <span className="text-sm font-medium">
                                    Select All ({selectedNotifications.size}/{otherNotifications.length})
                                </span>
                            </label>
                        </div>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedNotifications.size === 0 || isDeleting}
                            className="btn btn-sm btn-error gap-2"
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
                    <div className="flex items-center justify-center py-12">
                        <Loader className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Friend Requests Tab */}
                        {activeTab === "requests" && (
                            <>
                                {friendRequestNotifications.length === 0 ? (
                                    <div className="text-center py-12">
                                        <UserPlus className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
                                        <h3 className="text-lg font-semibold text-base-content/70">
                                            No pending friend requests
                                        </h3>
                                        <p className="text-sm text-base-content/50 mt-2">
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
                                    <div className="text-center py-12">
                                        <MessageSquare className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
                                        <h3 className="text-lg font-semibold text-base-content/70">
                                            No request messages
                                        </h3>
                                        <p className="text-sm text-base-content/50 mt-2">
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
                                    <div className="text-center py-12">
                                        <Bell className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
                                        <h3 className="text-lg font-semibold text-base-content/70">
                                            No notifications
                                        </h3>
                                        <p className="text-sm text-base-content/50 mt-2">
                                            Updates about your friend requests will appear here
                                        </p>
                                    </div>
                                ) : (
                                    otherNotifications.map(notification => (
                                        <div
                                            key={notification._id}
                                            className={`card bg-base-100 shadow-md border ${notification.isRead ? 'border-base-300' : 'border-primary'
                                                } hover:shadow-lg transition-all duration-200`}
                                        >
                                            <div className="card-body p-4">
                                                <div className="flex items-start gap-4">
                                                    {/* Checkbox */}
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-primary mt-1"
                                                        checked={selectedNotifications.has(notification._id)}
                                                        onChange={() => handleToggleNotification(notification._id)}
                                                    />

                                                    <div className="avatar">
                                                        <div className="w-12 h-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                                            <img
                                                                src={notification.fromUserId?.profilePic || defaultImg}
                                                                alt={notification.fromUserId?.fullName}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => !notification.isRead && markAsRead(notification._id)}
                                                    >
                                                        <h3 className="font-bold text-base truncate">
                                                            {notification.fromUserId?.fullName}
                                                        </h3>
                                                        <p className="text-sm text-base-content/70">
                                                            {notification.type === "request_accepted"
                                                                ? "Accepted your friend request"
                                                                : "Rejected your friend request"}
                                                        </p>
                                                        <p className="text-xs text-base-content/50 mt-2">
                                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>

                                                    {!notification.isRead && (
                                                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                                                    )}
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
    );
};

export default NotificationPage;
