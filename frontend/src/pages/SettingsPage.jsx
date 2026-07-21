import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import {
    Send, Camera, Edit, User, Mail, Info, Bell, Shield,
    Palette, Lock, Eye, Ban, Search, ChevronRight,
    Trash2, LogOut, Globe, MessageSquare, KeyRound
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import defaultImg from '../public/avatar.png';
import EmojiPicker from 'emoji-picker-react';
import { requestNotificationPermission, showBrowserNotification } from "../lib/notifications";
import toast from "react-hot-toast";
import { CHAT_WALLPAPERS, FONT_SIZES, BUBBLE_STYLES } from "../constants/appearance";
import { useNetworkStore } from "../store/useNetworkStore";
import { VIDEO_QUALITIES } from "../lib/mediaDelivery";
import { NetworkTier } from "../lib/network";
import "./SettingsPage.css";

const PREVIEW_MESSAGES = [
    { id: 1, content: "Hey! How's it going?", isSent: false },
    { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const SETTINGS_TABS = [
    { id: 'profile', label: 'Profile', icon: User, bg: '#00a884' },
    { id: 'appearance', label: 'Appearance', icon: Palette, bg: '#53bdeb' },
    { id: 'privacy', label: 'Privacy', icon: Eye, bg: '#25d366' },
    { id: 'security', label: 'Security', icon: Lock, bg: '#f7a931' },
    { id: 'notifications', label: 'Notifications', icon: Bell, bg: '#ff3b5c' },
    { id: 'account', label: 'Account', icon: Shield, bg: '#8696a0' },
];

const THEME_GROUPS = {
    "Classic": ["light", "dark", "cupcake", "bumblebee", "emerald", "corporate", "lofi", "winter", "nord"],
    "Dark Mode": ["black", "luxury", "dracula", "night", "coffee", "dim", "sunset", "forest", "abyss", "obsidian", "neon", "crimson", "matrix", "grape", "midnight", "hacker", "synth", "solarized"],
    "Colorful": ["synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden", "aqua", "pastel", "fantasy", "wireframe", "cmyk", "autumn", "business", "acid", "lemonade"]
};

const SettingsPage = () => {
    const { theme, setTheme } = useThemeStore();
    const { authUser, isUpdatingProfile, updateProfile, updateName, updateAbout, logout, logoutGlobal, getOneBlockedUser, unblockUser, changePassword, updatePrivacySettings, updateAppearanceSettings } = useAuthStore();
    const qualityMode = useNetworkStore((s) => s.qualityMode);
    const networkTier = useNetworkStore((s) => s.network?.tier);
    const setQualityMode = useNetworkStore((s) => s.setQualityMode);

    const [activeTab, setActiveTab] = useState('profile');
    const [searchTheme, setSearchTheme] = useState('');

    // Profile States
    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [editedName, setEditedName] = useState(authUser?.fullName || '');
    const [isEditAboutPopupOpen, setIsEditAboutPopupOpen] = useState(false);
    const [editedAbout, setEditedAbout] = useState(authUser?.about || '');

    // Privacy States
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

    // Security States
    const [showChangePass, setShowChangePass] = useState(false);
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [isUpdatingPass, setIsUpdatingPass] = useState(false);

    useEffect(() => {
        if (activeTab === 'privacy') {
            fetchBlockedUsers();
        }
    }, [activeTab]);

    const fetchBlockedUsers = async () => {
        setIsLoadingBlocked(true);
        try {
            const data = await getOneBlockedUser();
            setBlockedUsers(data.blockedUsers || []);
        } catch (error) {
            console.error("Error fetching blocked users", error);
        } finally {
            setIsLoadingBlocked(false);
        }
    };

    const handleUnblock = async (userId) => {
        try {
            await unblockUser(userId);
            fetchBlockedUsers();
        } catch (error) {
            console.error("Unblock failed", error);
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            return toast.error("New passwords do not match");
        }
        if (passwords.newPassword.length < 6) {
            return toast.error("Password must be at least 6 characters");
        }

        setIsUpdatingPass(true);
        try {
            const success = await changePassword({
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            if (success) {
                setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setShowChangePass(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsUpdatingPass(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result;
            await updateProfile({ profilePic: base64 });
        };
        reader.readAsDataURL(file);
    };

    const filteredThemes = useMemo(() => {
        if (!searchTheme) return THEMES;
        return THEMES.filter(t => t.toLowerCase().includes(searchTheme.toLowerCase()));
    }, [searchTheme]);

    const renderSidebar = () => (
        <aside className="settings-wa-sidebar">
            <div className="settings-wa-sidebar-title">Settings</div>
            {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`settings-wa-nav-item${activeTab === tab.id ? " is-active" : ""}`}
                    >
                        <span className="settings-wa-nav-icon" style={{ background: tab.bg }}>
                            <Icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
                        </span>
                        <span>{tab.label}</span>
                        <ChevronRight className="chev w-4 h-4" />
                    </button>
                );
            })}
        </aside>
    );

    const renderMobileTabs = () => (
        <nav className="settings-wa-tabs" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`settings-wa-tab${activeTab === tab.id ? " is-active" : ""}`}
                    >
                        <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                        {tab.label}
                    </button>
                );
            })}
        </nav>
    );

    const renderProfile = () => (
        <div className="animate-in fade-in duration-300">
            <div className="settings-wa-section-head md:block hidden">
                <h2>Profile</h2>
                <p>Manage how others see you</p>
            </div>

            <div className="settings-wa-profile-hero">
                <div className="settings-wa-avatar group">
                    <img src={authUser?.profilePic || defaultImg} alt={authUser?.fullName} />
                    <label htmlFor="avatar-upload" className="settings-wa-avatar-cam" title="Change photo">
                        {isUpdatingProfile ? (
                            <span className="loading loading-spinner loading-xs" />
                        ) : (
                            <Camera className="w-4 h-4" />
                        )}
                        <input
                            type="file"
                            id="avatar-upload"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={isUpdatingProfile}
                        />
                    </label>
                </div>
                <h3>{authUser?.fullName}</h3>
                <p className="about">{authUser?.about || "Hey there! I am using ChatAppey"}</p>
            </div>

            <p className="settings-wa-group-label">Your info</p>
            <div className="settings-wa-rows">
                <button
                    type="button"
                    className="settings-wa-row"
                    onClick={() => {
                        setEditedName(authUser?.fullName || "");
                        setIsEditPopupOpen(true);
                    }}
                >
                    <span className="settings-wa-row-icon" style={{ background: "#00a884" }}>
                        <User className="w-4 h-4" />
                    </span>
                    <span className="settings-wa-row-body">
                        <span className="title block">Name</span>
                        <span className="sub block">{authUser?.fullName}</span>
                    </span>
                    <Edit className="chev w-4 h-4" />
                </button>

                <div className="settings-wa-row" role="group">
                    <span className="settings-wa-row-icon" style={{ background: "#53bdeb" }}>
                        <Mail className="w-4 h-4" />
                    </span>
                    <span className="settings-wa-row-body">
                        <span className="title block">Email</span>
                        <span className="sub block">{authUser?.email}</span>
                    </span>
                    <Lock className="chev w-4 h-4" />
                </div>

                <button
                    type="button"
                    className="settings-wa-row"
                    onClick={() => {
                        setEditedAbout(authUser?.about || "");
                        setIsEditAboutPopupOpen(true);
                    }}
                >
                    <span className="settings-wa-row-icon" style={{ background: "#8696a0" }}>
                        <Info className="w-4 h-4" />
                    </span>
                    <span className="settings-wa-row-body">
                        <span className="title block">About</span>
                        <span className="sub block">
                            {authUser?.about || "Hey there! I am using ChatAppey"}
                        </span>
                    </span>
                    <Edit className="chev w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const renderAppearance = () => (
        <div className="space-y-4 animate-in fade-in duration-300 px-1">
            <div className="settings-wa-section-head !px-0">
                <h2>Appearance</h2>
                <p>Themes, wallpaper, and chat look</p>
            </div>

            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
                <input
                    type="text"
                    placeholder="Search themes"
                    value={searchTheme}
                    onChange={(e) => setSearchTheme(e.target.value)}
                    className="input input-bordered w-full pl-11 h-11 rounded-xl bg-base-200/60 border-base-300 focus:border-[#008069] focus:outline-none text-sm"
                />
            </div>

            <div className="space-y-10 pb-6">
                {Object.entries(THEME_GROUPS).map(([category, members]) => {
                    const filteredMembers = members.filter(m => filteredThemes.includes(m));
                    if (filteredMembers.length === 0) return null;

                    return (
                        <div key={category} className="space-y-3">
                            <h3 className="settings-wa-group-label !px-0 !pt-0">{category}</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
                                {filteredMembers.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTheme(t)}
                                        className={`group relative flex flex-col gap-1.5 p-1.5 rounded-xl transition-all border-2 ${theme === t
                                            ? "border-[#008069] bg-[#008069]/10"
                                            : "border-transparent bg-base-200/40 hover:bg-base-200"
                                            }`}
                                    >
                                        <div className="relative aspect-square w-full rounded-lg overflow-hidden" data-theme={t}>
                                            <div className="absolute inset-0 bg-base-100"></div>
                                            <div className="absolute inset-0 grid grid-cols-2 gap-0.5 p-1.5">
                                                <div className="rounded-md bg-primary"></div>
                                                <div className="rounded-md bg-secondary"></div>
                                                <div className="rounded-md bg-accent"></div>
                                                <div className="rounded-md bg-neutral"></div>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-semibold truncate text-center ${theme === t ? "text-[#008069]" : "text-base-content/70"}`}>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Chat Wallpaper Section */}
            <div className="pt-8 border-t border-base-300 space-y-4">
                <div className="flex flex-col gap-0.5 px-1">
                    <h3 className="text-base font-black tracking-tight">Chat Background</h3>
                    <p className="text-[10px] text-base-content/50 font-medium">Customize your chat background</p>
                </div>

                {/* Solid Colors */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 pl-2">Solid Colors</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {CHAT_WALLPAPERS.solid.map((wallpaper) => (
                            <button
                                key={wallpaper.id}
                                onClick={() => updateAppearanceSettings({ chatBackground: wallpaper.value })}
                                className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all ${authUser?.chatBackground === wallpaper.value
                                    ? 'border-primary shadow-lg scale-105'
                                    : 'border-base-300 hover:border-primary/50 hover:scale-102'
                                    }`}
                                style={{ background: wallpaper.preview }}
                            >
                                {authUser?.chatBackground === wallpaper.value && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <ChevronRight className="w-4 h-4 text-white rotate-90" />
                                    </div>
                                )}
                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-white bg-black/40 px-2 py-0.5 rounded-full">{wallpaper.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Gradients */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 pl-2">Gradients</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {CHAT_WALLPAPERS.gradients.map((wallpaper) => (
                            <button
                                key={wallpaper.id}
                                onClick={() => updateAppearanceSettings({ chatBackground: wallpaper.value })}
                                className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all ${authUser?.chatBackground === wallpaper.value
                                    ? 'border-primary shadow-lg scale-105'
                                    : 'border-base-300 hover:border-primary/50 hover:scale-102'
                                    }`}
                                style={{ background: wallpaper.preview }}
                            >
                                {authUser?.chatBackground === wallpaper.value && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <ChevronRight className="w-5 h-5 text-white rotate-90" />
                                    </div>
                                )}
                                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-white bg-black/40 px-3 py-1 rounded-full">{wallpaper.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Font Size & Bubble Style */}
            <div className="pt-8 border-t border-base-300 space-y-6">
                <div className="space-y-4">
                    <div className="flex flex-col gap-0.5 px-1">
                        <h3 className="text-base font-black tracking-tight">Text Size</h3>
                        <p className="text-[10px] text-base-content/50 font-medium">Adjust message text size</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {FONT_SIZES.map((size) => (
                            <button
                                key={size.id}
                                onClick={() => updateAppearanceSettings({ fontSize: size.value })}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${authUser?.fontSize === size.value
                                    ? 'border-primary bg-primary/10 shadow-md'
                                    : 'border-base-300 hover:border-primary/30 bg-base-100'
                                    }`}
                            >
                                <p className={`font-black tracking-tight mb-1 ${authUser?.fontSize === size.value ? 'text-primary' : ''}`}>{size.name}</p>
                                <p className="text-[9px] text-base-content/50 font-medium">{size.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col gap-0.5 px-1">
                        <h3 className="text-base font-black tracking-tight">Message Bubble Style</h3>
                        <p className="text-[10px] text-base-content/50 font-medium">Choose your preferred corner style</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {BUBBLE_STYLES.map((style) => (
                            <button
                                key={style.id}
                                onClick={() => updateAppearanceSettings({ bubbleStyle: style.value })}
                                className={`p-4 rounded-xl border-2 transition-all ${authUser?.bubbleStyle === style.value
                                    ? 'border-primary bg-primary/10 shadow-md'
                                    : 'border-base-300 hover:border-primary/30 bg-base-100'
                                    }`}
                            >
                                <div className="flex items-center justify-center mb-2">
                                    <div
                                        className={`w-16 h-10 bg-primary/20 ${authUser?.bubbleStyle === style.value ? 'bg-primary/40' : ''}`}
                                        style={{ borderRadius: style.borderRadius }}
                                    ></div>
                                </div>
                                <p className={`text-sm font-black ${authUser?.bubbleStyle === style.value ? 'text-primary' : ''}`}>{style.name}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4">
                <div className="flex flex-col gap-0.5 px-1">
                    <h3 className="text-base font-black tracking-tight">Video quality</h3>
                    <p className="text-[10px] text-base-content/50 font-medium">
                        Auto adapts to your network ({networkTier || NetworkTier.UNKNOWN})
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setQualityMode("auto")}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${
                          qualityMode === "auto"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-base-300"
                        }`}
                    >
                        Auto
                    </button>
                    {VIDEO_QUALITIES.map((q) => (
                        <button
                            key={q}
                            type="button"
                            onClick={() => setQualityMode(q)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 ${
                              qualityMode === q
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-base-300"
                            }`}
                        >
                            {q}p
                        </button>
                    ))}
                </div>
            </div>

            <div className="pt-8 border-t border-base-300">
                <div className="flex items-center justify-between mb-6 px-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-xl"><Eye className="w-4 h-4 text-primary" /></div>
                        <div>
                            <h3 className="text-base font-black tracking-tight">Real-time Preview</h3>
                            <p className="text-[9px] text-base-content/50 font-medium">See how your theme looks in action</p>
                        </div>
                    </div>
                </div>
                <div className="bg-base-300/30 rounded-[3rem] p-6 lg:p-12" data-theme={theme}>
                    <div className="max-w-md mx-auto bg-base-100 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden border border-base-300 animate-in zoom-in-95 duration-700">
                        {/* Mock Chat UI */}
                        <div className="px-5 py-3 border-b border-base-300 flex items-center gap-3 bg-base-100/80 backdrop-blur-xl">
                            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-content font-black shadow-lg shadow-primary/20 text-sm">SK</div>
                            <div className="flex-1">
                                <p className="text-sm font-black tracking-tight">Sahil Kumar Sahoo</p>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                    <p className="text-[8px] text-base-content/50 font-black uppercase tracking-widest">Active Now</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4 h-56 overflow-y-auto bg-base-100/50 scrollbar-none">
                            {PREVIEW_MESSAGES.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.isSent ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] rounded-xl px-4 py-2 shadow-sm ${msg.isSent ? "bg-primary text-primary-content rounded-tr-none shadow-primary/10" : "bg-base-200 text-base-content rounded-tl-none"
                                        }`}>
                                        <p className="text-xs font-medium">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-base-300 bg-base-100/80 backdrop-blur-xl">
                            <div className="flex gap-2">
                                <div className="flex-1 h-10 px-4 rounded-xl bg-base-200 flex items-center text-xs text-base-content/40 font-bold italic tracking-tight">Type something...</div>
                                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-content shadow-lg shadow-primary/20"><Send size={16} className="ml-0.5" /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPrivacy = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="settings-wa-section-head !px-0">
                <h2>Privacy</h2>
                <p>Control who can see your info</p>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-md rounded-[1.5rem] overflow-hidden">
                <div className="divide-y divide-base-300">
                    <div className="p-4 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black tracking-tight group-hover:text-primary transition-colors">Read Receipts</p>
                            <p className="text-[9px] text-base-content/50 font-medium max-w-xs">Hide the blue ticks when you view messages.</p>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle toggle-primary toggle-sm"
                            checked={authUser?.privacyReadReceipts !== false}
                            onChange={(e) => updatePrivacySettings({ privacyReadReceipts: e.target.checked })}
                        />
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black tracking-tight group-hover:text-primary transition-colors">Last Seen Status</p>
                            <p className="text-[9px] text-base-content/50 font-medium max-w-xs">Show or hide when you were last online.</p>
                        </div>
                        <select
                            className="select select-bordered select-xs rounded-lg font-bold bg-base-200 border-none focus:ring-4 focus:ring-primary/10 transition-all"
                            value={authUser?.privacyLastSeen || "everyone"}
                            onChange={(e) => updatePrivacySettings({ privacyLastSeen: e.target.value.toLowerCase().replace(" ", "") })}
                        >
                            <option value="everyone">Everyone</option>
                            <option value="contacts">My Contacts</option>
                            <option value="none">Only Me</option>
                        </select>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black tracking-tight group-hover:text-primary transition-colors">Profile Picture</p>
                            <p className="text-[9px] text-base-content/50 font-medium max-w-xs">Control who can see your profile photo.</p>
                        </div>
                        <select
                            className="select select-bordered select-xs rounded-lg font-bold bg-base-200 border-none focus:ring-4 focus:ring-primary/10 transition-all"
                            value={authUser?.privacyProfilePic || "everyone"}
                            onChange={(e) => updateAppearanceSettings({ privacyProfilePic: e.target.value })}
                        >
                            <option value="everyone">Everyone</option>
                            <option value="contacts">My Contacts</option>
                            <option value="none">Only Me</option>
                        </select>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black tracking-tight group-hover:text-primary transition-colors">About & Bio</p>
                            <p className="text-[9px] text-base-content/50 font-medium max-w-xs">Control who can view your about section.</p>
                        </div>
                        <select
                            className="select select-bordered select-xs rounded-lg font-bold bg-base-200 border-none focus:ring-4 focus:ring-primary/10 transition-all"
                            value={authUser?.privacyAbout || "everyone"}
                            onChange={(e) => updateAppearanceSettings({ privacyAbout: e.target.value })}
                        >
                            <option value="everyone">Everyone</option>
                            <option value="contacts">My Contacts</option>
                            <option value="none">Only Me</option>
                        </select>
                    </div>

                    {/* Admin Only Incognito Mode */}
                    {authUser?.role === "admin" && (
                        <div className="p-4 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group animate-in slide-in-from-left-2 duration-700 delay-100 border-l-4 border-l-red-500/50 bg-red-500/5">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-black tracking-tight group-hover:text-red-500 transition-colors">Incognito Mode</p>
                                    <span className="badge badge-error badge-xs font-bold text-white tracking-tighter">ADMIN</span>
                                </div>
                                <p className="text-[9px] text-base-content/50 font-medium max-w-xs">
                                    Become invisible. You will appear offline and messages you read will stay as "Sent".
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                className="toggle toggle-error toggle-sm"
                                checked={authUser?.isIncognito || false}
                                onChange={async () => {
                                    await useAuthStore.getState().updateIncognito();
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-md p-5 rounded-[1.5rem] space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-2 bg-red-500/10 rounded-xl"><Ban className="w-4 h-4 text-red-500" /></div>
                    <div>
                        <h3 className="text-base font-black tracking-tight">Blocked Users</h3>
                        <p className="text-[10px] text-base-content/50 font-medium">People you've restricted from contacting you</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isLoadingBlocked ? (
                        <div className="col-span-full flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary"></span></div>
                    ) : blockedUsers.length > 0 ? (
                        blockedUsers.map(user => (
                            <div key={user._id} className="flex items-center justify-between p-4 bg-base-200/50 rounded-3xl border border-transparent hover:border-red-500/20 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img src={user.profilePic || defaultImg} className="w-12 h-12 rounded-2xl bg-base-300 object-cover shadow-sm" alt="" />
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-base-200"></div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black tracking-tight group-hover:text-red-500 transition-colors">{user.fullName}</p>
                                        <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest">{user.email?.split('@')[0]}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleUnblock(user._id)} className="btn btn-ghost btn-sm text-red-500 font-black hover:bg-red-500/10 rounded-xl">Unblock</button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-16 bg-base-200/30 rounded-[2rem] border-4 border-dashed border-base-300">
                            <div className="p-5 bg-base-100 w-fit mx-auto rounded-3xl shadow-xl mb-4 text-base-content/10"><Ban className="w-12 h-12" /></div>
                            <p className="text-lg font-black text-base-content/20 tracking-tight">Your block list is empty</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSecurity = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="settings-wa-section-head !px-0">
                <h2>Security</h2>
                <p>Password and account protection</p>
            </div>

            <div className={`card bg-base-100 border border-base-300 shadow-md p-5 rounded-[1.5rem] transition-all duration-500 ${showChangePass ? 'ring-2 ring-primary/10 border-primary/30' : ''}`}>
                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setShowChangePass(!showChangePass)}>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-500/10 rounded-xl group-hover:scale-110 transition-transform duration-500">
                            <KeyRound className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm font-black tracking-tight group-hover:text-orange-500 transition-colors">Update Password</p>
                            <p className="text-[9px] text-base-content/50 font-medium">Last updated: Never</p>
                        </div>
                    </div>
                    <div className={`p-1 rounded-lg transition-all ${showChangePass ? 'bg-orange-500 text-white rotate-90 shadow-md' : 'bg-base-200'}`}>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                </div>

                {showChangePass && (
                    <form onSubmit={handleChangePassword} className="mt-8 space-y-5 pt-8 border-t border-base-200 animate-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="form-control sm:col-span-2">
                                <label className="label"><span className="label-text font-black uppercase tracking-widest text-[10px] text-base-content/40">Current Password</span></label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.currentPassword}
                                    onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                                    placeholder="••••••••••••"
                                    className="input input-bordered h-14 rounded-2xl bg-base-200 border-none focus:ring-4 focus:ring-orange-500/10 transition-all font-bold tracking-widest"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text font-black uppercase tracking-widest text-[10px] text-base-content/40">New Password</span></label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.newPassword}
                                    onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    placeholder="••••••••••••"
                                    className="input input-bordered h-14 rounded-2xl bg-base-200 border-none focus:ring-4 focus:ring-orange-500/10 transition-all font-bold tracking-widest"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text font-black uppercase tracking-widest text-[10px] text-base-content/40">Confirm New Password</span></label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.confirmPassword}
                                    onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    placeholder="••••••••••••"
                                    className="input input-bordered h-14 rounded-2xl bg-base-200 border-none focus:ring-4 focus:ring-orange-500/10 transition-all font-bold tracking-widest"
                                />
                            </div>
                        </div>
                        <button
                            disabled={isUpdatingPass}
                            className="btn btn-primary h-11 w-full rounded-xl mt-2 shadow-lg shadow-primary/20 text-sm font-black tracking-tight"
                        >
                            {isUpdatingPass ? <span className="loading loading-spinner loading-xs"></span> : "Update Password"}
                        </button>
                    </form>
                )}
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-md p-5 rounded-[1.5rem] group hover:border-blue-500/30 transition-all duration-500">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:rotate-12 transition-transform duration-500">
                            <Shield className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm font-black tracking-tight">Two-Factor Auth</p>
                            <p className="text-[9px] text-base-content/50 font-medium">OTP verification for logins</p>
                        </div>
                    </div>
                    <div className="badge badge-xs bg-base-200 border-none text-base-content/30 font-black tracking-tighter rounded-md mr-1">BETA</div>
                </div>
            </div>
        </div>
    );

    const renderNotifications = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="settings-wa-section-head !px-0">
                <h2>Notifications</h2>
                <p>Message alerts and sounds</p>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-md rounded-[1.5rem] overflow-hidden">
                <div className="p-6 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border-b border-base-300 flex flex-col lg:flex-row items-center gap-4 text-center lg:text-left">
                    <div className="w-16 h-16 bg-base-100 rounded-2xl shadow-lg flex items-center justify-center text-red-500 shrink-0 ring-4 ring-red-500/5 rotate-3">
                        <Bell className="w-7 h-7" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                        <h3 className="text-base font-black tracking-tight">App Notifications</h3>
                        <p className="text-[10px] text-base-content/50 font-medium max-w-md">
                          WhatsApp-style alerts on phone &amp; desktop — even when the app is closed. iPhone: install to Home Screen first.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => showBrowserNotification("Test Notification", { body: "This is a test notification from ChatAppey", url: "/" })} className="btn btn-ghost btn-xs font-black text-red-500 hover:bg-red-500/10 px-3 rounded-lg tracking-tighter">Run Test</button>
                        <button onClick={async () => {
                            const granted = await requestNotificationPermission({ showTest: true });
                            if (granted) toast.success("Welcome aboard! Alerts enabled."); else toast.error("Bummer! Permission denied.");
                        }} className="btn btn-primary btn-sm rounded-xl shadow-md shadow-primary/20 font-black px-4">Enable Alerts</button>
                    </div>
                </div>
                <div className="divide-y divide-base-300">
                    <div className="p-5 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black tracking-tight group-hover:text-primary transition-colors">Message Audio</p>
                            <p className="text-[10px] text-base-content/50 font-medium max-w-xs">Play a pop sound for messages.</p>
                        </div>
                        <input type="checkbox" className="toggle toggle-success toggle-sm" defaultChecked />
                    </div>
                    <div className="p-5 flex items-center justify-between hover:bg-base-200/40 transition-all duration-300 group">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black tracking-tight group-hover:text-primary transition-colors">Activity Banners</p>
                            <p className="text-[10px] text-base-content/50 font-medium max-w-xs">Show popups when friends start typing.</p>
                        </div>
                        <input type="checkbox" className="toggle toggle-success toggle-sm" defaultChecked />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAccount = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1 px-1">
                <h2 className="text-2xl font-black tracking-tighter">Account</h2>
                <p className="text-xs text-base-content/60 font-medium">Core account settings and data management</p>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-xl rounded-[2.5rem] overflow-hidden divide-y divide-base-300">
                <div className="p-8 hover:bg-base-200/20 transition-all duration-300 group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl"><Globe className="w-5 h-5 text-blue-500" /></div>
                        <h3 className="text-lg font-black tracking-tight group-hover:text-blue-500 transition-colors">Export Identity</h3>
                    </div>
                    <p className="text-xs text-base-content/50 font-medium mb-6 leading-relaxed">Instantly download an archival JSON copy of your entire chat history, contacts, and personal profile metadata for safe keeping.</p>
                    <button className="btn btn-outline btn-sm rounded-xl font-black gap-2 px-6 border-2 hover:bg-blue-500 hover:border-blue-500 hover:text-white transition-all"><Globe className="w-4 h-4" /> Download My Data</button>
                </div>
                <div className="p-6 bg-red-500/5 relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none"><Trash2 className="w-24 h-24 text-red-500" /></div>
                    <h3 className="text-lg font-black text-red-500 tracking-tighter mb-1">The Danger Zone</h3>
                    <p className="text-[10px] text-base-content/50 font-medium mb-6 max-w-lg leading-relaxed">Permanent deletion is irreversible. Your data will be purged within 24 hours.</p>
                    <div className="flex flex-wrap gap-2 relative z-10">
                        <button onClick={logoutGlobal} className="btn btn-ghost btn-xs font-black text-base-content gap-2 hover:bg-base-200 px-4 rounded-lg tracking-tighter"><LogOut className="w-3.5 h-3.5" /> Sign Out Globally</button>
                        <button className="btn btn-error btn-xs font-black gap-2 px-5 rounded-lg shadow-lg shadow-red-500/20 tracking-tighter"><Trash2 className="w-3.5 h-3.5" /> Destroy Account</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="settings-wa pl-0 md:pl-20">
            <div className="settings-wa-shell">
                <header className="settings-wa-topbar">
                    <h1>Settings</h1>
                </header>

                {renderMobileTabs()}

                <div className="settings-wa-layout">
                    {renderSidebar()}

                    <div className="settings-wa-main">
                        <div className="settings-wa-panel">
                            {activeTab === 'profile' && renderProfile()}
                            {activeTab === 'appearance' && renderAppearance()}
                            {activeTab === 'privacy' && renderPrivacy()}
                            {activeTab === 'security' && renderSecurity()}
                            {activeTab === 'notifications' && renderNotifications()}
                            {activeTab === 'account' && renderAccount()}
                        </div>
                    </div>
                </div>
            </div>

            {isEditPopupOpen && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-[200] p-0 sm:p-6">
                    <div className="bg-base-100 rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md shadow-2xl border border-base-300">
                        <h3 className="text-lg font-bold tracking-tight mb-4 text-[#008069]">Edit name</h3>
                        <div className="relative mb-5">
                            <input
                                type="text"
                                value={editedName}
                                autoFocus
                                onChange={(e) => setEditedName(e.target.value)}
                                className="input input-bordered w-full h-12 rounded-xl pr-14 bg-base-200 border-none focus:outline-none focus:ring-2 focus:ring-[#008069]/30"
                                placeholder="Your name"
                            />
                            <button
                                type="button"
                                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle text-xl"
                            >
                                😊
                            </button>
                        </div>
                        {isEmojiPickerOpen && (
                            <div className="mb-5 rounded-2xl overflow-hidden border border-base-300">
                                <EmojiPicker onEmojiClick={(e) => setEditedName(p => p + e.emoji)} width="100%" height={300} searchDisabled />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { setIsEditPopupOpen(false); setIsEmojiPickerOpen(false); }}
                                className="btn btn-ghost flex-1 rounded-xl font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => { await updateName(editedName); setIsEditPopupOpen(false); }}
                                className="btn flex-[1.4] rounded-xl font-semibold text-white border-none bg-[#008069] hover:bg-[#006e5a]"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isEditAboutPopupOpen && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-[200] p-0 sm:p-6">
                    <div className="bg-base-100 rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md shadow-2xl border border-base-300">
                        <h3 className="text-lg font-bold tracking-tight mb-4 text-[#008069]">About</h3>
                        <textarea
                            value={editedAbout}
                            autoFocus
                            onChange={(e) => setEditedAbout(e.target.value)}
                            className="textarea textarea-bordered w-full h-32 rounded-xl mb-5 text-sm bg-base-200 border-none focus:outline-none focus:ring-2 focus:ring-[#008069]/30 resize-none"
                            placeholder="Hey there! I am using ChatAppey"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsEditAboutPopupOpen(false)}
                                className="btn btn-ghost flex-1 rounded-xl font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => { await updateAbout(editedAbout); setIsEditAboutPopupOpen(false); }}
                                className="btn flex-[1.4] rounded-xl font-semibold text-white border-none bg-[#008069] hover:bg-[#006e5a]"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;