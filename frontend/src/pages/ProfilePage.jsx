import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Edit, Info, Mail, User } from "lucide-react";
import defaultImg from '../public/avatar.png'
import EmojiPicker from 'emoji-picker-react';
import axios from "axios";

const ProfilePage = () => {
    const { authUser, isUpdatingProfile, updateProfile, updateName, updateAbout } = useAuthStore();
    const [selectedImg, setSelectedImg] = useState(null);

    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [editedName, setEditedName] = useState(authUser?.fullName || '');

    const [isEditAboutPopupOpen, setIsEditAboutPopupOpen] = useState(false);
    const [editedAbout, setEditedAbout] = useState(authUser?.about || '');

    // const handleImageUpload = async (e) => {
    //     const file = e.target.files[0];
    //     if (!file) return;

    //     const reader = new FileReader();

    //     reader.readAsDataURL(file);

    //     reader.onload = async () => {
    //         const base64Image = reader.result;
    //         setSelectedImg(base64Image);
    //         await updateProfile({ profilePic: base64Image });
    //     };
    // };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onloadend = async () => {
            const base64 = reader.result;

            try {
                const res = await axios.put(
                    "http://localhost:5001/api/auth/update-profile",
                    { profilePic: base64 },
                    {
                        headers: {
                            "Content-Type": "application/json"
                        },
                        withCredentials: true
                    }
                );
                setSelectedImg(res.data.profilePic); // assuming your backend returns the updated profile image URL
            } catch (err) {
                console.error("Upload error:", err);
            }
        };

        reader.readAsDataURL(file); // Converts image to base64
    };


    const updateUserName = async (newName) => {
        await updateName(newName);  // calling the store method
        setEditedName(newName);     // update local state if needed
    };

    const updateAboutStatus = async (newName) => {
        await updateAbout(newName);  // calling the store method
        setEditedAbout(newName);     // update local state if needed
    };




    return (
        <div className="h-full pt-20">
            <div className="max-w-2xl mx-auto p-4 py-8">
                <div className="bg-primary/10 rounded-xl p-6 space-y-8 shadow-lg">
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold ">Profile</h1>
                        <p className="mt-2">Your profile information</p>
                    </div>

                    {/* avatar upload section */}

                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <img
                                src={selectedImg || authUser.profilePic || defaultImg}
                                alt="Profile"
                                className="size-32 rounded-full object-cover border-4 border-white shadow-lg transition-all duration-300 group-hover:opacity-90"
                            />
                            <label
                                htmlFor="avatar-upload"
                                className={`absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-full opacity-0 group-hover:opacity-80 transition-opacity duration-300 cursor-pointer
                                    ${isUpdatingProfile ? "opacity-100 animate-pulse" : ""}`}
                            >
                                <div className="bg-white p-2 rounded-full">
                                    <Camera className="w-5 h-5 text-blue-600" />
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
                        <p className="text-sm text-gray-500">
                            {isUpdatingProfile ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Uploading...
                                </span>
                            ) : (
                                "Click on the image to update your photo"
                            )}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <div className="text-sm text-zinc-400 flex items-center gap-2 relative">
                                <User className="w-4 h-4" />
                                Full Name
                                <button
                                    onClick={() => setIsEditPopupOpen(true)}
                                    className="ml-2 p-1 rounded-full hover:bg-base-200 transition-colors absolute right-0"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="px-4 py-2.5 bg-base-200 rounded-lg border flex justify-between items-center">
                                {authUser?.fullName}
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <div className="text-sm text-zinc-400 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Address
                            </div>
                            <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{authUser?.email}</p>
                        </div>

                        <div className="space-y-1.5">
                            <div className="text-sm text-zinc-400 flex items-center gap-2 relative">
                                <Info className="w-4 h-4" />
                                About
                                <button
                                    onClick={() => {
                                        setEditedAbout(authUser?.about || '');
                                        setIsEditAboutPopupOpen(true);
                                    }}
                                    className="ml-2 p-1 rounded-full hover:bg-base-200 transition-colors absolute right-0"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="px-4 py-2.5 bg-base-200 rounded-lg border min-h-[42px] whitespace-pre-wrap">
                                {authUser?.about || "No description added"}
                            </p>
                        </div>

                        {/* Name Edit Popup */}
                        {isEditPopupOpen && (
                            <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50" style={{ backgroundColor: "#000000bf" }}>
                                <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
                                    <h3 className="text-lg font-medium mb-4">Edit Full Name</h3>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={editedName}
                                            onChange={(e) => setEditedName(e.target.value)}
                                            className="w-full px-4 py-2 bg-base-200 rounded-lg border mb-4"
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
                                            className="px-4 py-2 rounded-lg border hover:bg-base-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                updateUserName(editedName);
                                                setIsEditPopupOpen(false);
                                                setIsEmojiPickerOpen(false);
                                            }}
                                            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
                                        >
                                            Submit
                                        </button>

                                    </div>
                                </div>
                            </div>
                        )}

                        {/* About Edit Popup */}
                        {isEditAboutPopupOpen && (
                            <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50" style={{ backgroundColor: "#000000bf" }}>
                                <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
                                    <h3 className="text-lg font-medium mb-4">Edit About</h3>

                                    <textarea
                                        value={editedAbout}
                                        onChange={(e) => setEditedAbout(e.target.value)}
                                        className="w-full px-4 py-2 bg-base-200 rounded-lg border mb-4 min-h-[120px]"
                                        placeholder="Tell something about yourself..."
                                    />

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setIsEditAboutPopupOpen(false)}
                                            className="px-4 py-2 rounded-lg border hover:bg-base-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Handle about update logic here
                                                updateAboutStatus(editedAbout);
                                                setIsEditAboutPopupOpen(false);
                                            }}
                                            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 bg-primary/10 rounded-xl p-6 text-black " style={{ boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px' }}                    >
                        <h2 className="text-lg font-medium  mb-4">Account Information</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                                <span>Member Since</span>
                                <span>{authUser.createdAt?.split("T")[0]}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span>Account Status</span>
                                <span className="text-green-500">Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default ProfilePage;