import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import {
    Users, MessageSquare, ShieldAlert, Trash2, Ban,
    Unlock, Lock, Eye, EyeOff, Search, BarChart3,
    Clock, MoreVertical, RefreshCcw, ShieldCheck, Mail
} from "lucide-react";
import toast from "react-hot-toast";

const AdminPage = () => {
    const {
        adminStats, adminUsers, adminMessages, isAdminLoading,
        fetchAdminStats, fetchAdminUsers, fetchAdminMessages,
        updateUserStatus, adminUpdatePassword, deleteUserByAdmin, nuclearWipe,
        promoteUserToAdmin, selectiveDeleteUserContent, deleteMessageByAdmin
    } = useAuthStore();

    const [activeTab, setActiveTab] = useState("stats");
    const [searchTerm, setSearchTerm] = useState("");
    const [isNuclearConfirm, setIsNuclearConfirm] = useState(false);

    // Unified Modal State
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        type: "", // 'password', 'ban', 'block', 'promote', 'delete'
        user: null,
    });
    const [modalInput, setModalInput] = useState("");
    const [deleteOpts, setDeleteOpts] = useState({
        deleteMessages: true,
        deleteImages: false,
        deleteAccount: false
    });

    useEffect(() => {
        fetchAdminStats();
        fetchAdminUsers();
        fetchAdminMessages();
    }, [fetchAdminStats, fetchAdminUsers, fetchAdminMessages]);

    const handleActionModal = (type, user) => {
        setModalConfig({ isOpen: true, type, user });
        setModalInput(type === 'block' ? "24" : "");
    };

    const closeModal = () => {
        setModalConfig({ isOpen: false, type: "", user: null });
        setModalInput("");
    };

    const handleModalSubmit = async () => {
        const { type, user } = modalConfig;
        if (!user) return;

        let success = false;
        if (type === 'password') {
            if (modalInput.length >= 6) {
                success = await adminUpdatePassword(user._id, modalInput);
            } else {
                toast.error("Password must be at least 6 characters");
                return;
            }
        } else if (type === 'ban') {
            success = await updateUserStatus(user._id, { isBanned: !user.isBanned });
        } else if (type === 'block') {
            const blockedUntil = modalInput === "0" ? null : new Date(Date.now() + parseInt(modalInput) * 60 * 60 * 1000);
            success = await updateUserStatus(user._id, { blockedUntil });
        } else if (type === 'promote') {
            success = await promoteUserToAdmin(user._id);
        } else if (type === 'delete') {
            success = await selectiveDeleteUserContent(user._id, deleteOpts);
        } else if (type === 'msgDelete') {
            success = await deleteMessageByAdmin(user._id); // user._id is messageId here
        }

        if (success) closeModal();
    };

    const filteredUsers = adminUsers?.filter(u =>
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u._id.includes(searchTerm)
    );

    const filteredMessages = adminMessages?.filter(m =>
        m.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.senderId?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.receiverId?.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-base-200 text-base-content pt-20 px-4 sm:px-8 pb-10 md:pl-24 transition-colors duration-300">
            {/* Unified Admin Action Modal */}
            {modalConfig.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal}></div>
                    <div className="bg-base-100 border border-base-300 p-8 rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg bg-base-200 ${modalConfig.type === 'password' ? 'text-info' :
                                modalConfig.type === 'delete' || modalConfig.type === 'msgDelete' ? 'text-primary' :
                                    modalConfig.type === 'promote' ? 'text-secondary' : 'text-warning'
                                }`}>
                                {modalConfig.type === 'password' && <RefreshCcw size={20} />}
                                {modalConfig.type === 'ban' && <Ban size={20} />}
                                {modalConfig.type === 'block' && <Clock size={20} />}
                                {modalConfig.type === 'promote' && <ShieldAlert size={20} />}
                                {(modalConfig.type === 'delete' || modalConfig.type === 'msgDelete') && <Trash2 size={20} />}
                            </div>
                            <h3 className="text-2xl font-black capitalize">{modalConfig.type === 'msgDelete' ? 'Delete Message' : `${modalConfig.type} Action`}</h3>
                        </div>
                        <p className="text-base-content/60 text-sm mb-6">Target: <span className="text-primary font-bold">{modalConfig.type === 'msgDelete' ? 'Selected Message' : modalConfig.user?.fullName}</span></p>

                        <div className="space-y-4">
                            {modalConfig.type === 'password' && (
                                <div className="form-control">
                                    <label className="label text-xs font-bold uppercase opacity-50">New Password</label>
                                    <input
                                        type="text"
                                        className="input input-bordered bg-base-200"
                                        placeholder="Enter secure password..."
                                        value={modalInput}
                                        onChange={(e) => setModalInput(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}

                            {modalConfig.type === 'block' && (
                                <div className="form-control">
                                    <label className="label text-xs font-bold uppercase opacity-50">Duration (Hours)</label>
                                    <input
                                        type="number"
                                        className="input input-bordered bg-base-200"
                                        placeholder="24"
                                        value={modalInput}
                                        onChange={(e) => setModalInput(e.target.value)}
                                        autoFocus
                                    />
                                    <label className="label"><span className="label-text-alt opacity-50">Set to 0 to unblock</span></label>
                                </div>
                            )}

                            {modalConfig.type === 'delete' && (
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 p-3 bg-base-200 rounded-xl cursor-pointer hover:bg-base-300 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary"
                                            checked={deleteOpts.deleteMessages}
                                            onChange={(e) => setDeleteOpts({ ...deleteOpts, deleteMessages: e.target.checked })}
                                        />
                                        <span className="font-bold">Delete Chat Messages</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-base-200 rounded-xl cursor-pointer hover:bg-base-300 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-secondary"
                                            checked={deleteOpts.deleteImages}
                                            onChange={(e) => setDeleteOpts({ ...deleteOpts, deleteImages: e.target.checked })}
                                        />
                                        <span className="font-bold">Wipe Cloudinary Images</span>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-error/10 text-error rounded-xl cursor-pointer hover:bg-error/20 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-error"
                                            checked={deleteOpts.deleteAccount}
                                            onChange={(e) => setDeleteOpts({ ...deleteOpts, deleteAccount: e.target.checked })}
                                        />
                                        <span className="font-bold">Delete User Account</span>
                                    </label>
                                </div>
                            )}

                            {modalConfig.type === 'msgDelete' && (
                                <p className="bg-base-200 p-4 rounded-xl text-sm font-medium leading-relaxed">
                                    Are you sure you want to delete this specific message? All assets associated with it will be permanently removed.
                                </p>
                            )}

                            {(modalConfig.type === 'ban' || modalConfig.type === 'promote') && (
                                <p className="bg-base-200 p-4 rounded-xl text-sm font-medium leading-relaxed">
                                    {modalConfig.type === 'ban'
                                        ? `Are you absolutely sure you want to ${modalConfig.user.isBanned ? 'UNBAN' : 'BAN'} this user? This will ${modalConfig.user.isBanned ? 'restore' : 'revoke'} their access immediately.`
                                        : `Promoting this user to Admin will give them full access to all data, messages, and administrative tools. This action is critical.`
                                    }
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={handleModalSubmit} className="btn btn-primary flex-1 font-black">Confirm</button>
                            <button onClick={closeModal} className="btn btn-ghost font-bold">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Area */}
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            Admin Dashboard
                        </h1>
                        <p className="text-xs sm:text-sm text-base-content/60 mt-1 font-medium">Control Center for Chat Appey</p>
                    </div>

                    <div className="flex bg-base-100 border border-base-300 p-1 rounded-2xl shadow-sm overflow-x-auto max-w-full">
                        {[
                            { id: "stats", label: "Stats", icon: BarChart3 },
                            { id: "users", label: "Users", icon: Users },
                            { id: "chats", label: "Chats", icon: MessageSquare },
                            { id: "danger", label: "Danger", icon: ShieldAlert },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? "bg-primary text-primary-content shadow-md"
                                    : "text-base-content/50 hover:text-base-content hover:bg-base-200"
                                    }`}
                            >
                                <tab.icon size={16} className="sm:size-[18px]" />
                                <span className="text-xs sm:text-sm font-semibold">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-base-100 border border-base-300 rounded-3xl p-6 min-h-[600px] shadow-sm">

                    {/* SEARCH BAR */}
                    {(activeTab === "users" || activeTab === "chats") && (
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" size={20} />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input input-bordered w-full pl-12 bg-base-200 border-base-300 focus:border-primary/50"
                            />
                        </div>
                    )}

                    {/* DASHBOARD STATS */}
                    {activeTab === "stats" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">
                            <StatCard label="Total Users" value={adminStats?.totalUsers} icon={Users} color="text-primary" />
                            <StatCard label="Total Messages" value={adminStats?.totalMessages} icon={MessageSquare} color="text-secondary" />
                            <StatCard label="Verified" value={adminStats?.verifiedUsers} icon={ShieldCheck} color="text-success" />
                            <StatCard label="Banned" value={adminStats?.bannedUsers} icon={Ban} color="text-error" />
                        </div>
                    )}

                    {/* USER MANAGEMENT */}
                    {activeTab === "users" && (
                        <div className="overflow-x-auto">
                            <table className="table w-full">
                                <thead>
                                    <tr className="text-base-content/60 border-base-300">
                                        <th className="bg-transparent font-bold">User</th>
                                        <th className="bg-transparent font-bold">Status</th>
                                        <th className="bg-transparent font-bold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers?.map((user) => (
                                        <tr key={user._id} className="border-base-300 hover:bg-base-200/50 transition-colors group">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="avatar">
                                                        <div className="w-10 h-10 rounded-full border border-base-300">
                                                            <img src={user.profilePic || "/avatar.png"} alt="" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold flex items-center gap-2">
                                                            {user.fullName}
                                                            {user.role === 'admin' && <span className="badge badge-error badge-sm text-[10px] uppercase font-bold text-white">Admin</span>}
                                                        </div>
                                                        <div className="text-xs text-base-content/60">{user.email}</div>
                                                        <div className="text-[10px] text-base-content/40 font-mono">ID: {user._id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {user.isBanned ? (
                                                        <span className="badge badge-error badge-outline gap-1 text-[10px] font-bold">
                                                            <Ban size={10} /> Banned
                                                        </span>
                                                    ) : user.blockedUntil && new Date(user.blockedUntil) > new Date() ? (
                                                        <span className="badge badge-warning badge-outline gap-1 text-[10px] font-bold">
                                                            <Clock size={10} /> Blocked
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-success badge-outline gap-1 text-[10px] font-bold">
                                                            <ShieldCheck size={10} /> Active
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {user.role !== 'admin' && (
                                                        <button onClick={() => handleActionModal('promote', user)} title="Promote to Admin" className="btn btn-ghost btn-xs text-secondary hover:bg-secondary/10">
                                                            <ShieldAlert size={16} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleActionModal('block', user)} title="Block Temporary" className="btn btn-ghost btn-xs text-warning hover:bg-warning/10">
                                                        <Clock size={16} />
                                                    </button>
                                                    <button onClick={() => handleActionModal('ban', user)} title="Ban Permanent" className="btn btn-ghost btn-xs text-error hover:bg-error/10">
                                                        <Ban size={16} />
                                                    </button>
                                                    <button onClick={() => handleActionModal('password', user)} title="Update Password" className="btn btn-ghost btn-xs text-info hover:bg-info/10">
                                                        <RefreshCcw size={16} />
                                                    </button>
                                                    <button onClick={() => handleActionModal('delete', user)} title="Selective Purge" className="btn btn-ghost btn-xs text-primary hover:bg-primary/10">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* CHAT INSPECTOR */}
                    {activeTab === "chats" && (
                        <>
                            <div className="flex items-center gap-3 mb-6 p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h2 className="font-black text-primary uppercase tracking-tighter">Individual Message Control</h2>
                                    <p className="text-[10px] text-base-content/50 font-medium">Browse and delete specific platform communications below.</p>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredMessages?.map((msg) => (
                                    <div key={msg._id} className="bg-base-200 border border-base-300 p-4 rounded-2xl hover:border-primary/30 transition-all group">
                                        <div className="flex items-center justify-between mb-3 border-b border-base-300/50 pb-2">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-base-content/40 uppercase font-black">From:</span>
                                                    <span className="text-xs font-bold text-primary">{msg.senderId?.fullName}</span>
                                                </div>
                                                <div className="text-base-content/30 tracking-widest">{" >> "}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-base-content/40 uppercase font-black">To:</span>
                                                    <span className="text-xs font-bold text-secondary">{msg.receiverId?.fullName}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-[10px] text-base-content/40 font-medium">
                                                    {new Date(msg.createdAt).toLocaleString()}
                                                </div>
                                                <button
                                                    onClick={() => handleActionModal('msgDelete', { _id: msg._id, fullName: 'Selected Message' })}
                                                    className="btn btn-ghost btn-xs text-error p-0 h-7 w-7 min-h-0 bg-error/10 hover:bg-error/20 rounded-lg scale-110 sm:scale-100"
                                                    title="Delete Individual Message"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            {msg.image && (
                                                <div className="avatar">
                                                    <div className="w-20 rounded-xl border border-base-300">
                                                        <img src={msg.image} alt="" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <p className="text-base-content/80 text-sm leading-relaxed whitespace-pre-wrap">{msg.text || <span className="italic opacity-30">No text</span>}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* DANGER ZONE */}
                    {activeTab === "danger" && (
                        <div className="flex flex-col items-center justify-center text-center p-10 h-full">
                            <div className="w-24 h-24 bg-error/10 text-error rounded-full flex items-center justify-center mb-6 animate-pulse border-2 border-error/20">
                                <ShieldAlert size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-error mb-4 uppercase">Nuclear Override</h2>
                            <p className="text-base-content/60 max-w-lg mb-10 text-lg font-medium">
                                DANGER: This protocol will erase all users, messages, and Cloudinary assets.
                                **You (Admin)** will be the only survivor.
                            </p>

                            {!isNuclearConfirm ? (
                                <button
                                    onClick={() => setIsNuclearConfirm(true)}
                                    className="btn btn-error btn-lg px-12 shadow-xl shadow-error/20 font-black"
                                >
                                    Initiate Nuclear Wipe
                                </button>
                            ) : (
                                <div className="space-y-6 animate-bounce">
                                    <div className="text-error font-black text-sm uppercase">Double Confirmation Required!</div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={async () => {
                                                const res = await nuclearWipe();
                                                if (res) setIsNuclearConfirm(false);
                                            }}
                                            className="btn btn-error font-black px-10"
                                        >
                                            YES, DESTROY ALL DATA
                                        </button>
                                        <button
                                            onClick={() => setIsNuclearConfirm(false)}
                                            className="btn btn-outline font-bold px-8"
                                        >
                                            RESTART CHAT
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Loading Overlay */}
            {isAdminLoading && (
                <div className="fixed inset-0 bg-base-300/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                        <p className="font-black tracking-[0.2em] text-primary uppercase">Syncing Admin Data...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-base-100 border border-base-300 p-4 sm:p-6 rounded-3xl hover:shadow-lg transition-all group overflow-hidden relative">
        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon size={120} />
        </div>
        <div className="flex items-center justify-between mb-4 relative z-10">
            <div className={`p-2 sm:p-3 rounded-2xl bg-base-200 ${color} group-hover:scale-110 transition-transform`}>
                <Icon size={20} className="sm:size-6" />
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-base-content">{value || 0}</div>
        </div>
        <div className="text-base-content/40 text-[10px] sm:text-xs font-bold uppercase tracking-widest relative z-10">{label}</div>
    </div>
);

export default AdminPage;
