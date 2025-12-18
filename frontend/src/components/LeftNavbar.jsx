import { Link } from "react-router-dom";
import { THEMES } from "../constants";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageCircleHeart, Palette, User, Settings, MessageSquare, Users, Bell, Phone } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { useNotificationStore } from "../store/useNotificationStore";
import defaultImg from '../public/avatar.png';
import { useEffect } from "react";

const LeftNavbar = () => {
    const { logout, authUser } = useAuthStore();
    const { theme, setTheme } = useThemeStore();
    const { unreadCount, fetchUnreadCount } = useNotificationStore();

    useEffect(() => {
        if (authUser) {
            fetchUnreadCount();
        }
    }, [authUser, fetchUnreadCount]);

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
                <Link
                    to="/contacts"
                    className="w-full flex justify-center group relative"
                    title="Contacts"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Contacts
                    </span>
                </Link>

                {/* Calls */}
                <Link
                    to="/calls"
                    className="w-full flex justify-center group relative"
                    title="Calls"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <Phone className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Calls
                    </span>
                </Link>

                {/* Notifications */}
                <Link
                    to="/notifications"
                    className="w-full flex justify-center group relative"
                    title="Notifications"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200 relative">
                        <Bell className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-error text-error-content text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Notifications
                    </span>
                </Link>

                {/* Settings */}
                <Link
                    to="/settings"
                    className="w-full flex justify-center group relative"
                    title="Settings"
                >
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200">
                        <Settings className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                    </div>
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                        Settings
                    </span>
                </Link>
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
