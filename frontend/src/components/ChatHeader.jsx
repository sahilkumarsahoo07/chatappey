import { Copy, Info, Mail, Phone, Star, Video, X, Ban, Link, Bell, Shield, ChevronRight } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import { useWebRTC } from "../hooks/useWebRTC";
import defaultImg from '../public/avatar.png'
import { Avatar, Button, Divider, Drawer, IconButton, ListItem, ListItemIcon, ListItemText, Typography, List, Dialog, DialogTitle, DialogContent, Grid } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";

const ChatHeader = () => {
    const { selectedUser, setSelectedUser, messages } = useChatStore();
    const { authUser, onlineUsers, getOneBlockedUser, blockUser, unblockUser, subscribeToBlockEvents } = useAuthStore();
    const { initiateCall } = useWebRTC();
    const { theme } = useThemeStore();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);

    // Filter shared media
    const allMedia = messages ? messages.filter(msg => msg.image).reverse() : [];
    const sharedMedia = allMedia.slice(0, 6);

    // Filter shared links
    const sharedLinks = messages ? messages.reduce((acc, msg) => {
        if (msg.text) {
            const links = msg.text.match(/(https?:\/\/[^\s]+)/g);
            if (links) acc.push(...links.map(link => ({ link, date: msg.createdAt })));
        }
        return acc;
    }, []).reverse().slice(0, 5) : [];

    useEffect(() => {
        const checkBlockedStatus = async () => {
            try {
                const data = await getOneBlockedUser();
                setIsBlocked(data.blockedUsers.some(user => user._id === selectedUser._id));
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
            setIsBlocked(true);
            await blockUser(userId);
        } catch (error) {
            setIsBlocked(false);
            console.error("Error blocking user:", error);
            toast.error(error.response?.data?.message || "Failed to block user");
        }
    };

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

                        <div className="relative">
                            <div className="size-11 md:size-12 rounded-full relative ring-2 ring-primary-content/30 overflow-hidden">
                                <img src={(selectedUser.hasBlockedMe || isBlocked) ? defaultImg : (selectedUser.profilePic || defaultImg)} alt={selectedUser.fullName} className="w-full h-full object-cover" />
                            </div>
                            {onlineUsers.includes(selectedUser._id) && !selectedUser.hasBlockedMe && !isBlocked && (
                                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-primary"></span>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className={`font-bold truncate text-base md:text-lg ${theme === 'light' ? 'text-gray-900' : 'text-primary-content'}`}>{selectedUser.fullName}</h3>
                            <p className={`text-xs md:text-sm truncate flex items-center gap-1.5 ${theme === 'light' ? 'text-gray-700' : 'text-primary-content opacity-90'}`}>
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

                    <div className="flex items-center gap-1 md:gap-2">
                        <button
                            onClick={() => initiateCall(selectedUser._id, selectedUser, 'audio')}
                            className={`p-2 md:p-2.5 rounded-xl hover:bg-opacity-10 transition-colors ${theme === 'light'
                                    ? 'text-gray-700 hover:bg-gray-200'
                                    : 'text-primary-content hover:bg-primary-content/10'
                                }`}
                            title="Voice Call"
                        >
                            <Phone size={18} className="md:w-5 md:h-5" />
                        </button>
                        <button
                            onClick={() => initiateCall(selectedUser._id, selectedUser, 'video')}
                            className={`p-2 md:p-2.5 rounded-xl hover:bg-opacity-10 transition-colors ${theme === 'light'
                                    ? 'text-gray-700 hover:bg-gray-200'
                                    : 'text-primary-content hover:bg-primary-content/10'
                                }`}
                            title="Video Call"
                        >
                            <Video size={18} className="md:w-5 md:h-5" />
                        </button>
                        <button
                            onClick={() => setSelectedUser(null)}
                            className={`hidden md:block p-2.5 rounded-xl hover:bg-opacity-10 transition-colors ${theme === 'light'
                                    ? 'text-gray-700 hover:bg-gray-200'
                                    : 'text-primary-content hover:bg-primary-content/10'
                                }`}
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
                PaperProps={{
                    className: "bg-base-100 text-base-content",
                    'data-theme': theme,
                    sx: {
                        width: { xs: '100%', sm: 400 },
                    }
                }}
            >
                <div className="h-full flex flex-col bg-base-100 text-base-content">
                    <div className="p-5 flex justify-between items-center bg-base-100 border-b border-base-200">
                        <h6 className="text-lg font-bold">
                            Contact Info
                        </h6>
                        <button onClick={toggleDrawer(false)} className="hover:bg-base-200 p-2 rounded-full transition-colors">
                            <X size={22} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-6 flex flex-col items-center relative bg-base-100">
                            {!isBlocked && !selectedUser.hasBlockedMe && (
                                <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm border border-base-200 ${onlineUsers.includes(selectedUser._id)
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-base-200 text-base-content/70'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${onlineUsers.includes(selectedUser._id) ? 'bg-green-500 animate-pulse' : 'bg-base-content/40'
                                        }`}></span>
                                    {onlineUsers.includes(selectedUser._id) ? 'Active' : 'Offline'}
                                </div>
                            )}

                            <div className="w-32 h-32 mb-5 rounded-full p-1 bg-base-200 border-4 border-base-200 shadow-xl overflow-hidden relative">
                                <div className="absolute inset-0 rounded-full border-2 border-primary/20 z-10"></div>
                                <img src={(selectedUser.hasBlockedMe || isBlocked) ? defaultImg : (selectedUser.profilePic || defaultImg)} alt={selectedUser.fullName} className="w-full h-full object-cover rounded-full" />
                            </div>

                            <h5 className="text-2xl font-bold mb-1 text-center">
                                {selectedUser.fullName}
                            </h5>

                            {/* Email with copy */}
                            <div className="w-full mt-4 px-4 py-3 rounded-xl bg-base-200/50 border border-base-200 hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="p-2.5 rounded-lg bg-base-100 text-primary overflow-hidden relative">
                                            <Mail size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium opacity-60 mb-0.5">Email</p>
                                            <p className="text-sm truncate font-medium">
                                                {selectedUser.email}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedUser.email);
                                            toast.success('Email copied!');
                                        }}
                                        className="p-2 rounded-lg hover:bg-base-300 text-primary transition-colors"
                                    >
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3 mt-5 w-full px-4">
                                <button
                                    onClick={() => {
                                        initiateCall(selectedUser._id, selectedUser, 'audio');
                                        setDrawerOpen(false);
                                    }}
                                    className="flex-1 p-3 rounded-xl bg-primary text-primary-content font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm active:scale-95 duration-200"
                                >
                                    <Phone size={18} />
                                    Call
                                </button>
                                <button
                                    onClick={() => {
                                        initiateCall(selectedUser._id, selectedUser, 'video');
                                        setDrawerOpen(false);
                                    }}
                                    className="flex-1 p-3 rounded-xl bg-base-100 text-base-content font-semibold hover:bg-base-200 transition-colors flex items-center justify-center gap-2 border border-base-300 shadow-sm active:scale-95 duration-200"
                                >
                                    <Video size={18} />
                                    Video
                                </button>
                            </div>
                        </div>

                        {/* About Section */}
                        <div className="px-6 py-4 bg-base-100 border-b border-base-200">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 rounded-lg bg-base-200 text-primary">
                                    <Info size={14} />
                                </div>
                                <h6 className="text-sm font-bold">About</h6>
                            </div>
                            <p className="text-sm opacity-80 leading-relaxed">
                                {selectedUser.about || "Hey there! I'm using ChatAppey 💬"}
                            </p>
                        </div>

                        {sharedMedia.length > 0 && (
                            <div className="px-6 py-4 bg-base-100 border-b border-base-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h6 className="text-sm font-bold flex items-center gap-2">
                                        <span>🖼️</span> Shared Media
                                    </h6>
                                    <button
                                        onClick={() => setMediaGalleryOpen(true)}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        View All
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {sharedMedia.map((msg) => (
                                        <div key={msg._id} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-base-300">
                                            <img src={msg.image} alt="Shared" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {sharedLinks.length > 0 && (
                            <div className="px-6 py-4 bg-base-100 border-b border-base-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h6 className="text-sm font-bold flex items-center gap-2">
                                        <Link size={16} /> Shared Links
                                    </h6>
                                    <button className="text-xs text-primary hover:underline">View All</button>
                                </div>
                                <div className="space-y-3">
                                    {sharedLinks.map((item, idx) => (
                                        <a href={item.link} key={idx} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors group">
                                            <div className="p-2 rounded-lg bg-base-200 group-hover:bg-base-300">
                                                <Link size={14} className="opacity-70" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-primary font-medium truncate">{item.link}</p>
                                                <p className="text-xs opacity-50">{new Date(item.date).toLocaleDateString()}</p>
                                            </div>
                                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="px-6 py-4 bg-base-100 border-b border-base-200">
                            <h6 className="text-sm font-bold mb-3">Chat Settings</h6>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-base-200">
                                        <Bell size={18} className="opacity-70" />
                                    </div>
                                    <span className="text-sm font-medium">Mute Notifications</span>
                                </div>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary toggle-sm"
                                    checked={isMuted}
                                    onChange={() => {
                                        setIsMuted(!isMuted);
                                        toast.success(!isMuted ? "Notifications muted" : "Notifications unmuted");
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between py-2 cursor-pointer hover:bg-base-100" onClick={() => toast("Encryption info verified 🔒")}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-base-200">
                                        <Shield size={18} className="opacity-70" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Encryption</span>
                                        <span className="text-xs text-green-500 flex items-center gap-1">
                                            Messages are end-to-end encrypted
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 py-4 m-4 bg-base-200/50 rounded-xl border border-base-300">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium opacity-60 mb-1">Member Since</p>
                                        <p className="text-sm font-semibold">
                                            {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-base-100">
                                        <Star size={16} className="text-yellow-500" />
                                    </div>
                                </div>

                                <div className="h-px bg-base-300"></div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium opacity-60 mb-1">Status</p>
                                        <div className="flex items-center gap-2">
                                            {(isBlocked || selectedUser.hasBlockedMe) ? (
                                                <>
                                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                    <span className="text-sm font-semibold opacity-70">Unavailable</span>
                                                </>
                                            ) : onlineUsers.includes(selectedUser._id) ? (
                                                <>
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="text-sm font-semibold text-green-500">Online</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                    <span className="text-sm font-semibold opacity-70">
                                                        {formatLastSeen()}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-3">
                            {isBlocked ? (
                                <div className="px-5 py-4 bg-error/10 rounded-xl border-2 border-error/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Ban size={18} className="text-error" />
                                        <h6 className="text-sm font-bold text-error">Blocked User</h6>
                                    </div>
                                    <p className="text-sm text-error/80 mb-3">
                                        You won't receive messages from this user.
                                    </p>
                                    <button
                                        onClick={() => handelUnblockUser(selectedUser._id)}
                                        className="w-full py-2.5 px-4 rounded-xl bg-base-100 text-error font-semibold hover:bg-base-200 transition-colors border-2 border-error/20"
                                    >
                                        Unblock User
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handelBlockUser(selectedUser._id)}
                                    className="w-full py-3 px-4 rounded-xl border-2 border-error text-error font-semibold hover:bg-error/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Ban size={18} />
                                    Block User
                                </button>
                            )}
                        </div>

                        <div className="p-4 flex flex-col items-center justify-center opacity-50 space-y-1 mb-2">
                            <Shield size={12} />
                            <p className="text-[10px] text-center max-w-[200px]">
                                Your personal messages are end-to-end encrypted. No one outside of this chat, not even ChatAppey, can read or listen to them.
                            </p>
                        </div>
                    </div>
                </div>
            </Drawer>

            <Dialog
                open={mediaGalleryOpen}
                onClose={() => setMediaGalleryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    className: "bg-base-100 text-base-content rounded-xl border border-base-300 m-4 max-h-[80vh]",
                    'data-theme': theme,
                    style: { backgroundColor: 'transparent', boxShadow: 'none' }
                }}
                slotProps={{
                    backdrop: {
                        className: "bg-black/60 backdrop-blur-sm"
                    }
                }}
            >
                <div className="bg-base-100 text-base-content p-0 overflow-hidden h-[80vh] flex flex-col">
                    <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200/50">
                        <h3 className="font-bold text-lg">Shared Media</h3>
                        <button
                            onClick={() => setMediaGalleryOpen(false)}
                            className="p-2 hover:bg-base-300 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {allMedia.map((msg) => (
                                <div key={msg._id} className="aspect-square rounded-lg overflow-hidden border border-base-300 relative group">
                                    <img src={msg.image} alt="Gallery" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm text-white transition-colors"
                                            onClick={() => window.open(msg.image, '_blank')}
                                            title="Open original"
                                        >
                                            <Link size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {allMedia.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-50 py-10">
                                <span className="text-4xl mb-2">🖼️</span>
                                <p>No shared media yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>
        </>
    );
};
export default ChatHeader;