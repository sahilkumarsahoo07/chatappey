import { Copy, Info, Mail, Phone, Star, Video, X, Ban } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import defaultImg from '../public/avatar.png'
import { Avatar, Button, Divider, Drawer, IconButton, ListItem, ListItemIcon, ListItemText, Typography, List } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";

const ChatHeader = () => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const { authUser, onlineUsers, getOneBlockedUser, blockUser, unblockUser, subscribeToBlockEvents } = useAuthStore();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const checkBlockedStatus = async () => {
            try {
                const data = await getOneBlockedUser(); // Call the function and store the result
                setIsBlocked(data.blockedUsers.some(user => user._id === selectedUser._id)); // Use the result
            } catch (error) {
                console.error("Error checking blocked status:", error);
            }
        };

        checkBlockedStatus();
    }, [selectedUser._id]);

    const toggleDrawer = (open) => (event) => {
        if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setDrawerOpen(open);
    };

    const formatLastSeen = () => {
        const formatTime = (date) => {
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        };

        // Use server-side lastLogout if available
        if (selectedUser.lastLogout) {
            const lastSeen = new Date(selectedUser.lastLogout);
            const now = new Date();

            const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastSeenDate = new Date(lastSeen.getFullYear(), lastSeen.getMonth(), lastSeen.getDate());

            const diffDays = Math.floor((nowDate - lastSeenDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return `Last seen today at ${formatTime(lastSeen)}`;
            if (diffDays === 1) return `Last seen yesterday at ${formatTime(lastSeen)}`;
            if (diffDays < 7) return `Last seen ${lastSeen.toLocaleDateString([], { weekday: 'long' })} at ${formatTime(lastSeen)}`;

            return `Last seen ${lastSeen.toLocaleDateString([], {
                day: 'numeric',
                month: 'short',
                year: now.getFullYear() !== lastSeen.getFullYear() ? 'numeric' : undefined
            })} at ${formatTime(lastSeen)}`;
        }

        return "Last seen recently";
    };
    useEffect(() => {
        const checkStatus = async () => {
            const blocked = await getOneBlockedUser().then(data =>
                data.blockedUsers.some(user => user._id === selectedUser._id)
            );
            setIsBlocked(blocked);
        };
        checkStatus();
    }, [selectedUser._id]);

    // Listen for block/unblock events
    useEffect(() => {
        const unsubscribe = subscribeToBlockEvents(async ({ blockerId, blockedId }) => {
            if (authUser._id === blockerId || authUser._id === blockedId) {
                const blocked = await getOneBlockedUser().then(data =>
                    data.blockedUsers.some(user => user._id === selectedUser._id)
                );
                setIsBlocked(blocked);
            }
        });
        return unsubscribe;
    }, [selectedUser._id, authUser._id, subscribeToBlockEvents]);

    const handelBlockUser = async (userId) => {
        try {
            // Optimistically update UI
            setIsBlocked(true);
            await blockUser(userId);
        } catch (error) {
            // Revert on error
            setIsBlocked(false);
            console.error("Error blocking user:", error);
            toast.error(error.response?.data?.message || "Failed to block user");
        }
    };

    // Unblock user function
    const handelUnblockUser = async (userId) => {
        try {
            await unblockUser(userId);
            setIsBlocked(false);
            toast.success('User unblocked successfully');
        } catch (error) {
            console.error("Error unblocking user:", error);
            toast.error(error.response?.data?.message || "Failed to unblock user");
        }
    };




    return (
        <>
            <div className="chat-header-modern">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={toggleDrawer(true)}>
                        {/* Back button for mobile */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(null);
                            }}
                            className="md:hidden p-2 rounded-lg touch-target hover:bg-primary-content/10 transition-colors text-primary-content"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </button>

                        {/* Avatar with online indicator */}
                        <div className="relative">
                            <div className="size-11 md:size-12 rounded-full relative ring-2 ring-primary-content/30 overflow-hidden">
                                <img src={(selectedUser.hasBlockedMe || isBlocked) ? defaultImg : (selectedUser.profilePic || defaultImg)} alt={selectedUser.fullName} className="w-full h-full object-cover" />
                            </div>
                            {onlineUsers.includes(selectedUser._id) && !selectedUser.hasBlockedMe && !isBlocked && (
                                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-primary"></span>
                            )}
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold truncate text-base md:text-lg text-primary-content">{selectedUser.fullName}</h3>
                            <p className="text-xs md:text-sm truncate flex items-center gap-1.5 text-primary-content/90">
                                {(selectedUser.hasBlockedMe || isBlocked) ? (
                                    "Unavailable"
                                ) : onlineUsers.includes(selectedUser._id) ? (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                        Active now
                                    </>
                                ) : (
                                    formatLastSeen()
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button className="hidden md:flex p-2.5 rounded-xl hover:bg-primary-content/10 transition-colors text-primary-content">
                            <Phone size={20} />
                        </button>
                        <button className="hidden md:flex p-2.5 rounded-xl hover:bg-primary-content/10 transition-colors text-primary-content">
                            <Video size={20} />
                        </button>
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="hidden md:block p-2.5 rounded-xl hover:bg-primary-content/10 transition-colors text-primary-content"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={toggleDrawer(false)}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: { xs: '100%', sm: 400 },
                        boxSizing: 'border-box',
                    },
                }}
            >
                <div className="h-full flex flex-col bg-base-100">
                    {/* Header */}
                    <div className="p-5 flex justify-between items-center bg-primary text-primary-content">
                        <h6 className="text-lg font-bold">
                            Contact Info
                        </h6>
                        <button onClick={toggleDrawer(false)} className="hover:bg-base-content/20 p-2 rounded-full transition-colors">
                            <X size={22} />
                        </button>
                    </div>

                    {/* Profile Section */}
                    <div className="p-6 flex flex-col items-center relative bg-base-200">
                        {/* Status badge */}
                        {!isBlocked && !selectedUser.hasBlockedMe && (
                            <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${onlineUsers.includes(selectedUser._id)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${onlineUsers.includes(selectedUser._id) ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                    }`}></span>
                                {onlineUsers.includes(selectedUser._id) ? 'Active' : 'Offline'}
                            </div>
                        )}

                        {/* Avatar with gradient ring */}
                        <div className="w-32 h-32 mb-5 rounded-full p-1 gradient-purple-blue">
                            <div className="w-full h-full rounded-full overflow-hidden bg-white">
                                <img src={(selectedUser.hasBlockedMe || isBlocked) ? defaultImg : (selectedUser.profilePic || defaultImg)} alt={selectedUser.fullName} className="w-full h-full object-cover" />
                            </div>
                        </div>

                        <h5 className="text-2xl font-bold mb-1 text-center text-gray-900">
                            {selectedUser.fullName}
                        </h5>

                        {/* Email with copy */}
                        <div className="w-full mt-4 px-4 py-3 rounded-xl bg-white border border-purple-100 hover:border-purple-200 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="p-2 rounded-lg gradient-purple-blue">
                                        <Mail size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-500 mb-0.5">Email</p>
                                        <p className="text-sm text-gray-900 truncate font-medium">
                                            {selectedUser.email}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(selectedUser.email);
                                        toast.success('Email copied!');
                                    }}
                                    className="p-2 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3 mt-5 w-full px-4">
                            <button className="flex-1 p-3 rounded-xl gradient-purple-blue text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                <Phone size={18} />
                                Call
                            </button>
                            <button className="flex-1 p-3 rounded-xl bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-colors flex items-center justify-center gap-2">
                                <Video size={18} />
                                Video
                            </button>
                        </div>
                    </div>

                    {/* About Section */}
                    <div className="px-6 py-4 bg-white">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg gradient-purple-blue">
                                <Info size={14} className="text-white" />
                            </div>
                            <h6 className="text-sm font-bold text-gray-900">About</h6>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {selectedUser.about || "Hey there! I'm using ChatAppey 💬"}
                        </p>
                    </div>

                    {/* Details Section */}
                    <div className="px-6 py-4 mx-4 my-2 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Member Since</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                                <div className="p-2 rounded-lg bg-white/60">
                                    <Info size={16} className="text-purple-600" />
                                </div>
                            </div>

                            <div className="h-px bg-purple-200"></div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
                                    <div className="flex items-center gap-2">
                                        {(isBlocked || selectedUser.hasBlockedMe) ? (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                <span className="text-sm font-semibold text-gray-700">Unavailable</span>
                                            </>
                                        ) : onlineUsers.includes(selectedUser._id) ? (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-sm font-semibold text-green-700">Online</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                <span className="text-sm font-semibold text-gray-700">
                                                    {formatLastSeen()}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Block/Unblock Section */}
                    <div className="mt-auto p-5 space-y-3">
                        {isBlocked ? (
                            <div className="px-5 py-4 bg-red-50 rounded-xl border-2 border-red-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Ban size={18} className="text-red-600" />
                                    <h6 className="text-sm font-bold text-red-900">Blocked User</h6>
                                </div>
                                <p className="text-sm text-red-700 mb-3">
                                    You won't receive messages from this user.
                                </p>
                                <button
                                    onClick={() => handelUnblockUser(selectedUser._id)}
                                    className="w-full py-2.5 px-4 rounded-xl bg-white text-red-600 font-semibold hover:bg-red-100 transition-colors border-2 border-red-200"
                                >
                                    Unblock User
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => handelBlockUser(selectedUser._id)}
                                className="w-full py-3 px-4 rounded-xl border-2 border-red-400 text-red-600 font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Ban size={18} />
                                Block User
                            </button>
                        )}
                    </div>
                </div>
            </Drawer>
        </>
    );
};
export default ChatHeader;