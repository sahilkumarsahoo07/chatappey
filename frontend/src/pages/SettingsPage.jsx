import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import { Send, Camera, Edit, User, Mail, Info, Bell } from "lucide-react";
import { useState } from "react";
import defaultImg from '../public/avatar.png';
import EmojiPicker from 'emoji-picker-react';
import { requestNotificationPermission, showBrowserNotification } from "../lib/notifications";
import toast from "react-hot-toast";

const PREVIEW_MESSAGES = [
    { id: 1, content: "Hey! How's it going?", isSent: false },
    { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const SettingsPage = () => {
    const { theme, setTheme } = useThemeStore();
    const { authUser, isUpdatingProfile, updateProfile, updateName, updateAbout } = useAuthStore();

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [editedName, setEditedName] = useState(authUser?.fullName || '');
    const [isEditAboutPopupOpen, setIsEditAboutPopupOpen] = useState(false);
    const [editedAbout, setEditedAbout] = useState(authUser?.about || '');

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onloadend = async () => {
            const base64 = reader.result;
            // Use the store's updateProfile function which properly updates authUser
            await updateProfile({ profilePic: base64 });
        };

        reader.readAsDataURL(file);
    };

    const updateUserName = async (newName) => {
        await updateName(newName);
        setEditedName(newName);
    };

    const updateAboutStatus = async (newAbout) => {
        await updateAbout(newAbout);
        setEditedAbout(newAbout);
    };

    return (
        <div className="min-h-[100dvh] pl-0 md:pl-20 pb-14 md:pb-0">
            <div className="container mx-auto px-4 pt-8 max-w-5xl pb-8">
                <div className="space-y-8">
                    {/* Profile Section */}
                    <div className="space-y-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-2xl font-bold">Profile Settings</h2>
                            <p className="text-sm text-base-content/70">Manage your account information</p>
                        </div>

                        {/* Profile Picture */}
                        <div className="card bg-base-100 shadow-md border border-base-300">
                            <div className="card-body">
                                <div className="flex items-center gap-6">
                                    <div className="relative group">
                                        <div className="avatar">
                                            <div className="w-24 h-24 rounded-full ring-4 ring-primary/20">
                                                <img src={authUser?.profilePic || defaultImg} alt={authUser?.fullName} />
                                            </div>
                                        </div>
                                        <label
                                            htmlFor="avatar-upload"
                                            className={`absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer
                                            ${isUpdatingProfile ? "opacity-100" : ""}`}
                                        >
                                            <div className="bg-white p-2 rounded-full">
                                                <Camera className="w-5 h-5 text-primary" />
                                            </div>
                                            <input
                                                type="file"
                                                id="avatar-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={isUpdatingProfile}
                                            />
                                        </label>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">{authUser?.fullName}</h3>
                                        <p className="text-sm text-base-content/70">{authUser?.email}</p>
                                        {isUpdatingProfile && (
                                            <p className="text-sm text-primary mt-1">Uploading photo...</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* User Information */}
                        <div className="card bg-base-100 shadow-md border border-base-300">
                            <div className="card-body space-y-4">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <div className="text-sm text-base-content/70 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            Full Name
                                        </div>
                                        <button
                                            onClick={() => setIsEditPopupOpen(true)}
                                            className="btn btn-ghost btn-xs gap-1"
                                        >
                                            <Edit className="w-3 h-3" />
                                            Edit
                                        </button>
                                    </div>
                                    <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300">
                                        {authUser?.fullName}
                                    </p>
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <div className="text-sm text-base-content/70 flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Email Address
                                    </div>
                                    <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300">
                                        {authUser?.email}
                                    </p>
                                </div>

                                {/* About */}
                                <div className="space-y-2">
                                    <div className="text-sm text-base-content/70 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Info className="w-4 h-4" />
                                            About
                                        </div>
                                        <button
                                            onClick={() => {
                                                setEditedAbout(authUser?.about || '');
                                                setIsEditAboutPopupOpen(true);
                                            }}
                                            className="btn btn-ghost btn-xs gap-1"
                                        >
                                            <Edit className="w-3 h-3" />
                                            Edit
                                        </button>
                                    </div>
                                    <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300 min-h-[42px] whitespace-pre-wrap">
                                        {authUser?.about || "No description added"}
                                    </p>
                                </div>

                                {/* Account Info */}
                                <div className="divider"></div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Account Information</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between py-2 border-b border-base-300">
                                            <span className="text-base-content/70">Member Since</span>
                                            <span>{authUser?.createdAt?.split("T")[0]}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-base-content/70">Account Status</span>
                                            <span className="text-success font-semibold">Active</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notification Section */}
                    <div className="space-y-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-2xl font-bold">Notifications</h2>
                            <p className="text-sm text-base-content/70">Manage your desktop notifications</p>
                        </div>

                        <div className="card bg-base-100 shadow-md border border-base-300">
                            <div className="card-body">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Bell className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">Desktop Notifications</h3>
                                            <p className="text-sm text-base-content/70">
                                                Receive notifications for new messages even when the app is in the background
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => showBrowserNotification("Test Notification", { body: "This is a test notification from ChatAppey" })}
                                            className="btn btn-ghost"
                                        >
                                            Test
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const granted = await requestNotificationPermission();
                                                if (granted) {
                                                    toast.success("Notifications enabled successfully!");
                                                } else {
                                                    toast.error("Permission denied. check browser settings.");
                                                }
                                            }}
                                            className="btn btn-primary"
                                        >
                                            Enable Notifications
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-base-200 rounded-lg text-sm text-base-content/70">
                                    <p>
                                        Note: If notifications are not working, please check your browser settings and ensure "Do Not Disturb" mode is off on your device.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Theme Section */}
                    <div className="space-y-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-2xl font-bold">Theme</h2>
                            <p className="text-sm text-base-content/70">Choose a theme for your chat interface</p>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {THEMES.map((t) => (
                                <button
                                    key={t}
                                    className={`
                    group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors
                    ${theme === t ? "bg-base-200" : "hover:bg-base-200/50"}
                  `}
                                    onClick={() => setTheme(t)}
                                >
                                    <div className="relative h-8 w-full rounded-md overflow-hidden" data-theme={t}>
                                        <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
                                            <div className="rounded bg-primary"></div>
                                            <div className="rounded bg-secondary"></div>
                                            <div className="rounded bg-accent"></div>
                                            <div className="rounded bg-neutral"></div>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-medium truncate w-full text-center">
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Preview Section */}
                        <h3 className="text-lg font-semibold mb-3">Preview</h3>
                        <div className="rounded-xl border border-base-300 overflow-hidden bg-base-100 shadow-lg">
                            <div className="p-4 bg-base-200">
                                <div className="max-w-lg mx-auto">
                                    {/* Mock Chat UI */}
                                    <div className="bg-base-100 rounded-xl shadow-sm overflow-hidden">
                                        {/* Chat Header */}
                                        <div className="px-4 py-3 border-b border-base-300 bg-base-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-content font-medium">
                                                    S
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-sm">Sahil Kumar Sahoo</h3>
                                                    <p className="text-xs text-base-content/70">Online</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chat Messages */}
                                        <div className="p-4 space-y-4 min-h-[200px] max-h-[200px] overflow-y-auto bg-base-100">
                                            {PREVIEW_MESSAGES.map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={`flex ${message.isSent ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        className={`
                              max-w-[80%] rounded-xl p-3 shadow-sm
                              ${message.isSent ? "bg-primary text-primary-content" : "bg-base-200"}
                            `}
                                                    >
                                                        <p className="text-sm">{message.content}</p>
                                                        <p
                                                            className={`
                                text-[10px] mt-1.5
                                ${message.isSent ? "text-primary-content/70" : "text-base-content/70"}
                              `}
                                                        >
                                                            12:00 PM
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Chat Input */}
                                        <div className="p-4 border-t border-base-300 bg-base-100">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="input input-bordered flex-1 text-sm h-10"
                                                    placeholder="Type a message..."
                                                    value="This is a preview"
                                                    readOnly
                                                />
                                                <button className="btn btn-primary h-10 min-h-0">
                                                    <Send size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Name Edit Popup */}
                {isEditPopupOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
                            <h3 className="text-lg font-medium mb-4">Edit Full Name</h3>

                            <div className="relative">
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    className="w-full px-4 py-2 bg-base-200 rounded-lg border border-base-300 mb-4"
                                    placeholder="Enter your name"
                                />
                                <button
                                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                    className="absolute right-3 top-2.5 text-lg"
                                >
                                    😊
                                </button>
                            </div>

                            {isEmojiPickerOpen && (
                                <div className="mb-4">
                                    <EmojiPicker
                                        onEmojiClick={(emojiData) => {
                                            setEditedName(prev => prev + emojiData.emoji);
                                        }}
                                        width="100%"
                                        height={300}
                                        previewConfig={{
                                            showPreview: false,
                                            defaultEmoji: '',
                                            defaultCaption: ''
                                        }}
                                        searchDisabled={true}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setIsEditPopupOpen(false);
                                        setIsEmojiPickerOpen(false);
                                    }}
                                    className="btn btn-ghost"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        updateUserName(editedName);
                                        setIsEditPopupOpen(false);
                                        setIsEmojiPickerOpen(false);
                                    }}
                                    className="btn btn-primary"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* About Edit Popup */}
                {isEditAboutPopupOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
                            <h3 className="text-lg font-medium mb-4">Edit About</h3>

                            <textarea
                                value={editedAbout}
                                onChange={(e) => setEditedAbout(e.target.value)}
                                className="w-full px-4 py-2 bg-base-200 rounded-lg border border-base-300 mb-4 min-h-[120px]"
                                placeholder="Tell something about yourself..."
                            />

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setIsEditAboutPopupOpen(false)}
                                    className="btn btn-ghost"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        updateAboutStatus(editedAbout);
                                        setIsEditAboutPopupOpen(false);
                                    }}
                                    className="btn btn-primary"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;