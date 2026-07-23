import { useState, useEffect } from "react";
import { X, Camera, Search, Check, Users, UsersRound, ArrowRight, Loader2, ImagePlus } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import defaultAvatar from "../public/avatar.png";

const CreateGroupModal = ({ isOpen, onClose }) => {
    const [groupName, setGroupName] = useState("");
    const [groupImage, setGroupImage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    const { users } = useChatStore();
    const { createGroup } = useGroupStore();

    // Filter only friends for group creation
    const friends = users.filter(user => user.isFriend);

    const filteredFriends = friends.filter(friend =>
        friend.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setGroupImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleMember = (userId) => {
        setSelectedMembers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            }
            return [...prev, userId];
        });
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) {
            return;
        }

        setIsCreating(true);
        try {
            await createGroup({
                name: groupName.trim(),
                image: groupImage,
                members: selectedMembers
            });
            onClose();
            resetForm();
        } catch (error) {
            console.error("Failed to create group:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const resetForm = () => {
        setGroupName("");
        setGroupImage("");
        setSearchQuery("");
        setSelectedMembers([]);
    };

    useEffect(() => {
        if (!isOpen) {
            resetForm();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-base-100 rounded-[2rem] w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative flex flex-col">
                
                {/* Decorative header accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-primary" />

                {/* Header */}
                <div className="px-6 pt-8 pb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-base-content tracking-tight">New Group</h2>
                        <p className="text-sm text-base-content/60 mt-1">Add members and set a subject</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost btn-sm btn-circle bg-base-200 hover:bg-base-300 transition-colors"
                    >
                        <X className="w-5 h-5 text-base-content/70" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 overflow-y-auto flex-1 custom-scrollbar">
                    
                    {/* Top Section: Avatar & Name */}
                    <div className="flex items-center gap-5 mb-8 mt-2">
                        {/* Group Image */}
                        <div className="relative group shrink-0 cursor-pointer">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-base-200 flex items-center justify-center border-[3px] border-base-100 shadow-md transition-transform group-hover:scale-105">
                                {groupImage ? (
                                    <img
                                        src={groupImage}
                                        alt="Group preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <UsersRound className="w-8 h-8 text-base-content/40" />
                                )}
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center transition-all">
                                    <Camera className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            {/* Floating Add Badge */}
                            {!groupImage && (
                                <div className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full p-1.5 shadow-sm border-2 border-base-100">
                                    <ImagePlus className="w-4 h-4" />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={handleImageChange}
                            />
                        </div>

                        {/* Group Name Input */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Group Subject"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                maxLength={50}
                                className="w-full bg-transparent border-b-2 border-base-300 focus:border-emerald-500 py-2 text-lg outline-none transition-colors placeholder:text-base-content/30 font-medium text-base-content"
                            />
                            <div className="absolute right-0 bottom-2 text-xs text-base-content/40 font-medium">
                                {50 - groupName.length}
                            </div>
                        </div>
                    </div>

                    {/* Member Selection Section */}
                    <div className="mb-2">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-sm text-base-content/80">Add Members</h3>
                            <span className="text-xs font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                                {selectedMembers.length} selected
                            </span>
                        </div>

                        {/* Selected Members Pills (Horizontal scroll) */}
                        {selectedMembers.length > 0 && (
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                                {selectedMembers.map(memberId => {
                                    const member = friends.find(f => f._id === memberId);
                                    if (!member) return null;
                                    return (
                                        <div
                                            key={memberId}
                                            className="snap-start shrink-0 flex items-center gap-1.5 bg-base-200 border border-base-300 pl-1 pr-2 py-1 rounded-full animate-in zoom-in duration-200"
                                        >
                                            <img src={member.profilePic || defaultAvatar} className="w-6 h-6 rounded-full object-cover" />
                                            <span className="text-xs font-semibold text-base-content/80">{member.fullName.split(" ")[0]}</span>
                                            <button
                                                onClick={() => toggleMember(memberId)}
                                                className="hover:bg-base-300 rounded-full p-0.5 transition-colors ml-1"
                                            >
                                                <X className="w-3 h-3 text-base-content/50 hover:text-error" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                            <input
                                type="text"
                                placeholder="Search friends..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-base-200/50 border border-base-300 focus:bg-base-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all placeholder:text-base-content/40"
                            />
                        </div>

                        {/* Friends List */}
                        <div className="space-y-1 pb-4">
                            {filteredFriends.length === 0 ? (
                                <div className="text-center py-8 px-4 bg-base-200/30 rounded-2xl border border-base-200 border-dashed">
                                    <Users className="w-8 h-8 text-base-content/20 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-base-content/50">
                                        {friends.length === 0 ? "You have no friends to add." : "No friends found matching your search."}
                                    </p>
                                </div>
                            ) : (
                                filteredFriends.map(friend => {
                                    const isSelected = selectedMembers.includes(friend._id);
                                    return (
                                        <div
                                            key={friend._id}
                                            onClick={() => toggleMember(friend._id)}
                                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 group
                                                ${isSelected 
                                                    ? "bg-emerald-500/10 border border-emerald-500/20" 
                                                    : "hover:bg-base-200 border border-transparent"
                                                }`}
                                        >
                                            <div className="relative">
                                                <img
                                                    src={friend.profilePic || defaultAvatar}
                                                    alt={friend.fullName}
                                                    className="w-11 h-11 rounded-full object-cover shadow-sm"
                                                />
                                                {/* Checkmark overlay that fades in when selected */}
                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-base-100 flex items-center justify-center transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`}>
                                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-base-content truncate text-sm">
                                                    {friend.fullName}
                                                </h4>
                                            </div>

                                            {/* Selection indicator circle */}
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mr-1
                                                ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-base-300 group-hover:border-base-content/30'}
                                            `}>
                                                <Check className={`w-3 h-3 text-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-base-200/30 border-t border-base-300 mt-auto">
                    <button
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
                        className="btn w-full rounded-full border-none shadow-lg h-12 text-sm font-bold
                                 bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-base-300 disabled:text-base-content/30 disabled:shadow-none
                                 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Creating Group...
                            </>
                        ) : (
                            <>
                                Create Group
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
