import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import defaultAvatar from "../public/avatar.png";
import { Users, ShieldCheck, CheckCircle2, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const JoinGroupPage = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { authUser } = useAuthStore();
    const { getGroupPreview, joinGroupViaInvite, setSelectedGroup } = useGroupStore();

    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPreview = async () => {
            if (!groupId) return;
            try {
                setLoading(true);
                setError(null);
                const data = await getGroupPreview(groupId);
                setPreview(data);
            } catch (err) {
                console.error("Failed to fetch group preview:", err);
                setError(err.response?.data?.error || "This group link is invalid or has expired.");
            } finally {
                setLoading(false);
            }
        };

        fetchPreview();
    }, [groupId, getGroupPreview]);

    const handleJoin = async () => {
        if (!authUser) {
            toast.error("Please log in to join this group");
            navigate("/login");
            return;
        }

        try {
            setJoining(true);
            const joinedGroup = await joinGroupViaInvite(groupId);
            setSelectedGroup(joinedGroup);
            toast.success(`Joined "${joinedGroup.name}"!`);
            navigate("/");
        } catch (err) {
            console.error("Failed to join group:", err);
            toast.error(err.response?.data?.error || "Failed to join group");
        } finally {
            setJoining(false);
        }
    };

    const handleOpenChat = () => {
        if (preview) {
            // Select group in state and navigate home
            useGroupStore.getState().selectGroupById?.(preview._id);
        }
        navigate("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-base-200 p-4 select-none">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm font-medium text-base-content/70">Checking group invite link...</p>
                </div>
            </div>
        );
    }

    if (error || !preview) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-base-200 p-4 select-none">
                <div className="bg-base-100 border border-base-300 rounded-3xl p-8 max-w-md w-full text-center shadow-xl animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4 border border-error/20">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-base-content mb-2">Invalid Invite Link</h2>
                    <p className="text-sm text-base-content/70 mb-6 leading-relaxed">
                        {error || "This group invite link is invalid, revoked, or the group no longer exists."}
                    </p>
                    <button 
                        onClick={() => navigate("/")} 
                        className="btn btn-primary rounded-full w-full shadow-md"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-base-200 p-4 select-none">
            <div className="bg-base-100 border border-base-300 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center relative overflow-hidden">
                {/* Decorative header accent */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-primary" />

                {/* Group Icon Avatar */}
                <div className="relative w-24 h-24 mx-auto mb-5">
                    <img 
                        src={preview.groupPic || defaultAvatar} 
                        alt={preview.name} 
                        className="w-24 h-24 rounded-full object-cover border-4 border-base-100 shadow-xl bg-base-300"
                    />
                    <div className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full p-1.5 shadow-md border-2 border-base-100">
                        <Users className="w-4 h-4" />
                    </div>
                </div>

                {/* Group Details */}
                <h1 className="text-2xl font-bold text-base-content mb-1 tracking-tight">{preview.name}</h1>
                <p className="text-xs text-base-content/60 font-medium mb-4 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Created by {preview.admin?.fullName || "Group Admin"}
                </p>

                {preview.description && (
                    <div className="bg-base-200/60 border border-base-300/40 rounded-2xl p-3.5 mb-5 text-left">
                        <p className="text-xs text-base-content/70 italic line-clamp-3">"{preview.description}"</p>
                    </div>
                )}

                {/* Members preview pill */}
                <div className="flex items-center justify-between bg-base-200/80 rounded-2xl p-3 mb-7 border border-base-300/50">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 overflow-hidden">
                            {preview.previewMembers?.slice(0, 4).map((member, i) => (
                                <img
                                    key={member?._id || i}
                                    src={member?.profilePic || defaultAvatar}
                                    alt={member?.fullName || "Member"}
                                    className="inline-block h-7 w-7 rounded-full ring-2 ring-base-100 object-cover"
                                />
                            ))}
                        </div>
                        <span className="text-xs font-semibold text-base-content/80">
                            {preview.membersCount} {preview.membersCount === 1 ? "member" : "members"}
                        </span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        WhatsApp Group
                    </span>
                </div>

                {/* Action CTA */}
                {preview.isMember ? (
                    <button
                        onClick={handleOpenChat}
                        className="btn btn-outline btn-success rounded-full w-full shadow-sm flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        You're already a member — Open Chat
                    </button>
                ) : (
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-full w-full shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm font-semibold h-12"
                    >
                        {joining ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Joining Group...
                            </>
                        ) : (
                            <>
                                Join Group
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default JoinGroupPage;
