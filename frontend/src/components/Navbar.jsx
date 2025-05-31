import { Link } from "react-router-dom";
import { THEMES } from "../constants";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageCircleHeart, MessageSquare, Palette, Send, Settings, User } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";

const PREVIEW_MESSAGES = [
    { id: 1, content: "Hey! How's it going?", isSent: false },
    { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const Navbar = () => {
    const { logout, authUser } = useAuthStore();
    const { theme, setTheme } = useThemeStore();

    return (
     <header className="border-b border-base-300/50 fixed w-full top-0 z-40 backdrop-blur-lg bg-base-100/90 shadow-sm">
        <div className="container mx-auto px-4 h-16">
            <div className="flex items-center justify-between h-full">
                {/* Logo/Brand - More polished with subtle animation */}
                <Link 
                    to="/" 
                    className="flex items-center gap-3 group transition-all active:scale-[0.98]"
                >
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 shadow-sm hover:shadow-primary/10">
                        <MessageCircleHeart className="w-5 h-5 text-primary group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <div className="flex flex-col leading-tight">
                        <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                            ChatAppey
                        </h1>
                        <span className="text-xs text-base-content/60 -mt-1 hidden sm:block">
                            Connect seamlessly
                        </span>
                    </div>
                </Link>

                {/* Navigation - More refined buttons with better hover states */}
                <div className="flex items-center gap-2">
                    {/* Theme Dropdown */}
                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="p-2 rounded-lg hover:bg-base-200/50 transition-all duration-200 flex items-center gap-1.5 group cursor-pointer">
                            <Palette className="w-5 h-5 text-base-content/70 group-hover:text-primary transition-colors" />
                            <span className="hidden sm:inline font-medium text-sm">Theme</span>
                        </label>
                        <div tabIndex={0} className="dropdown-content z-[100] mt-2 p-6 shadow-xl bg-base-100 rounded-box w-[calc(100vw-2rem)] sm:w-[16rem] border border-base-300/30">
                            <div className="space-y-6">
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-lg font-semibold">Theme</h2>
                                    <p className="text-sm text-base-content/70">Choose a theme for your chat interface</p>
                                </div>

                                 <div className="overflow-x-auto pb-2 h-[300px]">
                                    <div className="flex gap-2 w-[100%] flex-col">
                                        {THEMES.map((t) => (
                                            <button
                                                key={t}
                                                className={`
                                                    group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors min-w-[60px]
                                                    ${theme === t ? "bg-base-200 ring-1 ring-primary/30" : "hover:bg-base-200/50"}
                                                `}
                                                onClick={() => setTheme(t)}
                                            >
                                                <div className="relative h-6 w-full rounded-md overflow-hidden" data-theme={t}>
                                                    <div className="absolute inset-0 grid grid-cols-4 gap-px p-0.5">
                                                        <div className="rounded-sm bg-primary"></div>
                                                        <div className="rounded-sm bg-secondary"></div>
                                                        <div className="rounded-sm bg-accent"></div>
                                                        <div className="rounded-sm bg-neutral"></div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-medium truncate w-full text-center">
                                                   {t.charAt(0).toUpperCase() + t.slice(1)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Settings Button */}
                    {/* <Link
                        to="/settings"
                        className="p-2 rounded-lg hover:bg-base-200/50 transition-all duration-200 flex items-center gap-1.5 group"
                    >
                        <Settings className="w-5 h-5 text-base-content/70 group-hover:text-primary transition-colors" />
                        <span className="hidden sm:inline font-medium text-sm">Settings</span>
                    </Link> */}

                    {authUser && (
                        <>
                            <Link 
                                to="/profile" 
                                className="p-2 rounded-lg hover:bg-base-200/50 transition-all duration-200 flex items-center gap-1.5 group"
                            >
                                <User className="w-5 h-5 text-base-content/70 group-hover:text-primary transition-colors" />
                                <span className="hidden sm:inline text-sm font-medium text-base-content/80 group-hover:text-base-content">
                                    Profile
                                </span>
                            </Link>

                            <button 
                                className="p-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 group btn btn-sm btn-ghost px-3 hover:bg-error/10 text-error hover:text-error"
                                onClick={logout}
                            >
                                <LogOut className="size-4" />
                                <span className="hidden sm:inline font-medium text-sm">Logout</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    </header>
    );
};
export default Navbar;