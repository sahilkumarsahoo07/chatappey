import { useState, useEffect } from "react";
import { X, Users, LogOut, Trash2, UserPlus, UserMinus, Edit2, Camera, Check, MoreVertical, Shield, ShieldOff, ShieldCheck, Search, Megaphone } from "lucide-react";
import { Menu, MenuItem } from "@mui/material";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import defaultAvatar from "../public/avatar.png";

const GroupInfoPanel = ({ isOpen, onClose }) => {
    const { selectedGroup, updateGroup, deleteGroup, addMembers, removeMember, leaveGroup, updateMemberRole } = useGroupStore();
    const { users } = useChatStore();
    const { authUser } = useAuthStore();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editImage, setEditImage] = useState("");
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [selectedNewMembers, setSelectedNewMembers] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuMember, setMenuMember] = useState(null);

    const isOwner = selectedGroup?.admin?._id === authUser?._id;
    const members = selectedGroup?.members || [];
    const currentUserMember = members.find(m => (m.user?._id || m.user || m).toString() === authUser?._id);
    const isAdmin = isOwner || currentUserMember?.role === "admin";

    // Friends who are not already in the group
    const availableFriends = users.filter(
        user => user.isFriend && !members.some(m => (m.user?._id || m._id) === user._id)
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

    const handleTransferOwnership = async (userId) => {
        handleCloseMenu();
        if (!confirm("Are you sure you want to transfer group ownership? You will no longer be the owner.")) return;

        try {
            await updateGroup(selectedGroup._id, { admin: userId });
            toast.success("Ownership transferred successfully!");
        } catch (error) {
            console.error("Failed to transfer ownership:", error);
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
        handleCloseMenu();
        if (!confirm("Remove this member from the group?")) return;

        try {
            await removeMember(selectedGroup._id, userId);
        } catch (error) {
            console.error("Failed to remove member:", error);
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        handleCloseMenu();
        try {
            await updateMemberRole(selectedGroup._id, userId, newRole);
        } catch (error) {
            console.error("Failed to update role:", error);
        }
    };

    const handleOpenMenu = (event, member) => {
        setAnchorEl(event.currentTarget);
        setMenuMember(member);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuMember(null);
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

    const handleToggleAnnouncement = async () => {
        try {
            await updateGroup(selectedGroup._id, {
                announcementOnly: !selectedGroup.announcementOnly
            });
            toast.success(`Announcement mode ${!selectedGroup.announcementOnly ? "enabled" : "disabled"}`);
        } catch (error) {
            console.error("Failed to toggle announcement mode:", error);
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
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-50"
            onClick={onClose}
        >
            <div
                className="bg-base-100 w-full max-w-sm h-full overflow-y-auto shadow-2xl animate-slide-in-right"
                onClick={(e) => e.stopPropagation()}
            >
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

                    {/* Member Search */}
                    {members.length > 5 && (
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                            <input
                                type="text"
                                placeholder="Search members..."
                                value={memberSearchQuery}
                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                className="input input-bordered input-sm w-full pl-9 h-9 text-sm"
                            />
                            {memberSearchQuery && (
                                <button
                                    onClick={() => setMemberSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                >
                                    <X className="w-3 h-3 text-base-content/40" />
                                </button>
                            )}
                        </div>
                    )}

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
                        {members
                            .filter(m => {
                                const member = m.user || m;
                                return member.fullName?.toLowerCase().includes(memberSearchQuery.toLowerCase());
                            })
                            .map(m => {
                                const member = m.user || m;
                                const isMemberOwner = selectedGroup.admin?._id === member._id;
                                const isMemberAdmin = m.role === "admin" || isMemberOwner;

                                return (
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
                                            <div className="flex items-center gap-1">
                                                {isMemberOwner && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Owner</span>
                                                )}
                                                {isMemberAdmin && !isMemberOwner && (
                                                    <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Menu Trigger (Only if currentUser is Admin and target is not themselves) */}
                                        {isAdmin && member._id !== authUser._id && (
                                            <button
                                                onClick={(e) => handleOpenMenu(e, m)}
                                                className="btn btn-ghost btn-xs btn-circle"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                    </div>

                    {/* Member Action Menu */}
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleCloseMenu}
                        PaperProps={{
                            className: "bg-base-100 border border-base-300 shadow-xl"
                        }}
                    >
                        {/* Only owner can promote/demote admins */}
                        {isOwner && menuMember?.role !== "admin" && (
                            <MenuItem
                                onClick={() => handleUpdateRole(menuMember.user?._id || menuMember.user || menuMember, "admin")}
                                className="text-sm gap-2"
                            >
                                <Shield className="w-4 h-4 text-primary" /> Make Admin
                            </MenuItem>
                        )}
                        {isOwner && menuMember?.role === "admin" && (
                            <MenuItem
                                onClick={() => handleUpdateRole(menuMember.user?._id || menuMember.user || menuMember, "member")}
                                className="text-sm gap-2"
                            >
                                <ShieldOff className="w-4 h-4 text-error" /> Dismiss Admin
                            </MenuItem>
                        )}

                        {/* Transfer Ownership (Only owner can see this for other admins) */}
                        {isOwner && menuMember?.role === "admin" && (
                            <MenuItem
                                onClick={() => handleTransferOwnership(menuMember.user?._id || menuMember.user || menuMember)}
                                className="text-sm gap-2"
                            >
                                <ShieldCheck className="w-4 h-4 text-warning" /> Transfer Ownership
                            </MenuItem>
                        )}

                        {/* Any admin can remove a member (if not owner, they can't remove other admins based on backend logic) */}
                        <MenuItem
                            onClick={() => handleRemoveMember(menuMember.user?._id || menuMember.user || menuMember)}
                            className="text-sm gap-2 text-error"
                        >
                            <UserMinus className="w-4 h-4" /> Remove Member
                        </MenuItem>
                    </Menu>
                </div>

                {/* Settings Section (Admins only) */}
                {isAdmin && (
                    <div className="p-4 border-t border-base-300">
                        <h4 className="font-semibold text-sm text-base-content/70 mb-3">Settings</h4>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-base-200 transition-colors">
                            <div className="flex items-center gap-3">
                                <Megaphone className="w-4 h-4 text-base-content/60" />
                                <div>
                                    <p className="text-sm font-medium">Announcement Mode</p>
                                    <p className="text-[10px] text-base-content/50">Only admins can send messages</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                className="toggle toggle-primary toggle-sm"
                                checked={selectedGroup.announcementOnly || false}
                                onChange={handleToggleAnnouncement}
                            />
                        </div>
                    </div>
                )}

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
