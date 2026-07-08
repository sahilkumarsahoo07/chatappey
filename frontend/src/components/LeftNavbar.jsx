import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import {
    LogOut,
    MessageCircleHeart,
    Settings,
    MessageSquare,
    Users,
    Bell,
    Phone,
    ShieldAlert,
    MoreHorizontal,
    X,
    ChevronRight,
    Star,
    TrendingUp,
} from "lucide-react";
import { useNotificationStore } from "../store/useNotificationStore";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import defaultImg from "../public/avatar.png";

const LeftNavbar = () => {
    const { logout, authUser } = useAuthStore();
    const { unreadCount, fetchUnreadCount } = useNotificationStore();
    const { selectedUser, setSelectedUser } = useChatStore();
    const { selectedGroup, setSelectedGroup } = useGroupStore();
    const location = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);

    useEffect(() => {
        if (authUser) fetchUnreadCount();
    }, [authUser, fetchUnreadCount]);

    useEffect(() => {
        setMoreOpen(false);
    }, [location.pathname]);

    const handleNavClick = (e, item) => {
        if (item.to === "/" && location.pathname === "/" && (selectedUser || selectedGroup)) {
            e.preventDefault();
            setSelectedUser(null);
            setSelectedGroup(null);
        }
    };

    const primaryTabs = [
        { to: "/", icon: MessageSquare, label: "Chats" },
        { to: "/contacts", icon: Users, label: "Search" },
        { to: "/calls", icon: Phone, label: "Calls" },
        { to: "/notifications", icon: Bell, label: "Alerts", badge: unreadCount },
    ];

    const moreItems = [
        { to: "/starred", icon: Star, label: "Starred" },
        { to: "/insights", icon: TrendingUp, label: "Insights" },
        { to: "/settings", icon: Settings, label: "Settings" },
        ...(authUser?.role === "admin"
            ? [{ to: "/admin", icon: ShieldAlert, label: "Admin" }]
            : []),
    ];

    const desktopItems = [
        ...primaryTabs,
        ...moreItems,
    ];

    const isActive = (to) => {
        if (to === "/") return location.pathname === "/";
        return location.pathname.startsWith(to);
    };

    const moreActive = moreItems.some((item) => isActive(item.to));
    const chatOpen = location.pathname === "/" && !!(selectedUser || selectedGroup);

    return (
        <>
            {/* Desktop Side Navbar */}
            <aside className="hidden md:flex fixed left-0 top-0 h-screen w-16 md:w-20 bg-primary flex-col items-center py-4 z-50 shadow-2xl">
                <Link to="/" className="mb-6 group transition-all active:scale-[0.98]">
                    <div className="size-11 md:size-12 rounded-2xl bg-primary-content/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary-content/30 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <MessageCircleHeart className="w-6 h-6 md:w-7 md:h-7 text-primary-content group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                </Link>

                <nav className="flex-1 flex flex-col items-center gap-3 w-full px-2">
                    {desktopItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className="w-full flex justify-center group relative"
                            title={item.label}
                        >
                            <div
                                className={`size-11 md:size-12 rounded-2xl backdrop-blur-sm flex items-center justify-center transition-all duration-200 relative ${
                                    isActive(item.to)
                                        ? "bg-primary-content/25 ring-2 ring-primary-content/30"
                                        : "bg-primary-content/10 hover:bg-primary-content/20"
                                }`}
                            >
                                <item.icon className="w-5 h-5 md:w-6 md:h-6 text-primary-content" />
                                {item.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-error text-error-content text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                        {item.badge > 99 ? "99+" : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className="absolute left-full ml-3 px-3 py-1.5 bg-base-content text-base-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-[60]">
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

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

            {/* Mobile Bottom Dock — floating previous design */}
            <nav
                className={`md:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none transition-transform duration-250 ease-out ${
                    chatOpen ? "translate-y-full" : "translate-y-0"
                }`}
                style={{ padding: "0 10px calc(8px + env(safe-area-inset-bottom, 0px))" }}
                aria-hidden={chatOpen}
            >
                <div
                    className="pointer-events-auto flex items-stretch justify-between gap-0.5 max-w-[420px] mx-auto px-1.5 pt-1.5 pb-2 rounded-[22px] bg-primary border border-primary-content/15 shadow-[0_10px_32px_rgba(0,0,0,0.22)]"
                    role="tablist"
                    aria-label="Main navigation"
                >
                    {primaryTabs.map((item) => {
                        const active = isActive(item.to);
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={(e) => handleNavClick(e, item)}
                                role="tab"
                                aria-selected={active}
                                aria-current={active ? "page" : undefined}
                                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[48px] py-1.5 px-0.5 rounded-2xl transition-all active:scale-95 ${
                                    active
                                        ? "bg-primary-content/20 text-primary-content"
                                        : "text-primary-content/70 hover:bg-primary-content/10"
                                }`}
                            >
                                <span className="relative w-[22px] h-[22px] flex items-center justify-center">
                                    <item.icon
                                        className="w-[18px] h-[18px]"
                                        strokeWidth={active ? 2.4 : 1.9}
                                    />
                                    {item.badge > 0 && (
                                        <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-error text-error-content text-[8px] font-bold flex items-center justify-center shadow-[0_0_0_2px] shadow-primary">
                                            {item.badge > 99 ? "99+" : item.badge}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[8px] font-semibold leading-none truncate max-w-full">
                                    {item.label}
                                </span>
                                {active && (
                                    <span className="absolute bottom-1 w-3.5 h-0.5 rounded-full bg-primary-content/90" aria-hidden />
                                )}
                            </Link>
                        );
                    })}

                    <button
                        type="button"
                        role="tab"
                        aria-selected={moreOpen || moreActive}
                        aria-expanded={moreOpen}
                        aria-haspopup="dialog"
                        onClick={() => setMoreOpen(true)}
                        className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[48px] py-1.5 px-0.5 rounded-2xl transition-all active:scale-95 border-0 cursor-pointer ${
                            moreOpen || moreActive
                                ? "bg-primary-content/20 text-primary-content"
                                : "bg-transparent text-primary-content/70 hover:bg-primary-content/10"
                        }`}
                    >
                        <span className="relative w-[22px] h-[22px] flex items-center justify-center">
                            <MoreHorizontal
                                className="w-[18px] h-[18px]"
                                strokeWidth={moreOpen || moreActive ? 2.4 : 1.9}
                            />
                        </span>
                        <span className="text-[8px] font-semibold leading-none truncate max-w-full">
                            More
                        </span>
                        {(moreOpen || moreActive) && (
                            <span className="absolute bottom-1 w-3.5 h-0.5 rounded-full bg-primary-content/90" aria-hidden />
                        )}
                    </button>
                </div>
            </nav>

            {/* More menu — list sheet with tinted rows */}
            {moreOpen &&
                createPortal(
                    <div className="fixed inset-0 z-[80] md:hidden">
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/50"
                            aria-label="Close menu"
                            onClick={() => setMoreOpen(false)}
                        />
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="More options"
                            className="absolute bottom-0 inset-x-0 bg-base-100 rounded-t-[1.75rem] shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-[moreSlide_0.2s_ease-out]"
                        >
                            <div className="flex justify-center pt-2.5 pb-1">
                                <div className="w-9 h-1 rounded-full bg-base-300" />
                            </div>

                            <div className="px-4 pb-2 flex items-center gap-3">
                                <div className="relative">
                                    <img
                                        src={authUser?.profilePic || defaultImg}
                                        alt=""
                                        className="w-11 h-11 rounded-2xl object-cover"
                                    />
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success ring-2 ring-base-100" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold truncate">{authUser?.fullName}</p>
                                    <p className="text-[11px] text-base-content/50 truncate">{authUser?.email}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMoreOpen(false)}
                                    className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4 opacity-60" />
                                </button>
                            </div>

                            <div className="mx-3 mt-1 mb-2 h-px bg-base-300/70" />

                            <div className="px-3 space-y-1.5">
                                {moreItems.map((item) => {
                                    const active = isActive(item.to);
                                    const isAdmin = item.to === "/admin";
                                    return (
                                        <Link
                                            key={item.to}
                                            to={item.to}
                                            onClick={() => setMoreOpen(false)}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                                                active
                                                    ? "bg-primary text-primary-content"
                                                    : "bg-base-200/70 hover:bg-base-200 text-base-content"
                                            }`}
                                        >
                                            <span
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    active
                                                        ? "bg-primary-content/20"
                                                        : isAdmin
                                                          ? "bg-warning/15 text-warning"
                                                          : "bg-primary/12 text-primary"
                                                }`}
                                            >
                                                <item.icon className="w-4 h-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-semibold leading-tight">{item.label}</p>
                                                <p className={`text-[10px] leading-tight mt-0.5 ${active ? "opacity-70" : "text-base-content/45"}`}>
                                                    {isAdmin ? "Manage users & reports" : "Theme, privacy & account"}
                                                </p>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 ${active ? "opacity-70" : "opacity-30"}`} />
                                        </Link>
                                    );
                                })}

                                {authUser && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMoreOpen(false);
                                            logout();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-error/10 text-error hover:bg-error/15 transition-colors"
                                    >
                                        <span className="w-8 h-8 rounded-lg bg-error/15 flex items-center justify-center">
                                            <LogOut className="w-4 h-4" />
                                        </span>
                                        <div className="min-w-0 flex-1 text-left">
                                            <p className="text-[13px] font-semibold leading-tight">Logout</p>
                                            <p className="text-[10px] leading-tight mt-0.5 opacity-70">Sign out of this device</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 opacity-40" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <style>{`
                          @keyframes moreSlide {
                            from { opacity: 0; transform: translateY(24px); }
                            to { opacity: 1; transform: translateY(0); }
                          }
                        `}</style>
                    </div>,
                    document.body
                )}
        </>
    );
};

export default LeftNavbar;
