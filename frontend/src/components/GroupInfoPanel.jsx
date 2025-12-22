import { useState, useEffect } from "react";
import { X, Users, LogOut, Trash2, UserPlus, UserMinus, Edit2, Camera, Check } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import defaultAvatar from "../public/avatar.png";

const GroupInfoPanel = ({ isOpen, onClose }) => {
    const { selectedGroup, updateGroup, deleteGroup, addMembers, removeMember, leaveGroup } = useGroupStore();
    const { users } = useChatStore();
    const { authUser } = useAuthStore();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editImage, setEditImage] = useState("");
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [selectedNewMembers, setSelectedNewMembers] = useState([]);

    const isAdmin = selectedGroup?.admin?._id === authUser?._id;
    const members = selectedGroup?.members || [];

    // Friends who are not already in the group
    const availableFriends = users.filter(
        user => user.isFriend && !members.some(m => m._id === user._id)
    );

    useEffect(() => {
        if (selectedGroup) {
            setEditName(selectedGroup.name);
            setEditImage(selectedGroup.image);
        }
    }, [selectedGroup]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return;

        try {
            await updateGroup(selectedGroup._id, {
                name: editName.trim(),
                image: editImage !== selectedGroup.image ? editImage : undefined
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update group:", error);
        }
    };

    const handleAddMembers = async () => {
        if (selectedNewMembers.length === 0) return;

        try {
            await addMembers(selectedGroup._id, selectedNewMembers);
            setShowAddMembers(false);
            setSelectedNewMembers([]);
        } catch (error) {
            console.error("Failed to add members:", error);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm("Remove this member from the group?")) return;

        try {
            await removeMember(selectedGroup._id, userId);
        } catch (error) {
            console.error("Failed to remove member:", error);
        }
    };

    const handleLeaveGroup = async () => {
        if (!confirm("Are you sure you want to leave this group?")) return;

        try {
            await leaveGroup(selectedGroup._id);
            onClose();
        } catch (error) {
            console.error("Failed to leave group:", error);
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return;

        try {
            await deleteGroup(selectedGroup._id);
            onClose();
        } catch (error) {
            console.error("Failed to delete group:", error);
        }
    };

    const toggleNewMember = (userId) => {
        setSelectedNewMembers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            }
            return [...prev, userId];
        });
    };

    if (!isOpen || !selectedGroup) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-50">
            <div className="bg-base-100 w-full max-w-sm h-full overflow-y-auto shadow-2xl animate-slide-in-right">
                {/* Header */}
                <div className="sticky top-0 bg-base-100 p-4 border-b border-base-300 flex items-center justify-between z-10">
                    <h2 className="text-lg font-semibold">Group Info</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Group Image & Name */}
                <div className="p-6 flex flex-col items-center border-b border-base-300">
                    <div className="relative mb-4">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                            {(isEditing ? editImage : selectedGroup.image) ? (
                                <img
                                    src={isEditing ? editImage : selectedGroup.image}
                                    alt={selectedGroup.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Users className="w-10 h-10 text-primary" />
                            )}
                        </div>
                        {isEditing && isAdmin && (
                            <label className="absolute bottom-0 right-0 btn btn-circle btn-sm btn-primary cursor-pointer">
                                <Camera className="w-4 h-4" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="flex gap-2 w-full max-w-xs">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="input input-bordered input-sm flex-1"
                                maxLength={50}
                            />
                            <button onClick={handleSaveEdit} className="btn btn-primary btn-sm">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsEditing(false)} className="btn btn-ghost btn-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold">{selectedGroup.name}</h3>
                            {isAdmin && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn btn-ghost btn-sm btn-circle"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}

                    <p className="text-sm text-base-content/60 mt-1">
                        Group · {members.length} members
                    </p>
                </div>

                {/* Members Section */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm text-base-content/70">
                            Members ({members.length})
                        </h4>
                        {isAdmin && (
                            <button
                                onClick={() => setShowAddMembers(!showAddMembers)}
                                className="btn btn-ghost btn-xs gap-1"
                            >
                                <UserPlus className="w-4 h-4" />
                                Add
                            </button>
                        )}
                    </div>

                    {/* Add Members Section */}
                    {showAddMembers && (
                        <div className="bg-base-200 rounded-lg p-3 mb-3">
                            <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                                {availableFriends.length === 0 ? (
                                    <p className="text-sm text-center text-base-content/50 py-2">
                                        No friends to add
                                    </p>
                                ) : (
                                    availableFriends.map(friend => (
                                        <div
                                            key={friend._id}
                                            onClick={() => toggleNewMember(friend._id)}
                                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                        ${selectedNewMembers.includes(friend._id)
                                                    ? "bg-primary/20"
                                                    : "hover:bg-base-300"
                                                }`}
                                        >
                                            <img
                                                src={friend.profilePic || defaultAvatar}
                                                alt={friend.fullName}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                            <span className="text-sm flex-1">{friend.fullName}</span>
                                            {selectedNewMembers.includes(friend._id) && (
                                                <Check className="w-4 h-4 text-primary" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            {selectedNewMembers.length > 0 && (
                                <button
                                    onClick={handleAddMembers}
                                    className="btn btn-primary btn-sm w-full"
                                >
                                    Add {selectedNewMembers.length} member(s)
                                </button>
                            )}
                        </div>
                    )}

                    {/* Members List */}
                    <div className="space-y-1">
                        {members.map(member => (
                            <div
                                key={member._id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200"
                            >
                                <img
                                    src={member.profilePic || defaultAvatar}
                                    alt={member.fullName}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-sm">
                                        {member.fullName}
                                        {member._id === authUser._id && " (You)"}
                                    </p>
                                    {member._id === selectedGroup.admin?._id && (
                                        <span className="text-xs text-primary">Admin</span>
                                    )}
                                </div>
                                {isAdmin && member._id !== authUser._id && (
                                    <button
                                        onClick={() => handleRemoveMember(member._id)}
                                        className="btn btn-ghost btn-xs btn-circle text-error"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-base-300 space-y-2">
                    {!isAdmin && (
                        <button
                            onClick={handleLeaveGroup}
                            className="btn btn-error btn-outline w-full gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Leave Group
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={handleDeleteGroup}
                            className="btn btn-error w-full gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Group
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupInfoPanel;
