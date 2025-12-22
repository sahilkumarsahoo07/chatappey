import { ArrowLeft, MoreVertical, Users, Phone, Video } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import defaultAvatar from "../public/avatar.png";
import { useState } from "react";
import GroupInfoPanel from "./GroupInfoPanel";

const GroupChatHeader = () => {
    const { selectedGroup, clearSelectedGroup } = useGroupStore();
    const { setSelectedUser } = useChatStore();
    const [showInfo, setShowInfo] = useState(false);

    const handleBack = () => {
        clearSelectedGroup();
        setSelectedUser(null);
    };

    if (!selectedGroup) return null;

    const memberCount = selectedGroup.members?.length || 0;
    const memberNames = selectedGroup.members
        ?.slice(0, 3)
        .map(m => m.fullName?.split(" ")[0])
        .join(", ");
    const moreCount = memberCount > 3 ? ` +${memberCount - 3}` : "";

    return (
        <>
            <div className="p-3 border-b border-base-300 bg-base-100/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Back button - mobile */}
                        <button
                            onClick={handleBack}
                            className="btn btn-ghost btn-sm btn-circle lg:hidden"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        {/* Group avatar */}
                        <div
                            onClick={() => setShowInfo(true)}
                            className="cursor-pointer"
                        >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                                {selectedGroup.image ? (
                                    <img
                                        src={selectedGroup.image}
                                        alt={selectedGroup.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Users className="w-5 h-5 text-primary" />
                                )}
                            </div>
                        </div>

                        {/* Group info */}
                        <div
                            onClick={() => setShowInfo(true)}
                            className="cursor-pointer"
                        >
                            <h3 className="font-semibold text-base-content">
                                {selectedGroup.name}
                            </h3>
                            <p className="text-xs text-base-content/60">
                                {memberNames}{moreCount}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <button className="btn btn-ghost btn-sm btn-circle opacity-50 cursor-not-allowed">
                            <Phone className="w-5 h-5" />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-circle opacity-50 cursor-not-allowed">
                            <Video className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowInfo(true)}
                            className="btn btn-ghost btn-sm btn-circle"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Group Info Panel */}
            <GroupInfoPanel
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </>
    );
};

export default GroupChatHeader;
