import { Link, useLocation } from "react-router-dom";
import { THEMES } from "../constants";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { LogOut, MessageCircleHeart, Palette, User, Settings, MessageSquare, Users, Bell, Phone } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { useNotificationStore } from "../store/useNotificationStore";
import defaultImg from '../public/avatar.png';
import { useEffect } from "react";

const LeftNavbar = () => {
    const { logout, authUser } = useAuthStore();
    const { theme, setTheme } = useThemeStore();
    const { unreadCount, fetchUnreadCount } = useNotificationStore();
    const { selectedUser, setSelectedUser } = useChatStore();
    const { selectedGroup, setSelectedGroup } = useGroupStore();
    const location = useLocation();

    useEffect(() => {
        if (authUser) {
            fetchUnreadCount();
        }
    }, [authUser, fetchUnreadCount]);

    // Handle navigation click - if on home with chat open, go back instead of navigating
    const handleNavClick = (e, item) => {
        // Only for Messages item on home page when a chat is selected
        if (item.to === "/" && location.pathname === "/" && (selectedUser || selectedGroup)) {
            e.preventDefault();
            // Clear selections to go back to chat list
            setSelectedUser(null);
            setSelectedGroup(null);
        }
        // Otherwise, let the Link navigate normally
    };

    // Navigation items for reuse
    const navItems = [
        { to: "/", icon: MessageSquare, label: "Messages" },
        { to: "/contacts", icon: Users, label: "Contacts" },
        { to: "/calls", icon: Phone, label: "Calls" },
        { to: "/notifications", icon: Bell, label: "Notifications", badge: unreadCount },
        { to: "/settings", icon: Settings, label: "Settings" },
    ];

    return (
        <>
            {/* Desktop Side Navbar - Hidden on mobile */}
            <aside className="hidden md:flex fixed left-0 top-0 h-screen w-16 md:w-20 bg-primary flex-col items-center py-4 z-50 shadow-2xl">
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
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className="w-full flex justify-center group relative"
                            title={item.label}
                        >
                            <div className="size-11 md:size-12 rounded-2xl bg-primary-content/10 backdrop-blur-sm flex items-center justify-center hover:bg-primary-content/20 transition-all duration-200 relative">
                                <item.icon className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                                {item.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-error text-error-content text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                                {item.label}
                            </span>
                        </Link>
                    ))}
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

            {/* Mobile Bottom Navbar - Hidden on desktop */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-primary z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] safe-bottom">
                <div className="flex items-center justify-around px-1 py-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            onClick={(e) => handleNavClick(e, item)}
                            className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-primary-content/10 transition-all duration-200 relative min-w-[48px]"
                        >
                            <div className="relative">
                                <item.icon className="w-4 h-4 text-primary-content" />
                                {item.badge > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-error text-error-content text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] text-primary-content/80 mt-0.5 font-medium">
                                {item.label}
                            </span>
                        </Link>
                    ))}
                    {/* Logout button in mobile nav */}
                    {authUser && (
                        <button
                            onClick={logout}
                            className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-error/30 transition-all duration-200 min-w-[48px]"
                        >
                            <LogOut className="w-4 h-4 text-primary-content" />
                            <span className="text-[9px] text-primary-content/80 mt-0.5 font-medium">
                                Logout
                            </span>
                        </button>
                    )}
                </div>
            </nav>
        </>
    );
};

export default LeftNavbar;

