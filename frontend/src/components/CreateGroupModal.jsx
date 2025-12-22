import { useState, useEffect } from "react";
import { X, Camera, Search, Check } from "lucide-react";
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
        if (!groupName.trim()) {
            return;
        }

        if (selectedMembers.length === 0) {
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-base-100 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-primary/10 p-4 flex items-center justify-between border-b border-base-300">
                    <h2 className="text-lg font-semibold">Create New Group</h2>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost btn-sm btn-circle"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Group Image */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-base-200 flex items-center justify-center border-4 border-base-300">
                                {groupImage ? (
                                    <img
                                        src={groupImage}
                                        alt="Group"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Camera className="w-8 h-8 text-base-content/50" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 btn btn-circle btn-sm btn-primary cursor-pointer">
                                <Camera className="w-4 h-4" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Group Name */}
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Group name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            maxLength={50}
                            className="input input-bordered w-full focus:input-primary"
                        />
                    </div>

                    {/* Member Selection */}
                    <div className="mb-4">
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
                            <input
                                type="text"
                                placeholder="Search friends..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input input-bordered w-full pl-10 input-sm"
                            />
                        </div>

                        {/* Selected Members Preview */}
                        {selectedMembers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 p-2 bg-base-200 rounded-lg">
                                {selectedMembers.map(memberId => {
                                    const member = friends.find(f => f._id === memberId);
                                    return member ? (
                                        <div
                                            key={memberId}
                                            className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded-full text-sm"
                                        >
                                            <span>{member.fullName.split(" ")[0]}</span>
                                            <button
                                                onClick={() => toggleMember(memberId)}
                                                className="hover:text-error"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        )}

                        {/* Friends List */}
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {filteredFriends.length === 0 ? (
                                <p className="text-center text-base-content/50 py-4">
                                    {friends.length === 0 ? "No friends to add" : "No matching friends"}
                                </p>
                            ) : (
                                filteredFriends.map(friend => (
                                    <div
                                        key={friend._id}
                                        onClick={() => toggleMember(friend._id)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                      ${selectedMembers.includes(friend._id)
                                                ? "bg-primary/20"
                                                : "hover:bg-base-200"
                                            }`}
                                    >
                                        <img
                                            src={friend.profilePic || defaultAvatar}
                                            alt={friend.fullName}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        <span className="flex-1 font-medium">{friend.fullName}</span>
                                        {selectedMembers.includes(friend._id) && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                <Check className="w-3 h-3 text-primary-content" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-base-300 flex gap-3">
                    <button
                        onClick={onClose}
                        className="btn btn-ghost flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
                        className="btn btn-primary flex-1"
                    >
                        {isCreating ? (
                            <span className="loading loading-spinner loading-sm" />
                        ) : (
                            "Create Group"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
