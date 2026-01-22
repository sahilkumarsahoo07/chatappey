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

const PREVIEW_MESSAGES = [
    { id: 1, content: "Hey! How's it going?", isSent: false },
    { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const SETTINGS_TABS = [
    { id: 'profile', label: 'Profile', icon: User, color: 'text-blue-500' },
    { id: 'appearance', label: 'Appearance', icon: Palette, color: 'text-purple-500' },
    { id: 'privacy', label: 'Privacy', icon: Eye, color: 'text-green-500' },
    { id: 'security', label: 'Security', icon: Lock, color: 'text-orange-500' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-red-500' },
    { id: 'account', label: 'Account', icon: Shield, color: 'text-gray-500' },
];

const THEME_GROUPS = {
    "Classic": ["light", "dark", "cupcake", "bumblebee", "emerald", "corporate", "lofi", "winter", "nord"],
    "Dark Mode": ["black", "luxury", "dracula", "night", "coffee", "dim", "sunset", "forest"],
    "Colorful": ["synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden", "aqua", "pastel", "fantasy", "wireframe", "cmyk", "autumn", "business", "acid", "lemonade"]
};

const SettingsPage = () => {
    const { theme, setTheme } = useThemeStore();
    const { authUser, isUpdatingProfile, updateProfile, updateName, updateAbout, logout, logoutGlobal, getOneBlockedUser, unblockUser, changePassword, updatePrivacySettings, updateAppearanceSettings } = useAuthStore();

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
        <div className="w-full md:w-64 flex flex-col gap-2 p-4 bg-base-100 rounded-3xl border border-base-300 shadow-sm h-fit sticky top-8">
            <div className="px-2 mb-4 mt-1">
                <h1 className="text-lg font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Settings</h1>
            </div>
            {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${activeTab === tab.id
                            ? "bg-primary text-primary-content shadow-md shadow-primary/20 translate-x-1"
                            : "hover:bg-base-200 text-base-content/70 hover:text-base-content"
                            }`}
                    >
                        <Icon className={`w-5 h-5 ${activeTab === tab.id ? "text-primary-content" : tab.color}`} />
                        <span className="font-bold text-sm tracking-tight">{tab.label}</span>
                        {activeTab === tab.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </button>
                );
            })}
        </div>
    );

    const renderProfile = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-lg font-black tracking-tighter">Profile</h2>
                <p className="text-[10px] text-base-content/60 font-medium">Manage how other users see you in the app</p>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden rounded-[2.5rem]">
                <div className="h-32 bg-gradient-to-br from-primary/40 via-secondary/40 to-accent/40 relative">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                </div>
                <div className="px-8 pb-10 -mt-16 relative">
                    <div className="flex flex-col sm:flex-row items-end gap-6 mb-10">
                        <div className="relative group">
                            <div className="avatar">
                                <div className="w-40 h-40 rounded-[2rem] ring-[12px] ring-base-100 shadow-2xl overflow-hidden transition-transform group-hover:scale-95 duration-500">
                                    <img src={authUser?.profilePic || defaultImg} alt={authUser?.fullName} className="object-cover w-full h-full" />
                                </div>
                            </div>
                            <label
                                htmlFor="avatar-upload"
                                className={`absolute inset-0 flex items-center justify-center bg-black/60 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all duration-500 cursor-pointer overflow-hidden backdrop-blur-sm
                                ${isUpdatingProfile ? "opacity-100" : ""}`}
                            >
                                <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                                <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUpdatingProfile} />
                            </label>
                            {isUpdatingProfile && (
                                <div className="absolute -bottom-2 -right-2 bg-primary text-primary-content p-2 rounded-xl shadow-xl animate-bounce">
                                    <span className="loading loading-spinner loading-xs"></span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 pb-2 text-center sm:text-left">
                            <h3 className="text-xl font-black tracking-tight mb-0.5">{authUser?.fullName}</h3>
                            <div className="flex items-center justify-center sm:justify-start gap-1.5">
                                <span className="badge badge-primary font-bold px-2 py-1 rounded-md text-[9px] h-fit">Online</span>
                                <p className="text-base-content/50 font-bold text-[10px] tracking-wide">{authUser?.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 bg-base-200/50 rounded-2xl space-y-2 group border border-transparent hover:border-primary/20 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-500/10 rounded-lg"><User className="w-3.5 h-3.5 text-blue-500" /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-base-content/40">Full Name</span>
                                </div>
                                <button onClick={() => { setEditedName(authUser?.fullName || ''); setIsEditPopupOpen(true); }} className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary">
                                    <Edit className="w-3 h-3" />
                                </button>
                            </div>
                            <p className="text-sm font-black tracking-tight pl-1">{authUser?.fullName}</p>
                        </div>
                        <div className="p-4 bg-base-200/50 rounded-2xl space-y-2 group border border-transparent hover:border-orange-500/20 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-orange-500/10 rounded-lg"><Mail className="w-3.5 h-3.5 text-orange-500" /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-base-content/40">Email Address</span>
                                </div>
                                <Lock className="w-3.5 h-3.5 text-base-content/20" />
                            </div>
                            <p className="text-sm font-black tracking-tight text-base-content/50 pl-1">{authUser?.email}</p>
                        </div>
                        <div className="p-4 bg-base-200/50 rounded-2xl space-y-2 group md:col-span-2 border border-transparent hover:border-purple-500/20 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-500/10 rounded-lg"><Info className="w-3.5 h-3.5 text-purple-500" /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-base-content/40">About Me</span>
                                </div>
                                <button onClick={() => { setEditedAbout(authUser?.about || ''); setIsEditAboutPopupOpen(true); }} className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary">
                                    <Edit className="w-3 h-3" />
                                </button>
                            </div>
                            <p className="text-[11px] text-base-content/70 font-medium leading-relaxed pl-1 italic">
                                {authUser?.about || "Describe who you are..."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAppearance = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-lg font-black tracking-tighter">Appearance</h2>
                <p className="text-[10px] text-base-content/60 font-medium">Personalize your chat experience with vibrant themes</p>
            </div>

            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Search for themes..."
                    value={searchTheme}
                    onChange={(e) => setSearchTheme(e.target.value)}
                    className="input input-bordered w-full pl-11 h-10 rounded-xl bg-base-100 border-base-300 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-xs font-bold"
                />
            </div>

            <div className="space-y-12 pb-10">
                {Object.entries(THEME_GROUPS).map(([category, members]) => {
                    const filteredMembers = members.filter(m => filteredThemes.includes(m));
                    if (filteredMembers.length === 0) return null;

                    return (
                        <div key={category} className="space-y-5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-base-content/40 pl-2">{category}</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                                {filteredMembers.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTheme(t)}
                                        className={`group relative flex flex-col gap-1.5 p-1.5 rounded-xl transition-all duration-500 border-2 ${theme === t
                                            ? "border-primary bg-primary/10 shadow-md scale-102"
                                            : "border-transparent bg-base-100 hover:bg-base-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                            }`}
                                    >
                                        <div className="relative aspect-[1/1] w-full rounded-lg overflow-hidden shadow-inner" data-theme={t}>
                                            <div className="absolute inset-0 bg-base-100"></div>
                                            <div className="absolute inset-0 grid grid-cols-2 gap-0.5 p-1.5">
                                                <div className="rounded-md bg-primary shadow-sm"></div>
                                                <div className="rounded-md bg-secondary shadow-sm"></div>
                                                <div className="rounded-md bg-accent shadow-sm"></div>
                                                <div className="rounded-md bg-neutral shadow-sm"></div>
                                            </div>
                                            {theme === t && (
                                                <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in zoom-in duration-300">
                                                    <div className="bg-primary text-primary-content p-1 rounded-full shadow-lg ring-1 ring-white/20">
                                                        <ChevronRight className="w-3 h-3 rotate-90" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-[9px] font-black truncate text-center px-0.5 tracking-tight ${theme === t ? "text-primary" : "text-base-content/70"}`}>
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
            <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-lg font-black tracking-tighter">Privacy</h2>
                <p className="text-[10px] text-base-content/60 font-medium">Take full control over your digital footprint</p>
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
            <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-lg font-black tracking-tighter">Security</h2>
                <p className="text-[10px] text-base-content/60 font-medium">Advanced protection for your personal account</p>
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
            <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-lg font-black tracking-tighter">Notifications</h2>
                <p className="text-[10px] text-base-content/60 font-medium">Don't miss a single beat of the conversation</p>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-md rounded-[1.5rem] overflow-hidden">
                <div className="p-6 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border-b border-base-300 flex flex-col lg:flex-row items-center gap-4 text-center lg:text-left">
                    <div className="w-16 h-16 bg-base-100 rounded-2xl shadow-lg flex items-center justify-center text-red-500 shrink-0 ring-4 ring-red-500/5 rotate-3">
                        <Bell className="w-7 h-7" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                        <h3 className="text-base font-black tracking-tight">App Notifications</h3>
                        <p className="text-[10px] text-base-content/50 font-medium max-w-md">Enable system-wide desktop alerts.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => showBrowserNotification("Test Notification", { body: "This is a test notification from ChatAppey" })} className="btn btn-ghost btn-xs font-black text-red-500 hover:bg-red-500/10 px-3 rounded-lg tracking-tighter">Run Test</button>
                        <button onClick={async () => {
                            const granted = await requestNotificationPermission();
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
        <div className="min-h-screen pl-0 md:pl-20 pb-20 md:pb-10 bg-base-200/40 selection:bg-primary selection:text-primary-content">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Desktop Sidebar */}
                    <div className="hidden md:block">
                        {renderSidebar()}
                    </div>

                    {/* Mobile Navigation */}
                    <div className="md:hidden w-full flex overflow-x-auto gap-2 pb-4 scrollbar-none snap-x mask-fade-right">
                        {SETTINGS_TABS.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl snap-center whitespace-nowrap transition-all duration-300 ${activeTab === tab.id
                                        ? "bg-primary text-primary-content shadow-lg shadow-primary/30 font-black scale-102"
                                        : "bg-base-100 text-base-content/50 border border-base-300 text-xs font-bold"
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                                    <span className="text-xs">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0 w-full mb-12">
                        <div className="max-w-4xl">
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

            {/* Modals with ultra-modern design */}
            {isEditPopupOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
                    <div className="bg-base-100 rounded-[3rem] p-8 w-full max-w-md shadow-[0_48px_96px_-16px_rgba(0,0,0,0.5)] border border-primary/20 animate-in zoom-in-95 duration-500">
                        <h3 className="text-2xl font-black tracking-tighter mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Update Status Name</h3>
                        <div className="relative mb-8 group">
                            <input
                                type="text"
                                value={editedName}
                                autoFocus
                                onChange={(e) => setEditedName(e.target.value)}
                                className="input input-bordered w-full h-14 rounded-2xl pr-16 text-lg font-bold bg-base-200 border-none focus:ring-8 focus:ring-primary/10 transition-all"
                                placeholder="Your vibrant name..."
                            />
                            <button onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="absolute right-4 top-1/2 -translate-y-1/2 btn btn-ghost btn-md btn-circle text-2xl hover:bg-primary/20 hover:scale-125 transition-all">😊</button>
                        </div>
                        {isEmojiPickerOpen && (
                            <div className="mb-8 rounded-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-500 ring-4 ring-primary/5">
                                <EmojiPicker onEmojiClick={(e) => setEditedName(p => p + e.emoji)} width="100%" height={350} searchDisabled />
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => { setIsEditPopupOpen(false); setIsEmojiPickerOpen(false); }} className="btn btn-ghost btn-sm flex-1 h-11 rounded-xl font-black tracking-tight">Cancel</button>
                            <button onClick={async () => { await updateName(editedName); setIsEditPopupOpen(false); }} className="btn btn-primary btn-sm flex-[2] h-11 rounded-xl font-black tracking-tight shadow-lg shadow-primary/20">Save Identity</button>
                        </div>
                    </div>
                </div>
            )}

            {isEditAboutPopupOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
                    <div className="bg-base-100 rounded-[3rem] p-8 w-full max-w-md shadow-[0_48px_96px_-16px_rgba(0,0,0,0.5)] border border-purple-500/20 animate-in zoom-in-95 duration-500">
                        <h3 className="text-2xl font-black tracking-tighter mb-8 bg-gradient-to-r from-purple-500 to-primary bg-clip-text text-transparent">Tell Your Story</h3>
                        <textarea
                            value={editedAbout}
                            autoFocus
                            onChange={(e) => setEditedAbout(e.target.value)}
                            className="textarea textarea-bordered w-full h-40 rounded-[2rem] mb-8 text-sm font-medium bg-base-200 border-none focus:ring-8 focus:ring-purple-500/10 transition-all p-6 leading-relaxed resize-none"
                            placeholder="Share a thought, a quote, or just a vibe..."
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditAboutPopupOpen(false)} className="btn btn-ghost btn-sm flex-1 h-11 rounded-xl font-black tracking-tight">Cancel</button>
                            <button onClick={async () => { await updateAbout(editedAbout); setIsEditAboutPopupOpen(false); }} className="btn btn-primary btn-sm bg-purple-500 hover:bg-purple-600 border-none flex-[2] h-11 rounded-xl font-black tracking-tight shadow-lg shadow-purple-500/20">Update Bio</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;