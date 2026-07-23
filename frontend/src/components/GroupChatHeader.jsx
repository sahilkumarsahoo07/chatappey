import { ArrowLeft, MoreVertical, Users, Phone, Video, Pin, X as CloseIcon, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import defaultAvatar from "../public/avatar.png";
import { useState, useMemo } from "react";
import GroupInfoPanel from "./GroupInfoPanel";
import {
    formatGroupTypingLabel,
    formatGroupRecordingLabel,
} from "../lib/groupPresence";
import { useShallow } from "zustand/react/shallow";
import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import toast from "react-hot-toast";

import { GroupVibeAvatarRing } from "./groupVibes/GroupVibeAvatarRing";
import { Sparkles } from "lucide-react";
import { useGroupVibeStore } from "../store/useGroupVibeStore";

const GroupChatHeader = ({ onSearchOpen }) => {
    const { setCreatorOpen } = useGroupVibeStore();
    const { selectedGroup, clearSelectedGroup, unpinMessage, typingUsers, recordingUsers, setScrollTarget, groupMessages } =
        useGroupStore(
            useShallow((s) => ({
                selectedGroup: s.selectedGroup,
                clearSelectedGroup: s.clearSelectedGroup,
                unpinMessage: s.unpinMessage,
                typingUsers: s.typingUsers,
                recordingUsers: s.recordingUsers,
                setScrollTarget: s.setScrollTarget,
                groupMessages: s.groupMessages,
            }))
        );
    const { setSelectedUser } = useChatStore();
    const { authUser, onlineUsers = [] } = useAuthStore(
        useShallow((s) => ({
            authUser: s.authUser,
            onlineUsers: s.onlineUsers,
        }))
    );
    const [showInfo, setShowInfo] = useState(false);
    const [showOnlineDialog, setShowOnlineDialog] = useState(false);
    const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

    const isOwner = selectedGroup?.admin?._id === authUser?._id;
    const currentUserMember = selectedGroup?.members?.find(
        (m) => (m.user?._id || m.user || m).toString() === authUser?._id
    );
    const isAdmin = isOwner || currentUserMember?.role === "admin";

    const presenceLabel = useMemo(() => {
        const recording = formatGroupRecordingLabel(recordingUsers);
        if (recording) return recording;
        return formatGroupTypingLabel(typingUsers);
    }, [typingUsers, recordingUsers]);

    const handleBack = () => {
        clearSelectedGroup();
        setSelectedUser(null);
    };

    if (!selectedGroup) return null;

    const memberCount = selectedGroup.members?.length || 0;
    const onlineCount = useMemo(() => {
        if (!selectedGroup.members || !onlineUsers) return 0;
        return selectedGroup.members.filter((m) => {
            const userId = String(m.user?._id || m.user || m);
            return onlineUsers.includes(userId);
        }).length;
    }, [selectedGroup.members, onlineUsers]);

    const pinnedMessages = useMemo(() => {
        if (selectedGroup.pinnedMessages && selectedGroup.pinnedMessages.length > 0) {
            return selectedGroup.pinnedMessages;
        }
        return selectedGroup.pinnedMessage ? [selectedGroup.pinnedMessage] : [];
    }, [selectedGroup.pinnedMessages, selectedGroup.pinnedMessage]);

    const activePinnedIndex = Math.min(currentPinnedIndex, pinnedMessages.length - 1);
    const activePinned = pinnedMessages.length > 0 ? pinnedMessages[activePinnedIndex] : null;

    const handlePinnedClick = () => {
        if (!activePinned) return;
        const targetId = activePinned.realId || activePinned._id;
        const idx = groupMessages.findIndex(m => String(m.realId || m._id) === String(targetId));
        if (idx !== -1) {
            setScrollTarget(idx);
            setTimeout(() => {
                const el = document.getElementById(`msg-${targetId}`);
                if (el) {
                    el.classList.add("highlight-message");
                    setTimeout(() => el.classList.remove("highlight-message"), 2000);
                }
            }, 500);
        } else {
            toast.error("Pinned message is too old to display in current view");
        }
    };

    return (
        <>
            <header className="chat-header-surface">
                <div className="flex items-center gap-1.5 sm:gap-2 min-h-[56px] px-2 sm:px-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="lg:hidden shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base-content/80 hover:bg-base-200 active:scale-95 transition-all"
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} strokeWidth={2} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowInfo(true)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-xl px-1 py-1 hover:bg-base-200/60 active:scale-[0.995] transition-all"
                    >
                        <GroupVibeAvatarRing
                            groupId={selectedGroup._id}
                            groupName={selectedGroup.name}
                            groupImage={selectedGroup.image}
                            size={40}
                        />

                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[15px] sm:text-base text-base-content truncate leading-tight">
                                {selectedGroup.name}
                            </h3>
                            <p
                                onClick={(e) => {
                                    if (!presenceLabel) {
                                        e.stopPropagation();
                                        setShowOnlineDialog(true);
                                    }
                                }}
                                className={`text-[11px] sm:text-xs truncate mt-0.5 leading-tight ${
                                    presenceLabel
                                        ? "text-primary font-medium"
                                        : "text-base-content/55 hover:underline cursor-pointer"
                                }`}
                            >
                                {presenceLabel || `${memberCount} members, ${onlineCount} online`}
                            </p>
                        </div>
                    </button>

                    <div className="flex items-center shrink-0 gap-0.5">
                        <button
                            type="button"
                            onClick={() => setCreatorOpen(true, selectedGroup._id)}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all"
                            title="Add Group Vibe"
                        >
                            <Sparkles size={18} strokeWidth={2} />
                        </button>
                        {onSearchOpen && (
                            <button
                                type="button"
                                onClick={onSearchOpen}
                                className="w-9 h-9 rounded-full flex items-center justify-center text-base-content/70 hover:bg-base-200 hover:text-base-content active:scale-95 transition-all"
                                title="Search in chat"
                            >
                                <Search size={18} strokeWidth={2} />
                            </button>
                        )}
                        <button
                            type="button"
                            className="w-9 h-9 rounded-full flex items-center justify-center text-base-content/35 cursor-not-allowed"
                            disabled
                            title="Coming soon"
                        >
                            <Phone size={18} strokeWidth={2} />
                        </button>
                        <button
                            type="button"
                            className="w-9 h-9 rounded-full flex items-center justify-center text-base-content/35 cursor-not-allowed"
                            disabled
                            title="Coming soon"
                        >
                            <Video size={18} strokeWidth={2} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowInfo(true)}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-base-content/70 hover:bg-base-200 hover:text-base-content active:scale-95 transition-all"
                        >
                            <MoreVertical size={18} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Pinned Message Banner */}
            {pinnedMessages.length > 0 && activePinned && (
                <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-300">
                    <button
                        onClick={handlePinnedClick}
                        className="flex items-center gap-2 overflow-hidden flex-1 text-left hover:opacity-85 transition-opacity"
                    >
                        <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="text-xs truncate">
                            <span className="font-semibold text-primary">Pinned: </span>
                            <span className="text-base-content/70">
                                {activePinned.text || "📷 Photo"}
                            </span>
                            <span className="text-base-content/40 ml-1">
                                • {activePinned.senderId?.fullName?.split(" ")[0]}
                            </span>
                        </div>
                    </button>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        {pinnedMessages.length > 1 && (
                            <div className="flex items-center gap-1.5 bg-base-200/50 px-1.5 py-0.5 rounded-full border border-base-content/5 text-[10px] font-medium text-base-content/60">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPinnedIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
                                    }}
                                    className="hover:text-base-content transition-colors"
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </button>
                                <span>{activePinnedIndex + 1}/{pinnedMessages.length}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPinnedIndex((prev) => (prev + 1) % pinnedMessages.length);
                                    }}
                                    className="hover:text-base-content transition-colors"
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        {isAdmin && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    unpinMessage(selectedGroup._id, activePinned._id);
                                }}
                                className="btn btn-ghost btn-xs btn-circle h-6 w-6"
                                title="Unpin"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Online Members Dialog */}
            <Dialog
                open={showOnlineDialog}
                onClose={() => setShowOnlineDialog(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    className: "bg-base-100 text-base-content rounded-2xl border border-base-content/10"
                }}
            >
                <DialogTitle className="flex justify-between items-center border-b border-base-content/10 py-3 px-4">
                    <span className="font-bold text-base">Group Members</span>
                    <button onClick={() => setShowOnlineDialog(false)} className="btn btn-ghost btn-xs btn-circle">
                        <CloseIcon size={18} />
                    </button>
                </DialogTitle>
                <DialogContent className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="p-3 border-b border-base-content/5">
                        <div className="flex gap-2">
                            <span className="badge badge-primary px-3 py-2 font-medium">{onlineCount} Online</span>
                            <span className="badge badge-ghost px-3 py-2 font-medium">{memberCount} Total</span>
                        </div>
                    </div>
                    <div className="divide-y divide-base-content/5">
                        {selectedGroup.members?.map((m) => {
                            const u = m.user || m;
                            const isUserOnline = onlineUsers.includes(String(u._id || u));
                            const name = String(u._id || u) === String(authUser?._id) ? "You" : (u.fullName || "Member");
                            return (
                                <div key={u._id || u} className="flex items-center gap-3 p-3 hover:bg-base-200/50 transition-colors">
                                    <div className="relative">
                                        <img
                                            src={u.profilePic || defaultAvatar}
                                            alt={name}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        {isUserOnline && (
                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-base-100 rounded-full"></span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{name}</p>
                                        <p className="text-xs text-base-content/50 capitalize">{m.role || "member"}</p>
                                    </div>
                                    {isUserOnline && (
                                        <span className="text-xs text-green-500 font-semibold bg-green-500/10 px-2 py-0.5 rounded-full">online</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Group Info Panel */}
            <GroupInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </>
    );
};

export default GroupChatHeader;

