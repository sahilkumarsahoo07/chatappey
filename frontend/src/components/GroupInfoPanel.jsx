import { useState, useEffect } from "react";
import { 
    X, Users, LogOut, Trash2, UserPlus, UserMinus, Edit2, Camera, 
    Check, MoreVertical, Shield, ShieldOff, ShieldCheck, Search, Megaphone,
    Phone, Video, Star, Pin, Bell, Timer, Palette, Image as ImageIcon,
    Settings, AlertTriangle, ChevronRight, Link, ArrowLeft
} from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatFeaturesStore } from "../store/useChatFeaturesStore";
import defaultAvatar from "../public/avatar.png";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

const GroupInfoPanel = ({ isOpen, onClose }) => {
    const { selectedGroup, updateGroup, deleteGroup, addMembers, removeMember, leaveGroup, updateMemberRole, groupMessages } = useGroupStore();
    const { users } = useChatStore();
    const { authUser } = useAuthStore();
    const { starredItems, loadStarred } = useChatFeaturesStore();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editImage, setEditImage] = useState("");
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editDesc, setEditDesc] = useState("");
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [selectedNewMembers, setSelectedNewMembers] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [showSearchField, setShowSearchField] = useState(false);
    
    // UI states
    const [menuMember, setMenuMember] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [showPermissions, setShowPermissions] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMedia, setShowMedia] = useState(false);
    const [showStarred, setShowStarred] = useState(false);
    const [showPinned, setShowPinned] = useState(false);
    const [showDisappearing, setShowDisappearing] = useState(false);

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
            setEditDesc(selectedGroup.description || "");
        }
    }, [selectedGroup]);

    useEffect(() => {
        if (showStarred) {
            loadStarred();
        }
    }, [showStarred, loadStarred]);

    const groupStarredMessages = starredItems.filter(
        item => item.chatType === 'group' && item.targetId === selectedGroup?._id
    );

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const toastId = toast.loading("Updating group photo...");
                    await updateGroup(selectedGroup._id, { image: reader.result });
                    toast.success("Group photo updated!", { id: toastId });
                } catch (error) {
                    toast.error("Failed to update photo");
                    console.error("Failed to update group image:", error);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return;

        try {
            await updateGroup(selectedGroup._id, {
                name: editName.trim()
            });
            setIsEditing(false);
            toast.success("Group name updated");
        } catch (error) {
            toast.error("Failed to update group");
            console.error("Failed to update group:", error);
        }
    };

    const handleTransferOwnership = async (userId) => {
        setMenuMember(null);
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
        setMenuMember(null);
        if (!confirm("Remove this member from the group?")) return;

        try {
            await removeMember(selectedGroup._id, userId);
        } catch (error) {
            console.error("Failed to remove member:", error);
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        setMenuMember(null);
        try {
            await updateMemberRole(selectedGroup._id, userId, newRole);
        } catch (error) {
            console.error("Failed to update role:", error);
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

    const handleInviteLink = () => {
        const inviteLink = `${window.location.origin}/join/${selectedGroup._id}`;
        navigator.clipboard.writeText(inviteLink);
        toast.success("Invite link copied to clipboard!");
    };

    const handleToggleAnnouncement = async () => {
        try {
            await updateGroup(selectedGroup._id, {
                announcementOnly: !selectedGroup.announcementOnly
            });
        } catch (error) {
            console.error("Failed to toggle announcement mode:", error);
        }
    };

    const handleToggleEditInfo = async () => {
        try {
            await updateGroup(selectedGroup._id, {
                editInfoRestricted: !selectedGroup.editInfoRestricted
            });
        } catch (error) {
            console.error("Failed to toggle edit info restriction:", error);
        }
    };


    const handleToggleAddMembers = async () => {
        try {
            await updateGroup(selectedGroup._id, {
                addMembersRestricted: !selectedGroup.addMembersRestricted
            });
        } catch (error) {
            console.error("Failed to toggle add members restriction:", error);
        }
    };

    const handleUpdateDisappearing = async (duration) => {
        try {
            await updateGroup(selectedGroup._id, {
                disappearingMessagesDuration: duration
            });
            setShowDisappearing(false);
        } catch (error) {
            console.error("Failed to update disappearing messages:", error);
            toast.error("Failed to update disappearing messages");
        }
    };

    const handleUpdateDescription = async () => {
        if (!editDesc.trim() && !selectedGroup.description) {
            setIsEditingDesc(false);
            return;
        }
        try {
            await updateGroup(selectedGroup._id, { description: editDesc });
            setIsEditingDesc(false);
        } catch (error) {
            console.error("Failed to update description:", error);
        }
    };

    const handleDeleteGroup = async () => {
        try {
            await deleteGroup(selectedGroup._id);
            onClose();
        } catch (error) {
            console.error("Failed to delete group:", error);
        }
    };

    const toggleNewMember = (userId) => {
        setSelectedNewMembers(prev => {
            if (prev.includes(userId)) return prev.filter(id => id !== userId);
            return [...prev, userId];
        });
    };

    if (!isOpen || !selectedGroup) return null;

    // Helper to render consistent list items
    const ListItem = ({ icon: Icon, title, subtitle, right, onClick, destructive }) => (
        <div 
            onClick={onClick}
            className={`flex items-center gap-5 px-5 py-3.5 bg-base-100 hover:bg-base-200 cursor-pointer transition-colors ${destructive ? 'text-error' : ''}`}
        >
            {Icon && <Icon className={`w-6 h-6 shrink-0 ${destructive ? 'opacity-100' : 'opacity-60'}`} />}
            <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate">{title}</p>
                {subtitle && <p className="text-sm opacity-60 truncate">{subtitle}</p>}
            </div>
            {right && <div className="shrink-0 text-sm opacity-60">{right}</div>}
        </div>
    );

    // Filter members based on search
    const filteredMembers = members.filter(m => {
        const member = m.user || m;
        return member.fullName?.toLowerCase().includes(memberSearchQuery.toLowerCase());
    });

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            {/* Desktop backdrop, invisible on mobile */}
            <div className="absolute inset-0 bg-black/40 hidden md:block" onClick={onClose} />

            <div className="relative w-full h-full md:w-[420px] lg:w-[450px] bg-base-200/90 shadow-2xl flex flex-col transform transition-transform overflow-hidden animate-slide-in-right">
                
                {/* 1. HEADER */}
                <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                    <button onClick={onClose} className="btn btn-ghost btn-circle">
                        <ArrowLeft className="w-6 h-6 md:hidden" />
                        <X className="w-6 h-6 hidden md:block" />
                    </button>
                    <h1 className="text-[17px] font-medium flex-1">Group info</h1>
                </div>

                {/* Permissions Sub-page overlay */}
                {showPermissions && isAdmin && (
                    <div className="absolute inset-0 bg-base-200 z-30 flex flex-col animate-slide-in-right">
                        <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                            <button onClick={() => setShowPermissions(false)} className="btn btn-ghost btn-circle">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-[17px] font-medium flex-1">Group permissions</h1>
                        </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <p className="px-1 text-sm font-medium text-primary">Members can:</p>
                                <div className="bg-base-100 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-base-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-medium text-[15px]">Edit group settings</h3>
                                            <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={!selectedGroup.editInfoRestricted} onChange={handleToggleEditInfo} />
                                        </div>
                                        <p className="text-sm opacity-60">Allow members to change this group's name, icon, and description.</p>
                                    </div>
                                    <div className="p-5 border-b border-base-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-medium text-[15px]">Send messages</h3>
                                            <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={!selectedGroup.announcementOnly} onChange={handleToggleAnnouncement} />
                                        </div>
                                        <p className="text-sm opacity-60">Allow members to send messages to this group.</p>
                                    </div>
                                    <div className="p-5">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-medium text-[15px]">Add other members</h3>
                                            <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={!selectedGroup.addMembersRestricted} onChange={handleToggleAddMembers} />
                                        </div>
                                        <p className="text-sm opacity-60">Allow members to add new people to this group.</p>
                                    </div>
                                </div>
                            </div>
                    </div>
                )}

                {/* Add Members Sub-page overlay */}
                {showAddMembers && (isAdmin || !selectedGroup.addMembersRestricted) && (
                    <div className="absolute inset-0 bg-base-200 z-30 flex flex-col animate-slide-in-right">
                        <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                            <button onClick={() => setShowAddMembers(false)} className="btn btn-ghost btn-circle">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-[17px] font-medium flex-1">Add members</h1>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <p className="text-xs font-semibold opacity-50 mb-3 uppercase tracking-wider px-2">Available Friends</p>
                            <div className="bg-base-100 rounded-2xl overflow-hidden shadow-sm">
                                {availableFriends.length === 0 ? (
                                    <p className="text-[15px] opacity-50 py-5 text-center">No friends to add</p>
                                ) : (
                                    availableFriends.map((friend, index) => (
                                        <div
                                            key={friend._id}
                                            onClick={() => toggleNewMember(friend._id)}
                                            className={`flex items-center gap-4 p-3 cursor-pointer transition-colors ${index !== availableFriends.length - 1 ? 'border-b border-base-200' : ''} ${selectedNewMembers.includes(friend._id) ? "bg-primary/5" : "hover:bg-base-200"}`}
                                        >
                                            <img src={friend.profilePic || defaultAvatar} alt={friend.fullName} className="w-11 h-11 rounded-full object-cover" />
                                            <span className="text-[15px] font-medium flex-1">{friend.fullName}</span>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedNewMembers.includes(friend._id) ? "border-primary bg-primary text-primary-content" : "border-base-300"}`}>
                                                {selectedNewMembers.includes(friend._id) && <Check className="w-4 h-4" />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        {selectedNewMembers.length > 0 && (
                            <div className="shrink-0 p-4 bg-base-100 border-t border-base-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                                <button onClick={handleAddMembers} className="btn btn-primary w-full rounded-full h-12">
                                    Add {selectedNewMembers.length} member{selectedNewMembers.length !== 1 && 's'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Media Sub-page overlay */}
                {showMedia && (
                    <div className="absolute inset-0 bg-base-200 z-30 flex flex-col animate-slide-in-right">
                        <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                            <button onClick={() => setShowMedia(false)} className="btn btn-ghost btn-circle">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-[17px] font-medium flex-1">Media, links, and docs</h1>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {groupMessages.filter(m => m.image || m.video).length > 0 ? (
                                <div className="grid grid-cols-3 gap-1">
                                    {groupMessages.filter(m => m.image || m.video).map(m => (
                                        <div 
                                            key={m._id || Math.random()} 
                                            className="aspect-square bg-base-300 rounded cursor-pointer overflow-hidden hover:opacity-90 transition-opacity" 
                                            onClick={() => m.image ? setPreviewImage(m.image) : null}
                                        >
                                            {m.image ? (
                                                <img src={m.image} alt="Media" className="w-full h-full object-cover" />
                                            ) : (
                                                <video src={m.video} className="w-full h-full object-cover pointer-events-none" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center opacity-50 h-full min-h-[200px]">
                                    <ImageIcon className="w-16 h-16 mb-4" />
                                    <p className="text-[15px]">No media shared in this group yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Starred Messages Sub-page overlay */}
                {showStarred && (
                    <div className="absolute inset-0 bg-base-200 z-30 flex flex-col animate-slide-in-right">
                        <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                            <button onClick={() => setShowStarred(false)} className="btn btn-ghost btn-circle">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-[17px] font-medium flex-1">Starred messages</h1>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {groupStarredMessages.length > 0 ? (
                                groupStarredMessages.map((item) => (
                                    <div key={item.starId} className="bg-base-100 p-3 rounded-2xl mb-2 shadow-sm border border-base-200">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                            <span className="text-xs opacity-50 text-yellow-500 font-medium">Starred</span>
                                            <span className="text-xs opacity-40 ml-auto">{new Date(item.starredAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-[15px] line-clamp-3">{item.message?.text || "Message"}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center opacity-50 h-full min-h-[200px]">
                                    <Star className="w-16 h-16 mb-4" />
                                    <p className="text-[15px]">No starred messages.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Pinned Messages Sub-page overlay */}
                {showPinned && (
                    <div className="absolute inset-0 bg-base-200 z-30 flex flex-col animate-slide-in-right">
                        <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                            <button onClick={() => setShowPinned(false)} className="btn btn-ghost btn-circle">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-[17px] font-medium flex-1">Pinned messages</h1>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {selectedGroup.pinnedMessages && selectedGroup.pinnedMessages.length > 0 ? (
                                selectedGroup.pinnedMessages.map((msg, idx) => (
                                    <div key={idx} className="bg-base-100 p-3 rounded-2xl mb-2 shadow-sm border border-base-200">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Pin className="w-3 h-3 opacity-50" />
                                            <span className="text-xs opacity-50">Pinned message</span>
                                        </div>
                                        <p className="text-[15px] line-clamp-3">{msg.text || "Message"}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center opacity-50 h-full min-h-[200px]">
                                    <Pin className="w-16 h-16 mb-4" />
                                    <p className="text-[15px]">No pinned messages.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Disappearing Messages Sub-page overlay */}
                {showDisappearing && (isAdmin) && (
                    <div className="absolute inset-0 bg-base-200 z-30 flex flex-col animate-slide-in-right">
                        <div className="shrink-0 z-20 bg-base-100 flex items-center gap-3 px-2 py-1 h-14 md:h-16 border-b border-base-300">
                            <button onClick={() => setShowDisappearing(false)} className="btn btn-ghost btn-circle">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-[17px] font-medium flex-1">Disappearing messages</h1>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <Timer className="w-16 h-16 text-primary mb-4" />
                                <p className="text-[15px] opacity-70 px-4">
                                    Make new messages in this chat disappear for everyone after the selected duration.
                                </p>
                            </div>
                            <div className="bg-base-100 rounded-2xl overflow-hidden shadow-sm">
                                {[
                                    { label: "24 hours", value: 24 },
                                    { label: "7 days", value: 168 },
                                    { label: "90 days", value: 2160 },
                                    { label: "Off", value: 0 }
                                ].map((option) => (
                                    <div 
                                        key={option.value}
                                        onClick={() => handleUpdateDisappearing(option.value)}
                                        className="flex justify-between items-center p-4 border-b border-base-200 last:border-b-0 cursor-pointer hover:bg-base-200 transition-colors"
                                    >
                                        <span className="text-[15px]">{option.label}</span>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedGroup.disappearingMessagesDuration === option.value ? "border-primary bg-primary text-primary-content" : "border-base-300"}`}>
                                            {selectedGroup.disappearingMessagesDuration === option.value && <Check className="w-3 h-3" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* MAIN SCROLL CONTENT */}
                <div className="flex-1 overflow-y-auto overscroll-contain pb-safe bg-base-200">
                    
                    {/* 2. GROUP PROFILE SECTION */}
                    <div className="bg-base-100 pb-6 flex flex-col items-center">
                        <div className="relative mt-6 mb-4">
                            <div 
                                className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                                onClick={() => setPreviewImage(selectedGroup.image)}
                            >
                                {selectedGroup.image ? (
                                    <img src={selectedGroup.image} alt={selectedGroup.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Users className="w-14 h-14 text-primary" />
                                )}
                            </div>
                            {(isAdmin || !selectedGroup.editInfoRestricted) && (
                                <label className="absolute bottom-1 right-1 w-11 h-11 bg-primary text-primary-content rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-105 transition-transform border-4 border-base-100">
                                    <Camera className="w-5 h-5" />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                </label>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="flex gap-2 w-full max-w-[300px] px-4">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="input input-bordered input-sm flex-1 text-center font-medium text-xl"
                                    maxLength={50}
                                    autoFocus
                                />
                                <button onClick={handleSaveEdit} className="btn btn-primary btn-sm btn-circle shrink-0"><Check className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-6">
                                <h2 className="text-[22px] font-medium text-center">{selectedGroup.name}</h2>
                                {(isAdmin || !selectedGroup.editInfoRestricted) && (
                                    <button onClick={() => setIsEditing(true)} className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content shrink-0">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <p className="text-[15px] opacity-60 mt-1">Group · {members.length} members</p>

                        {/* 3. QUICK ACTION BUTTONS */}
                        <div className="flex justify-center gap-4 mt-6 px-4 w-full max-w-[360px]">
                            <button className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border border-base-300 hover:bg-base-200 transition-colors gap-1.5 text-primary">
                                <Phone className="w-6 h-6" />
                                <span className="text-[13px] font-medium text-base-content">Audio</span>
                            </button>
                            <button className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border border-base-300 hover:bg-base-200 transition-colors gap-1.5 text-primary">
                                <Video className="w-6 h-6" />
                                <span className="text-[13px] font-medium text-base-content">Video</span>
                            </button>
                            <button className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border border-base-300 hover:bg-base-200 transition-colors gap-1.5 text-primary">
                                <Search className="w-6 h-6" />
                                <span className="text-[13px] font-medium text-base-content">Search</span>
                            </button>
                            {(isAdmin || !selectedGroup.addMembersRestricted) && (
                                <button onClick={() => setShowAddMembers(true)} className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border border-base-300 hover:bg-base-200 transition-colors gap-1.5 text-primary">
                                    <UserPlus className="w-6 h-6" />
                                    <span className="text-[13px] font-medium text-base-content">Add</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="h-2 w-full bg-base-200"></div>

                    {/* 4. GROUP DESCRIPTION */}
                    <div className="bg-base-100 py-4 px-5">
                        {isEditingDesc ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    placeholder="Add group description"
                                    className="textarea textarea-bordered w-full"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-1">
                                    <button onClick={() => setIsEditingDesc(false)} className="btn btn-sm btn-ghost">Cancel</button>
                                    <button onClick={handleUpdateDescription} className="btn btn-sm btn-primary">Save</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {selectedGroup.description ? (
                                    <p className="text-[15px] mb-2 whitespace-pre-wrap">{selectedGroup.description}</p>
                                ) : (
                                    isAdmin || !selectedGroup.editInfoRestricted ? (
                                        <p onClick={() => setIsEditingDesc(true)} className="text-primary text-[15px] font-medium hover:underline cursor-pointer mb-2">Add group description</p>
                                    ) : (
                                        <p className="text-[15px] opacity-60 mb-2 italic">No description</p>
                                    )
                                )}
                                <div className="flex items-center justify-between">
                                    <p className="text-sm opacity-50">Created by {selectedGroup.admin?.fullName || "Unknown"}, {new Date(selectedGroup.createdAt || Date.now()).toLocaleDateString()}</p>
                                    {(isAdmin || !selectedGroup.editInfoRestricted) && selectedGroup.description && (
                                        <button onClick={() => setIsEditingDesc(true)} className="btn btn-xs btn-ghost text-primary">Edit</button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="h-2 w-full bg-base-200"></div>

                    {/* 5. MEDIA LINKS AND DOCS */}
                    <div className="bg-base-100 py-2">
                        <ListItem icon={ImageIcon} title="Media, links, and docs" right={<span className="flex items-center gap-2"><ChevronRight className="w-4 h-4"/></span>} onClick={() => setShowMedia(true)} />
                    </div>

                    <div className="h-2 w-full bg-base-200"></div>

                    {/* 6. STARRED AND PINNED */}
                    <div className="bg-base-100 py-2">
                        <ListItem icon={Star} title="Starred messages" right={<ChevronRight className="w-4 h-4"/>} onClick={() => setShowStarred(true)} />
                        <ListItem icon={Pin} title="Pinned messages" right={<ChevronRight className="w-4 h-4"/>} onClick={() => setShowPinned(true)} />
                    </div>

                    <div className="h-2 w-full bg-base-200"></div>

                    {/* 7. CHAT SETTINGS */}
                    <div className="bg-base-100 py-2">
                        <ListItem icon={Bell} title="Notifications" right={<ChevronRight className="w-4 h-4"/>} onClick={() => toast("Coming soon!", { icon: "🚧" })} />
                        <ListItem 
                            icon={Timer} 
                            title="Disappearing messages" 
                            subtitle={
                                selectedGroup.disappearingMessagesDuration === 24 ? "24 hours" : 
                                selectedGroup.disappearingMessagesDuration === 168 ? "7 days" : 
                                selectedGroup.disappearingMessagesDuration === 2160 ? "90 days" : "Off"
                            } 
                            right={<ChevronRight className="w-4 h-4"/>} 
                            onClick={() => isAdmin ? setShowDisappearing(true) : toast("Only admins can change this setting", { icon: "🔒" })} 
                        />
                        <ListItem icon={Palette} title="Chat theme" right={<ChevronRight className="w-4 h-4"/>} onClick={() => toast("Coming soon!", { icon: "🚧" })} />
                    </div>

                    <div className="h-2 w-full bg-base-200"></div>

                    {/* 8. GROUP PERMISSIONS */}
                    {isAdmin && (
                        <>
                            <div className="bg-base-100 py-2">
                                <ListItem icon={Settings} title="Group permissions" onClick={() => setShowPermissions(true)} right={<ChevronRight className="w-4 h-4"/>} />
                            </div>
                            <div className="h-2 w-full bg-base-200"></div>
                        </>
                    )}

                    {/* 9. MEMBERS SECTION */}
                    <div className="bg-base-100 py-3">
                        <div className="px-5 py-3 flex items-center justify-between">
                            {!showSearchField ? (
                                <>
                                    <span className="text-[15px] font-medium opacity-60">{members.length} members</span>
                                    <button onClick={() => setShowSearchField(true)} className="btn btn-ghost btn-circle btn-sm">
                                        <Search className="w-5 h-5 opacity-60" />
                                    </button>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center gap-3 animate-in slide-in-from-right-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                                        <input 
                                            autoFocus
                                            type="text" 
                                            placeholder="Search members" 
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            className="input input-sm input-bordered w-full pl-9 h-10 rounded-full bg-base-200/50 focus:outline-none"
                                        />
                                    </div>
                                    <button onClick={() => { setShowSearchField(false); setMemberSearchQuery(""); }} className="btn btn-ghost btn-sm">Cancel</button>
                                </div>
                            )}
                        </div>
                        
                        {!showSearchField && (isAdmin || !selectedGroup.addMembersRestricted) && (
                            <>
                                <ListItem icon={() => <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0"><UserPlus className="w-5 h-5"/></div>} title="Add members" onClick={() => setShowAddMembers(!showAddMembers)} />
                                <ListItem icon={() => <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0"><Link className="w-5 h-5"/></div>} title="Invite via link" onClick={handleInviteLink} />
                            </>
                        )}

                        {/* Add Members moved to overlay */}

                        <div className="mt-2">
                            {filteredMembers.map(m => {
                                const member = m.user || m;
                                const isMemberOwner = selectedGroup.admin?._id === member._id;
                                const isMemberAdmin = m.role === "admin" || isMemberOwner;
                                const isMe = member._id === authUser._id;

                                return (
                                    <div 
                                        key={member._id} 
                                        onClick={() => !isMe && setMenuMember(m)}
                                        className="flex items-center gap-4 px-5 py-2.5 hover:bg-base-200 cursor-pointer transition-colors"
                                    >
                                        <img src={member.profilePic || defaultAvatar} alt={member.fullName} className="w-11 h-11 rounded-full object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[16px] font-medium truncate">
                                                {member.fullName}
                                                {isMe && <span className="opacity-60 font-normal"> You</span>}
                                            </p>
                                            <p className="text-sm opacity-60 truncate">Available</p>
                                        </div>
                                        {isMemberOwner ? (
                                            <span className="text-[13px] text-primary font-medium px-2 py-0.5 rounded border border-primary/20 bg-primary/5 shrink-0">Group owner</span>
                                        ) : isMemberAdmin ? (
                                            <span className="text-[13px] text-primary font-medium px-2 py-0.5 rounded border border-primary/20 bg-primary/5 shrink-0">Group admin</span>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="h-2 w-full bg-base-200"></div>

                    {/* 10. EXIT AND REPORT */}
                    <div className="bg-base-100 py-3 mb-8">
                        <ListItem icon={LogOut} title="Exit group" destructive onClick={handleLeaveGroup} />
                        <ListItem icon={AlertTriangle} title="Report group" destructive />
                        {isOwner && (
                            <ListItem icon={Trash2} title="Delete group" destructive onClick={() => setShowDeleteConfirm(true)} />
                        )}
                    </div>
                </div>
            </div>

            {/* Member Action Bottom Sheet */}
            {menuMember && (
                <div className="fixed inset-0 z-[60] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMenuMember(null)} />
                    <div className="bg-base-100 w-full md:max-w-md md:mx-auto md:mb-4 rounded-t-3xl md:rounded-3xl pb-safe animate-in slide-in-from-bottom-full duration-200 z-10 overflow-hidden shadow-2xl">
                        <div className="w-10 h-1.5 bg-base-300 rounded-full mx-auto my-3"></div>
                        <div className="px-6 py-2 pb-4">
                            <p className="font-medium text-xl">{menuMember.user?.fullName || menuMember.fullName}</p>
                        </div>
                        <div className="py-2 mb-4">
                            <ListItem title={`Message ${(menuMember.user?.fullName || menuMember.fullName).split(' ')[0]}`} />
                            <ListItem title="View profile" />
                            {(() => {
                                const targetId = menuMember.user?._id || menuMember._id;
                                const isTargetOwner = (selectedGroup.admin?._id || selectedGroup.admin)?.toString() === targetId.toString();
                                const isTargetAdmin = menuMember.role === "admin" || isTargetOwner;
                                const canRemoveTarget = !isTargetOwner && (isOwner || (isAdmin && !isTargetAdmin));

                                return (
                                    <>
                                        {isOwner && !isTargetAdmin && (
                                            <ListItem title="Make group admin" onClick={() => handleUpdateRole(targetId, "admin")} />
                                        )}
                                        {isOwner && isTargetAdmin && !isTargetOwner && (
                                            <ListItem title="Dismiss as admin" onClick={() => handleUpdateRole(targetId, "member")} />
                                        )}
                                        {isOwner && isTargetAdmin && !isTargetOwner && (
                                            <ListItem title="Transfer ownership" onClick={() => handleTransferOwnership(targetId)} />
                                        )}
                                        {canRemoveTarget && (
                                            <ListItem title="Remove from group" destructive onClick={() => handleRemoveMember(targetId)} />
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Group Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="bg-base-100 w-full max-w-sm rounded-3xl p-7 z-10 animate-in zoom-in-95 shadow-2xl">
                        <h3 className="text-xl font-medium mb-3">Delete group?</h3>
                        <p className="opacity-70 text-[15px] mb-8 leading-relaxed">Are you sure you want to permanently delete this group? This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-ghost rounded-full" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className="btn btn-error rounded-full px-6" onClick={handleDeleteGroup}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Image Preview */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
                    <button onClick={() => setPreviewImage(null)} className="absolute top-safe right-4 mt-4 btn btn-ghost btn-circle text-white hover:bg-white/20 z-10"><X className="w-6 h-6" /></button>
                    <img src={previewImage} alt="Group profile preview" className="max-w-[100vw] max-h-[100vh] object-contain animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>,
        document.body
    );
};

export default GroupInfoPanel;
