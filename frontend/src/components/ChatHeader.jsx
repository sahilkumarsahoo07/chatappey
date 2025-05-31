import { Copy, Info, Mail, Phone, Star, Video, X,Ban } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import defaultImg from '../public/avatar.png'
import { Avatar, Button, Divider, Drawer, IconButton, ListItem, ListItemIcon, ListItemText, Typography, List } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";

const ChatHeader = () => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const {authUser , onlineUsers,getOneBlockedUser,blockUser,unblockUser,subscribeToBlockEvents } = useAuthStore();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [isBlocked, setIsBlocked] = useState(false);
    const [offlineSince, setOfflineSince] = useState(() => {
        const saved = localStorage.getItem(`offlineSince_${selectedUser._id}`);
        return saved ? new Date(JSON.parse(saved)) : null;
    });


    useEffect(() => {
        if (offlineSince) {
            localStorage.setItem(`offlineSince_${selectedUser._id}`, JSON.stringify(offlineSince));
        } else {
            localStorage.removeItem(`offlineSince_${selectedUser._id}`);
        }
    }, [offlineSince, selectedUser._id]);

    useEffect(() => {
        if (!onlineUsers.includes(selectedUser._id) && !offlineSince) {
            setOfflineSince(new Date());
        } else if (onlineUsers.includes(selectedUser._id) && offlineSince) {
            setOfflineSince(null);
        }
    }, [onlineUsers, selectedUser._id]);

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
    if (selectedUser.lastLogout) {
        const now = new Date();
        const lastSeen = new Date(selectedUser.lastLogout);

        const formatTime = (date) => {
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toLowerCase();
        };

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

    if (offlineSince) {
        const diffMinutes = Math.floor((new Date() - offlineSince) / (1000 * 60));
        return `Last seen ${diffMinutes} min`;
    }

    return "Last seen unknown";
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

    const handelBlockUser = async(userId) => {
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
    const handelUnblockUser = async(userId) => {
        try {
            await unblockUser(userId);
            toast.success('User blocked successfully');
        } catch (error) {
            console.error("Error forwarding message:", error);
        }
    };




    return (
    <>
        <div className="p-2.5 border-b border-base-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={toggleDrawer(true)}>
                    {/* Avatar */}
                    <div className="avatar">
                        <div className="size-10 rounded-full relative">
                            <img src={selectedUser.profilePic || defaultImg} alt={selectedUser.fullName} />
                        </div>
                    </div>

                    {/* User info */}
                    <div>
                        <h3 className="font-medium">{selectedUser.fullName}</h3>
                        <p className="text-sm text-base-content/70">
                            {/* {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"} */}
                            {onlineUsers.includes(selectedUser._id) ? "Online" : formatLastSeen()}
                            {/* {formatLastSeen()} */}
                        </p>
                    </div>
                </div>

                {/* Close button */}
                <button onClick={() => setSelectedUser(null)}>
                    <X />
                </button>
            </div>
        </div>
        <Drawer anchor="right" open={drawerOpen} onClose={toggleDrawer(false)} sx={{ '& .MuiDrawer-paper': { width: 380, boxSizing: 'border-box', }, }} >
            <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                {/* Header */}
                <div className="p-5 flex justify-between items-center bg-gradient-to-r from-primary to-primary-dark">
                    <h6 className="text-lg font-semibold text-white">
                        Contact Details
                    </h6>
                    <button onClick={toggleDrawer(false)} className="text-white hover:bg-white/10 p-1 rounded-full transition-colors" >
                        <X size={20} />
                    </button>
                </div>

                {/* Profile Section */}
                <div className="p-6 flex flex-col items-center relative">
                    {/* Status indicator */}
                    <div className="absolute top-4 right-4 flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${onlineUsers.includes(selectedUser._id) ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-sm text-gray-500">
                            {onlineUsers.includes(selectedUser._id) ? 'Active now' : 'Offline'}
                        </span>
                    </div>

                    {/* Avatar */}
                    <div className="w-[140px] h-[140px] mb-6 rounded-full border-4 border-white shadow-md overflow-hidden">
                        <img src={selectedUser.profilePic || defaultImg} alt={selectedUser.fullName} className="w-full h-full object-cover" />
                    </div>

                    <h5 className="text-xl font-bold mb-1 text-center">
                        {selectedUser.fullName}
                    </h5>

                    {/* Email with copy */}
                    <div className="w-full px-3 py-1.5 rounded-lg transition-colors">
                        <div className="flex items-start">
                            <Mail size={18} className="text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 mb-0.5">Email</p>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-500 font-mono break-all">
                                        {selectedUser.email}
                                    </p>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedUser.email);
                                            toast.success('Email copied to clipboard');
                                        }}
                                        className="text-gray-400 hover:text-primary hover:bg-primary/10 p-1 rounded transition-colors"
                                    >
                                        <Copy size={16} className="cursor-pointer" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Social links */}
                    <div className="flex gap-3 mt-4">
                        <button className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors cursor-pointer">
                            <Phone size={18} />
                        </button>
                        <button className="p-2 rounded-full bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors cursor-pointer">
                            <Video size={18} />
                        </button>
                    </div>
                </div>
               

                {/* Divider */}
                <div className="px-6 relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-2 bg-white text-xs text-gray-500">ABOUT</span>
                    </div>
                </div>

                {/* Bio Section */}
                <div className="px-6 py-4">
                    <p className="text-sm text-gray-500">
                        {selectedUser.about || "Hey there! I'm using this awesome chatappey"}
                    </p>
                </div>

                {/* Details Section */}
                <div className="px-6 py-4 bg-gray-50/50 rounded-lg mx-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={18} className="text-gray-500" />
                        <h6 className="text-sm font-semibold text-gray-900">Details</h6>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Joined</p>
                            <p className="text-sm text-gray-900">
                                {new Date(selectedUser.createdAt).toLocaleDateString('en-GB')}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-gray-500 mb-1">Last Seen</p>
                            <div className="flex items-center gap-1">
                                {onlineUsers.includes(selectedUser._id) ? (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="text-sm text-gray-700">Online</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                                        <span className="text-sm text-gray-700">
                                            {formatLastSeen()}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-auto p-5 space-y-3">
                {blockedUsers.includes(selectedUser._id) ? (
                       <>
                        <div className="px-6 py-4 bg-red-50/50 rounded-lg mx-4 my-4 border border-red-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Ban size={18} className="text-red-500" />
                                <h6 className="text-sm font-semibold text-red-900">Blocked</h6>
                            </div>
                            <p className="text-sm text-red-700 mb-3">
                                You have blocked this user. They won't be able to send you messages.
                            </p>
                            <button 
                                onClick={handelUnblockUser(selectedUser._id)}
                                className="w-full py-2 px-4 rounded-lg bg-white text-red-500 font-medium hover:bg-red-100 transition-colors border border-red-200"
                            >
                                Unblock User
                            </button>
                        </div>
                       </>
                    ) : (
                        <button 
                            onClick={() => handelBlockUser(selectedUser._id)}
                            className="w-full py-3 px-4 rounded-lg border-2 border-red-500 text-red-500 font-medium hover:bg-red-50 transition-colors"
                        >
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