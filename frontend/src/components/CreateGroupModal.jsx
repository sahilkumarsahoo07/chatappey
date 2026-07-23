import { useState, useEffect } from "react";
import { X, Camera, Search, Check, UsersRound } from "lucide-react";
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
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-in fade-in duration-200">
            {/* Modal Container */}
            <div className="bg-base-100 w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
                
                {/* Header (WhatsApp Web style: flat, simple, distinctive color or just base-200) */}
                <div className="bg-base-200/50 px-5 py-4 flex items-center justify-between border-b border-base-300">
                    <h2 className="text-xl font-semibold text-base-content">Create Group</h2>
                    <button onClick={onClose} className="p-2 hover:bg-base-300 rounded-full transition-colors">
                        <X className="w-5 h-5 text-base-content/70" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin" }}>
                    
                    {/* Top Section: Avatar & Name */}
                    <div className="p-6 flex flex-col items-center border-b border-base-200 bg-base-100/50">
                        {/* Group Image */}
                        <div className="relative group cursor-pointer mb-5">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-base-200 flex items-center justify-center shadow-sm">
                                {groupImage ? (
                                    <img src={groupImage} alt="Group preview" className="w-full h-full object-cover" />
                                ) : (
                                    <UsersRound className="w-12 h-12 text-base-content/30" />
                                )}
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-6 h-6 text-white mb-1" />
                                    <span className="text-white text-xs font-medium uppercase tracking-wider">Add Photo</span>
                                </div>
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={handleImageChange}
                            />
                        </div>

                        {/* Group Name Input */}
                        <div className="w-full max-w-sm relative">
                            <input
                                type="text"
                                placeholder="Group Subject"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                maxLength={25}
                                className="w-full bg-transparent border-b-2 border-base-300 focus:border-primary py-2 text-center text-lg outline-none transition-colors placeholder:text-base-content/30 text-base-content font-medium"
                            />
                            <div className="absolute right-0 bottom-2 text-xs text-base-content/40 font-medium">
                                {25 - groupName.length}
                            </div>
                        </div>
                    </div>

                    {/* Member Selection Section */}
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <span className="font-medium text-base-content/70 text-sm uppercase tracking-wider">
                                Add Members
                            </span>
                            <span className="text-sm font-semibold text-primary">
                                {selectedMembers.length} selected
                            </span>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4 px-2">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-base-content/40" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search contacts"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-base-200 border-none rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-base-content/50"
                            />
                        </div>

                        {/* Selected Members Pills */}
                        {selectedMembers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4 px-2">
                                {selectedMembers.map(memberId => {
                                    const member = friends.find(f => f._id === memberId);
                                    if (!member) return null;
                                    return (
                                        <div key={memberId} className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium animate-in zoom-in duration-200">
                                            <img src={member.profilePic || defaultAvatar} className="w-5 h-5 rounded-full object-cover" />
                                            {member.fullName.split(" ")[0]}
                                            <button onClick={() => toggleMember(memberId)} className="hover:bg-primary/20 rounded-full p-0.5 ml-1 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Friends List */}
                        <div className="space-y-1">
                            {filteredFriends.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-sm text-base-content/50">No contacts found.</p>
                                </div>
                            ) : (
                                filteredFriends.map(friend => {
                                    const isSelected = selectedMembers.includes(friend._id);
                                    return (
                                        <div
                                            key={friend._id}
                                            onClick={() => toggleMember(friend._id)}
                                            className="flex items-center gap-4 p-3 rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors"
                                        >
                                            {/* Avatar */}
                                            <img
                                                src={friend.profilePic || defaultAvatar}
                                                alt={friend.fullName}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                            
                                            {/* Name */}
                                            <div className="flex-1 border-b border-base-200/50 pb-3 mt-3">
                                                <h4 className="font-medium text-base-content text-[15px]">
                                                    {friend.fullName}
                                                </h4>
                                            </div>

                                            {/* Custom Checkbox (WhatsApp style) */}
                                            <div className={`w-5 h-5 rounded-sm flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-2 border-base-content/30'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-primary-content" strokeWidth={3} />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Floating Action Footer (WhatsApp Style Green Check FAB) */}
                <div className="p-4 bg-base-100 border-t border-base-300 flex justify-end">
                    <button
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
                        className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-content flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                    >
                        {isCreating ? (
                            <span className="loading loading-spinner loading-md"></span>
                        ) : (
                            <Check className="w-7 h-7" strokeWidth={2.5} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
