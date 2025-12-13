import { Link } from "react-router-dom";
import { THEMES } from "../constants";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageCircleHeart, Palette, User, Settings, MessageSquare, Users, Bell } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import defaultImg from '../public/avatar.png';

const LeftNavbar = () => {
    const { logout, authUser } = useAuthStore();
    const { theme, setTheme } = useThemeStore();

    return (
        <aside className="fixed left-0 top-0 h-screen w-16 md:w-20 bg-primary flex flex-col items-center py-4 z-50 shadow-2xl">
            {/* Logo at top */}
            <Link
                to="/"
                className="mb-6 group transition-all active:scale-[0.98]"
            >
                <div className="size-11 md:size-12 rounded-2xl bg-primary-content/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary-content/30 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <MessageCircleHeart className="w-6 h-6 md:w-7 md:h-7 text-primary-content group-hover:rotate-12 transition-transform duration-300" />
                </div>
            </Link>

            {/* Navigation Icons */}
            <nav className="flex-1 flex flex-col items-center gap-3 w-full px-2">
                {/* Profile/Avatar */}
                {authUser && (
                    <Link
                        to="/profile"
                        className="w-full flex justify-center group relative"
                        title="Profile"
                    >
                        <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200 overflow-hidden ring-2 ring-primary-content/20 hover:ring-primary-content/40">
                            {authUser.profilePic ? (
                                <img
                                    src={authUser.profilePic || defaultImg}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                            )}
                        </div>
                        <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                            Profile
                        </span>
                    </Link>
                )}

                {/* Messages/Chats */}
                <Link
                    to="/"
                    className="w-full flex justify-center group relative"
                    title="Messages"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Messages
                    </span>
                </Link>

                {/* Contacts */}
                <button
                    className="w-full flex justify-center group relative"
                    title="Contacts"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Contacts
                    </span>
                </button>

                {/* Notifications */}
                <button
                    className="w-full flex justify-center group relative"
                    title="Notifications"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <Bell className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Notifications
                    </span>
                </button>

                {/* Settings */}
                <button
                    className="w-full flex justify-center group relative"
                    title="Settings"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <Settings className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Settings
                    </span>
                </button>

                {/* Theme Dropdown */}
                <div className="dropdown dropdown-right w-full flex justify-center">
                    <label
                        tabIndex={0}
                        className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200 cursor-pointer group relative"
                        title="Theme"
                    >
                        <Palette className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                        <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                            Theme
                        </span>
                    </label>
                    <div
                        tabIndex={0}
                        className="dropdown-content z-[100] ml-2 p-6 shadow-xl bg-base-100 rounded-box w-64 border border-base-300/30"
                    >
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-lg font-semibold">Theme</h2>
                                <p className="text-sm text-base-content/70">Choose your theme</p>
                            </div>

                            <div className="overflow-y-auto max-h-[300px] pr-2">
                                <div className="flex flex-col gap-2">
                                    {THEMES.map((t) => (
                                        <button
                                            key={t}
                                            className={`
                                                group flex items-center gap-3 p-3 rounded-lg transition-colors
                                                ${theme === t ? "bg-base-200 ring-1 ring-primary/30" : "hover:bg-base-200/50"}
                                            `}
                                            onClick={() => setTheme(t)}
                                        >
                                            <div className="h-8 w-12 rounded-md overflow-hidden flex-shrink-0" data-theme={t}>
                                                <div className="h-full grid grid-cols-4 gap-px p-0.5">
                                                    <div className="rounded-sm bg-primary"></div>
                                                    <div className="rounded-sm bg-secondary"></div>
                                                    <div className="rounded-sm bg-accent"></div>
                                                    <div className="rounded-sm bg-neutral"></div>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium flex-1 text-left">
                                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                            </span>
                                            {theme === t && (
                                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Logout at bottom */}
            {authUser && (
                <button
                    className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-error/30 transition-all duration-200 group relative mt-2"
                    onClick={logout}
                    title="Logout"
                >
                    <LogOut className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Logout
                    </span>
                </button>
            )}
        </aside>
    );
};

export default LeftNavbar;
