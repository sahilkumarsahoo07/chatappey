import {
    Users,
    Mail,
    UserPlus,
    Clock,
    Bell,
    Search,
    X,
    Send,
    Check,
    Fingerprint,
    Zap,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect, useRef, useState } from "react";
import defaultImg from "../public/avatar.png";

const MIN_CHARS = 2;

function initials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ContactPage = () => {
    const {
        discoverUsers,
        searchDiscoverUsers,
        clearDiscoverUsers,
        sendFriendRequest,
        isDiscoverLoading,
    } = useChatStore();
    const { onlineUsers, authUser } = useAuthStore();
    const [sendingRequest, setSendingRequest] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [requestMessage, setRequestMessage] = useState("");
    const [hoveredId, setHoveredId] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const q = searchQuery.trim();
        if (q.length >= MIN_CHARS) {
            const t = setTimeout(() => searchDiscoverUsers(q), 280);
            return () => clearTimeout(t);
        }
        clearDiscoverUsers();
    }, [searchQuery, searchDiscoverUsers, clearDiscoverUsers]);

    useEffect(() => () => clearDiscoverUsers(), [clearDiscoverUsers]);

    const handleOpenRequestModal = (user) => {
        setSelectedUser(user);
        setRequestMessage("");
        setShowRequestModal(true);
    };

    const handleSendRequest = async () => {
        if (!selectedUser) return;
        setSendingRequest(selectedUser._id);
        try {
            await sendFriendRequest(selectedUser._id, requestMessage.trim());
            setShowRequestModal(false);
            setSelectedUser(null);
            setRequestMessage("");
        } catch (error) {
            console.error("Error sending friend request:", error);
        } finally {
            setSendingRequest(null);
        }
    };

    const handleQuickRequest = async (userId) => {
        setSendingRequest(userId);
        try {
            await sendFriendRequest(userId, "");
        } catch (error) {
            console.error("Error sending friend request:", error);
        } finally {
            setSendingRequest(null);
        }
    };

    const trimmed = searchQuery.trim();
    const canSearch = trimmed.length >= MIN_CHARS;
    const results = discoverUsers.filter((user) => user._id !== authUser?._id);
    const progress = Math.min(1, trimmed.length / MIN_CHARS);

    const renderActions = (user) => {
        const isSending = sendingRequest === user._id;

        if (user.isFriend) {
            return (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    Connected
                </span>
            );
        }
        if (user.hasPendingRequest && user.pendingRequestSentByMe) {
            return (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-base-content/40">
                    <Clock className="w-3.5 h-3.5" />
                    Awaiting
                </span>
            );
        }
        if (user.hasPendingRequest && !user.pendingRequestSentByMe) {
            return (
                <button
                    type="button"
                    onClick={() => {
                        window.location.href = "/notifications";
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-3 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition"
                >
                    <Bell className="w-3.5 h-3.5" />
                    Review
                </button>
            );
        }

        return (
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => handleOpenRequestModal(user)}
                    disabled={isSending}
                    className="text-[11px] font-bold tracking-wide uppercase px-3 py-2 rounded-lg border border-base-content/15 hover:border-emerald-500/50 hover:text-emerald-600 transition disabled:opacity-40"
                >
                    Note
                </button>
                <button
                    type="button"
                    onClick={() => handleQuickRequest(user._id)}
                    disabled={isSending}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-3.5 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition active:scale-[0.97] disabled:opacity-50"
                >
                    {isSending ? (
                        <span className="loading loading-spinner loading-xs" />
                    ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                    )}
                    Invite
                </button>
            </div>
        );
    };

    return (
        <>
            <div className="min-h-[100dvh] pl-0 md:pl-20 pb-navbar md:pb-0 bg-base-100">
                {/* Diagonal wash */}
                <div className="pointer-events-none fixed inset-0 md:left-20 -z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-base-200/30" />
                    <div className="absolute -top-1/4 -left-1/4 w-[70%] h-[70%] bg-[conic-gradient(from_210deg_at_50%_50%,transparent_0deg,oklch(0.78_0.12_165_/_0.18)_90deg,transparent_180deg)] blur-2xl" />
                    <div className="absolute bottom-0 right-0 w-[50%] h-[55%] bg-[radial-gradient(circle_at_80%_80%,oklch(0.7_0.1_200_/_0.12),transparent_55%)]" />
                    <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
                        <defs>
                            <pattern id="dirGrid" width="48" height="48" patternUnits="userSpaceOnUse">
                                <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#dirGrid)" />
                    </svg>
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                    <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-8 lg:gap-12 items-start">
                        {/* Left: identity panel */}
                        <aside className="lg:sticky lg:top-8 dir-in">
                            <p className="text-[11px] font-bold tracking-[0.28em] uppercase text-emerald-600/80 dark:text-emerald-400/80 mb-4">
                                Directory · /contacts
                            </p>
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[0.95] text-base-content mb-4">
                                People
                                <span className="block text-emerald-500 mt-1">index</span>
                            </h1>
                            <p className="text-sm text-base-content/55 leading-relaxed max-w-sm mb-8">
                                Look up members by name or email, send an invite, and chat after they accept.
                            </p>

                            <div className="space-y-3 mb-8">
                                {[
                                    { icon: Fingerprint, label: "Identity match", hint: "Name + email lookup" },
                                    { icon: Zap, label: "Fast invite", hint: "One tap to connect" },
                                    { icon: Check, label: "Private chat", hint: "Friends-only messaging" },
                                ].map(({ icon: Icon, label, hint }) => (
                                    <div
                                        key={label}
                                        className="flex items-center gap-3 rounded-xl border border-base-content/8 bg-base-100/70 px-3.5 py-3 backdrop-blur-sm"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold leading-none mb-1">{label}</p>
                                            <p className="text-xs text-base-content/45">{hint}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden lg:flex items-center gap-2 text-xs text-base-content/40">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Live search ready
                            </div>
                        </aside>

                        {/* Right: search workspace */}
                        <section className="dir-in" style={{ animationDelay: "80ms" }}>
                            <div className="rounded-3xl border border-base-content/10 bg-base-100/90 backdrop-blur-md shadow-2xl shadow-emerald-900/5 overflow-hidden">
                                {/* Typography search */}
                                <div className="px-5 sm:px-7 pt-6 sm:pt-8 pb-4">
                                    <div className="flex items-end justify-between gap-3 mb-3">
                                        <label className="text-[11px] font-bold tracking-[0.22em] uppercase text-base-content/40">
                                            Query
                                        </label>
                                        <span className="text-[11px] font-mono text-base-content/35 tabular-nums">
                                            {trimmed.length}/{MIN_CHARS}+
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 border-b-2 border-base-content/15 focus-within:border-emerald-500 transition-colors pb-3">
                                        <Search className="w-6 h-6 text-base-content/30 flex-shrink-0" />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Who are you looking for?"
                                            className="flex-1 min-w-0 bg-transparent text-xl sm:text-2xl font-semibold outline-none placeholder:font-normal placeholder:text-base-content/25"
                                            autoComplete="off"
                                            spellCheck={false}
                                            autoFocus
                                        />
                                        {isDiscoverLoading && (
                                            <span className="loading loading-spinner loading-sm text-emerald-500" />
                                        )}
                                        {searchQuery && !isDiscoverLoading && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchQuery("");
                                                    inputRef.current?.focus();
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/40"
                                                aria-label="Clear"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {/* Progress to min chars */}
                                    <div className="mt-3 h-0.5 w-full bg-base-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                                            style={{ width: `${progress * 100}%` }}
                                        />
                                    </div>
                                    <p className="mt-3 text-xs text-base-content/45">
                                        {!canSearch
                                            ? trimmed
                                                ? `Almost there — ${MIN_CHARS - trimmed.length} more character${
                                                      MIN_CHARS - trimmed.length === 1 ? "" : "s"
                                                  }`
                                                : "Type a name or email to open the index"
                                            : isDiscoverLoading
                                              ? "Scanning directory…"
                                              : results.length
                                                ? `${results.length} match${results.length === 1 ? "" : "es"} in the index`
                                                : `Zero hits for “${trimmed}”`}
                                    </p>
                                </div>

                                {/* Results / idle */}
                                <div className="min-h-[280px] border-t border-base-content/6">
                                    {canSearch ? (
                                        isDiscoverLoading && results.length === 0 ? (
                                            <div className="divide-y divide-base-content/6">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <div key={i} className="flex items-center gap-4 px-5 sm:px-7 py-4 animate-pulse">
                                                        <div className="skeleton w-12 h-12 rounded-2xl" />
                                                        <div className="flex-1 space-y-2">
                                                            <div className="skeleton h-4 w-40" />
                                                            <div className="skeleton h-3 w-52" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : results.length > 0 ? (
                                            <ul className="divide-y divide-base-content/6">
                                                {results.map((user, i) => {
                                                    const isOnline = onlineUsers.includes(user._id);
                                                    const active = hoveredId === user._id;
                                                    return (
                                                        <li
                                                            key={user._id}
                                                            onMouseEnter={() => setHoveredId(user._id)}
                                                            onMouseLeave={() => setHoveredId(null)}
                                                            className={`relative flex items-center gap-3.5 sm:gap-4 px-5 sm:px-7 py-4 transition-colors duration-200 dir-row ${
                                                                active ? "bg-emerald-500/6" : "hover:bg-base-200/40"
                                                            }`}
                                                            style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                                                        >
                                                            {active && (
                                                                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-500" />
                                                            )}
                                                            <div className="relative flex-shrink-0">
                                                                {user.profilePic ? (
                                                                    <img
                                                                        src={user.profilePic}
                                                                        alt=""
                                                                        className="w-12 h-12 rounded-2xl object-cover bg-base-200"
                                                                    />
                                                                ) : (
                                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-sm font-black tracking-tight">
                                                                        {initials(user.fullName)}
                                                                    </div>
                                                                )}
                                                                {isOnline && (
                                                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-base-100" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-baseline gap-2 flex-wrap">
                                                                    <p className="font-bold text-[15px] truncate">
                                                                        {user.fullName}
                                                                    </p>
                                                                    {user.isFriend && (
                                                                        <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600/70">
                                                                            Friend
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-base-content/45 truncate flex items-center gap-1 mt-0.5">
                                                                    <Mail className="w-3 h-3 opacity-60 flex-shrink-0" />
                                                                    {user.email}
                                                                </p>
                                                                {user.about && (
                                                                    <p className="text-xs text-base-content/35 truncate mt-1 italic hidden sm:block">
                                                                        {user.about}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex-shrink-0">{renderActions(user)}</div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                                <div className="w-14 h-14 rounded-2xl border border-dashed border-base-content/20 flex items-center justify-center mb-4">
                                                    <Users className="w-6 h-6 text-base-content/25" />
                                                </div>
                                                <p className="font-semibold">No index hits</p>
                                                <p className="text-sm text-base-content/45 mt-1 max-w-xs">
                                                    Nobody matched “{trimmed}”. Try another spelling.
                                                </p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-6 text-center">
                                            <div className="relative mb-6">
                                                <div className="absolute inset-0 rounded-full bg-emerald-500/15 blur-xl scale-150" />
                                                <div className="relative w-16 h-16 rounded-full border-2 border-dashed border-emerald-500/40 flex items-center justify-center">
                                                    <Search className="w-7 h-7 text-emerald-600/70 dark:text-emerald-400/70" />
                                                </div>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight">Open the index</p>
                                            <p className="text-sm text-base-content/45 mt-2 max-w-sm leading-relaxed">
                                                Start typing above. Matches stream into this panel — invite them with one tap.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {showRequestModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-base-content/45 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-base-100 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-content/10 overflow-hidden dir-in">
                        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
                        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-600 mb-1">
                                    Invite
                                </p>
                                <h2 className="text-lg font-bold">Send with a note</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRequestModal(false)}
                                className="p-2 rounded-xl hover:bg-base-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-5 pb-6">
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/15 mb-4">
                                {selectedUser.profilePic ? (
                                    <img
                                        src={selectedUser.profilePic || defaultImg}
                                        alt=""
                                        className="w-12 h-12 rounded-2xl object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center font-black text-emerald-700 dark:text-emerald-300">
                                        {initials(selectedUser.fullName)}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-bold truncate">{selectedUser.fullName}</p>
                                    <p className="text-xs text-base-content/50 truncate">{selectedUser.email}</p>
                                </div>
                            </div>
                            <textarea
                                value={requestMessage}
                                onChange={(e) => setRequestMessage(e.target.value)}
                                placeholder="Hi — would love to connect on ChatAppey…"
                                className="w-full h-28 rounded-2xl border border-base-content/10 bg-base-200/40 px-3.5 py-3 text-sm outline-none focus:border-emerald-500/50 resize-none"
                                maxLength={200}
                            />
                            <p className="text-[11px] text-base-content/40 text-right mt-1.5">
                                {requestMessage.length}/200
                            </p>
                            <div className="flex gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowRequestModal(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:bg-base-200 transition"
                                    disabled={sendingRequest}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendRequest}
                                    disabled={sendingRequest}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {sendingRequest ? (
                                        <span className="loading loading-spinner loading-sm" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    Send invite
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .dir-in {
                    animation: dirIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .dir-row {
                    animation: dirIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes dirIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default ContactPage;
