import { ArrowLeft, MoreVertical, Users, Phone, Video, Pin, X as CloseIcon, Search } from "lucide-react";
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

const GroupChatHeader = ({ onSearchOpen }) => {
    const { selectedGroup, clearSelectedGroup, unpinMessage, typingUsers, recordingUsers } =
        useGroupStore(
            useShallow((s) => ({
                selectedGroup: s.selectedGroup,
                clearSelectedGroup: s.clearSelectedGroup,
                unpinMessage: s.unpinMessage,
                typingUsers: s.typingUsers,
                recordingUsers: s.recordingUsers,
            }))
        );
    const { setSelectedUser } = useChatStore();
    const { authUser } = useAuthStore();
    const [showInfo, setShowInfo] = useState(false);

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
    const memberNames = selectedGroup.members
        ?.slice(0, 3)
        .map((m) => (m.user?.fullName || m.fullName)?.split(" ")[0])
        .join(", ");
    const moreCount = memberCount > 3 ? ` +${memberCount - 3}` : "";

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
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-base-300/60">
                            {selectedGroup.image ? (
                                <img
                                    src={selectedGroup.image}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Users className="w-5 h-5 text-primary" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[15px] sm:text-base text-base-content truncate leading-tight">
                                {selectedGroup.name}
                            </h3>
                            <p
                                className={`text-[11px] sm:text-xs truncate mt-0.5 leading-tight ${
                                    presenceLabel
                                        ? "text-primary font-medium"
                                        : "text-base-content/55"
                                }`}
                            >
                                {presenceLabel || `${memberNames}${moreCount}`}
                            </p>
                        </div>
                    </button>

                    <div className="flex items-center shrink-0 gap-0.5">
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
            {selectedGroup.pinnedMessage && (
                <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="text-xs truncate">
                            <span className="font-semibold text-primary">Pinned: </span>
                            <span className="text-base-content/70">
                                {selectedGroup.pinnedMessage.text || "📷 Photo"}
                            </span>
                            <span className="text-base-content/40 ml-1">
                                • {selectedGroup.pinnedMessage.senderId?.fullName?.split(" ")[0]}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        {isAdmin && (
                            <button
                                onClick={() => unpinMessage(selectedGroup._id)}
                                className="btn btn-ghost btn-xs btn-circle h-6 w-6"
                                title="Unpin"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Group Info Panel */}
            <GroupInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </>
    );
};

export default GroupChatHeader;
