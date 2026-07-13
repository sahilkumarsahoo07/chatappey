import { useRef, useState, useEffect, useMemo, memo, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Reply, Megaphone, Mic, Paperclip, FileText, BarChart2, Calendar, Film, Loader2, Camera, Clapperboard } from "lucide-react";
import toast from "react-hot-toast";
import { chatFeaturesApi, MAX_VIDEO_MB, VIDEO_ACCEPT } from "../lib/chatFeaturesApi";
import EmojiPickerComponent from "./EmojiPickerComponent";
import GifPicker from "./GifPicker";
import PollCreator from "./PollCreator";
import ScheduleMessageModal from "./ScheduleMessageModal";
import VoiceRecorderBar from "./chat/VoiceRecorderBar";
import VoiceMessagePlayer from "./chat/VoiceMessagePlayer";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { haptic } from "../lib/haptics";
import "./MessageInput.css";
import { useShallow } from "zustand/react/shallow";

const EMPTY_MEMBERS = [];

const MessageInput = ({ onSend, isGroupChat = false, isAdmin = false, announcementOnly = false, groupMembers = EMPTY_MEMBERS }) => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [gifPreview, setGifPreview] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'image', 'gif', 'audio', 'file'
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [filePreview, setFilePreview] = useState(null); // { name, type, size, base64 }
    const [videoPreview, setVideoPreview] = useState(null); // { file, url, duration }
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [isVideoUploading, setIsVideoUploading] = useState(false);

    // Mentions State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [selectedMentions, setSelectedMentions] = useState([]);

    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const isSendingRef = useRef(false); // Ref to prevent double sending

    // Modals & Menus
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);

    // Refs
    const fileInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const docInputRef = useRef(null);
    const textareaRef = useRef(null);
    const mentionsRef = useRef(null);
    const attachmentMenuRef = useRef(null);

    const { sendMessage, replyingToMessage, clearReplyingToMessage, selectedUser } = useChatStore(useShallow((state) => ({
        sendMessage: state.sendMessage,
        replyingToMessage: state.replyingToMessage,
        clearReplyingToMessage: state.clearReplyingToMessage,
        selectedUser: state.selectedUser,
    })));
    const selectedGroup = useGroupStore((s) => s.selectedGroup);
    const socket = useAuthStore((s) => s.socket);
    const authUser = useAuthStore((s) => s.authUser);

    const isRestricted = isGroupChat && announcementOnly && !isAdmin;
    const filteredMembers = useMemo(() => {
        if (!showMentions || !isGroupChat) return EMPTY_MEMBERS;
        const q = mentionSearch.toLowerCase();
        return groupMembers.filter((member) =>
            member.user?.fullName?.toLowerCase().includes(q)
        );
    }, [groupMembers, mentionSearch, showMentions, isGroupChat]);

    const handleEmojiSelect = useCallback((emoji) => {
        setText((prev) => prev + emoji);
    }, []);

    const sendHandlerRef = useRef(async () => {});

    const handleFormSubmit = useCallback((e) => {
        e?.preventDefault?.();
        sendHandlerRef.current?.(e);
    }, []);

    // Effects
    useEffect(() => {
        setSelectedMentionIndex(0);
    }, [mentionSearch]);

    useEffect(() => {
        if (replyingToMessage && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [replyingToMessage]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (mentionsRef.current && !mentionsRef.current.contains(e.target)) {
                setShowMentions(false);
            }
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target)) {
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Removed expensive useEffect - typing indicator now handled in handleTextChange


    // --- Media Handlers ---

    const handleImageChange = (e) => {
        if (isRestricted) return;
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
            setGifPreview(null);
            setFilePreview(null);
            setVideoPreview(null);
            setAudioBlob(null);
            setMediaType('image');
            setShowAttachmentMenu(false);
        };
        reader.readAsDataURL(file);
    };

    const handleVideoChange = (e) => {
        if (isRestricted) return;
        const file = e.target.files[0];
        if (!file) return;

        const maxBytes = MAX_VIDEO_MB * 1024 * 1024;
        if (file.size > maxBytes) {
            toast.error(`Video must be under ${MAX_VIDEO_MB}MB`);
            return;
        }

        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const duration = video.duration || 0;
            URL.revokeObjectURL(video.src);
            setVideoPreview({ file, url, duration });
            setImagePreview(null);
            setGifPreview(null);
            setFilePreview(null);
            setAudioBlob(null);
            setMediaType("video");
            setShowAttachmentMenu(false);
        };
        video.src = url;
    };

    const handleFileChange = (e) => {
        if (isRestricted) return;
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreview({
                name: file.name,
                type: file.type,
                size: fileNode(file.size), // helper needed or just bytes
                base64: reader.result
            });
            setImagePreview(null);
            setGifPreview(null);
            setAudioBlob(null);
            setMediaType('file');
            setShowAttachmentMenu(false);
        };
        reader.readAsDataURL(file);
    };

    const handleGifSelect = useCallback((gifUrl) => {
        if (isRestricted) return;
        setGifPreview(gifUrl);
        setImagePreview(null);
        setFilePreview(null);
        setAudioBlob(null);
        setMediaType('gif');
        toast.success("GIF selected!");
    }, [isRestricted]);

    // --- Audio Recording (WhatsApp hold / slide / lock) ---

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            // Strip codecs= from mime so data URLs work in <audio> / Cloudinary
            const cleanType = (blob.type || "audio/webm").split(";")[0] || "audio/webm";
            const clean = blob.type.includes(";") ? new Blob([blob], { type: cleanType }) : blob;
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(clean);
        });
    };

    const sendVoiceBlob = useCallback(async (blob) => {
        if (!blob || isRestricted) return;
        // Clear composer preview immediately so it can't sit next to the sent bubble
        setAudioBlob(null);
        setAudioUrl(null);
        setMediaType(null);
        try {
            const base64Audio = await blobToBase64(blob);
            const messageData = {
                text: "🎤 Voice message",
                audio: base64Audio,
            };
            haptic("send");
            if (onSend) {
                await onSend(messageData);
            } else {
                await sendMessage(messageData);
            }
        } catch (err) {
            console.error("Failed to send voice message:", err);
            toast.error("Failed to send voice message");
        }
    }, [isRestricted, onSend, sendMessage]);

    const voice = useVoiceRecorder({
        onAutoSend: (blob) => {
            sendVoiceBlob(blob);
        },
    });

    useEffect(() => {
        if (voice.error) toast.error(voice.error);
    }, [voice.error]);

    // Broadcast voice-recording presence in group chats
    useEffect(() => {
        if (!isGroupChat || !selectedGroup?._id || !socket) return;
        const isRec = !!(voice.isRecording || voice.isLocked);
        socket.emit("group:recording", {
            groupId: selectedGroup._id,
            isRecording: isRec,
        });
        if (isRec) {
            socket.emit("group:stopTyping", { groupId: selectedGroup._id });
        }
        return () => {
            socket.emit("group:recording", {
                groupId: selectedGroup._id,
                isRecording: false,
            });
        };
    }, [
        isGroupChat,
        selectedGroup?._id,
        socket,
        voice.isRecording,
        voice.isLocked,
    ]);

    // Sync release/lock preview into composer — clear composer when preview is gone
    useEffect(() => {
        if (voice.previewBlob && voice.previewUrl) {
            setAudioBlob(voice.previewBlob);
            setAudioUrl(voice.previewUrl);
            setMediaType("audio");
            return;
        }
        setAudioBlob((prev) => (prev ? null : prev));
        setAudioUrl((prev) => (prev ? null : prev));
        setMediaType((prev) => (prev === "audio" ? null : prev));
    }, [voice.previewBlob, voice.previewUrl]);

    const cancelRecording = () => {
        voice.cancelRecording();
        voice.clearPreview();
        setAudioBlob(null);
        setAudioUrl(null);
        setMediaType(null);
    };

    const removeMedia = () => {
        setImagePreview(null);
        setGifPreview(null);
        setMediaType(null);
        setFilePreview(null);
        setVideoPreview(null);
        setVideoUploadProgress(0);
        setIsVideoUploading(false);
        setAudioBlob(null);
        setAudioUrl(null);
        voice.clearPreview();
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (videoInputRef.current) videoInputRef.current.value = "";
        if (docInputRef.current) docInputRef.current.value = "";
    };

    const fileNode = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // --- Sending Logic ---

    const handleSendMessage = async (e, extraData = {}) => {
        if (e) e.preventDefault();

        // Prevent double sending
        if (isSendingRef.current || isRestricted) return;

        // Validation
        const hasText = text.trim().length > 0 || (extraData.text && extraData.text.trim().length > 0);
        const hasMedia = !!(imagePreview || gifPreview || filePreview || audioBlob || videoPreview);
        const hasPoll = !!extraData.poll;

        if (!hasText && !hasMedia && !hasPoll) return;

        isSendingRef.current = true; // Lock sending

        // Clear typing indicator immediately
        if (socket) {
            isTypingRef.current = false;
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            if (isGroupChat && selectedGroup) {
                socket.emit("group:stopTyping", { groupId: selectedGroup._id });
            } else if (selectedUser) {
                socket.emit("stopTyping", { receiverId: selectedUser._id });
            }
        }

        // Capture current values before clearing UI
        const currentText = extraData.text || text.trim();
        const currentImage = imagePreview || gifPreview;
        const currentFile = filePreview;
        const currentVideo = videoPreview;
        const currentAudioBlob = audioBlob;
        const currentMentions = [...selectedMentions];

        // Capture replyingToMessage before clearing
        const currentReplyingToMessage = replyingToMessage;

        // OPTIMISTIC UPDATE: Clear ALL UI IMMEDIATELY (synchronous for instant feedback)
        // Use flushSync for immediate DOM updates if available, otherwise synchronous
        setText("");
        removeMedia();
        setSelectedMentions([]);
        setShowAttachmentMenu(false);
        clearReplyingToMessage();
        
        // Clear file inputs synchronously
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (videoInputRef.current) videoInputRef.current.value = "";
        if (docInputRef.current) docInputRef.current.value = "";
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            // Force immediate reflow for instant visual feedback
            textareaRef.current.offsetHeight;
        }

        // Prepare data (use captured values)
        const replySenderId =
            currentReplyingToMessage?.senderId?._id ||
            currentReplyingToMessage?.senderId ||
            null;
        const replySenderName =
            currentReplyingToMessage?.senderName ||
            (replySenderId &&
            selectedUser &&
            String(replySenderId) === String(selectedUser._id)
                ? selectedUser.fullName
                : null) ||
            (replySenderId && authUser && String(replySenderId) === String(authUser._id)
                ? "You"
                : currentReplyingToMessage?.senderId?.fullName || "Member");

        const messageData = {
            text: currentText,
            mentions: currentMentions,
            replyTo: currentReplyingToMessage?.realId || currentReplyingToMessage?._id || null,
            replyToMessage: currentReplyingToMessage ? {
                text: currentReplyingToMessage.text,
                image: currentReplyingToMessage.image,
                senderId: replySenderId,
                senderName: replySenderName
            } : null,
            ...extraData
        };

        if (currentImage) {
            messageData.image = currentImage;
        }

        if (currentFile) {
            messageData.file = currentFile.base64;
            messageData.fileName = currentFile.name;
            if (!messageData.text) messageData.text = `📎 ${currentFile.name}`;
        }

        if (currentVideo) {
            setIsVideoUploading(true);
            chatFeaturesApi
                .uploadVideo(currentVideo.file, currentVideo.duration, setVideoUploadProgress)
                .then((res) => {
                    const payload = {
                        ...messageData,
                        video: res.data.video,
                        videoThumbnail: res.data.videoThumbnail,
                        videoDuration: res.data.videoDuration,
                        videoPublicId: res.data.videoPublicId,
                    };
                    if (!payload.text) payload.text = "🎬 Video";
                    const send = onSend || sendMessage;
                    return send(payload);
                })
                .then(() => {
                    if (messageData.scheduledFor) toast.success("Message scheduled");
                })
                .catch((err) => {
                    console.error("Video upload failed", err);
                    toast.error(err.response?.data?.error || "Failed to upload video");
                })
                .finally(() => {
                    setIsVideoUploading(false);
                    isSendingRef.current = false;
                });
            return;
        }

        // Process audio asynchronously without blocking UI
        if (currentAudioBlob) {
            // Process audio in background, don't block UI
            blobToBase64(currentAudioBlob).then((base64Audio) => {
                messageData.audio = base64Audio;
                if (!messageData.text) messageData.text = "🎤 Voice message";
                
                // Send message with audio (non-blocking)
                if (onSend) {
                    onSend(messageData).catch(err => {
                        console.error("Failed to send message:", err);
                        toast.error("Failed to send message");
                    });
                } else {
                    sendMessage(messageData).catch(err => {
                        console.error("Failed to send message:", err);
                        toast.error("Failed to send message");
                    });
                }
            }).catch((err) => {
                console.error("Audio processing failed", err);
                toast.error("Failed to process audio");
                isSendingRef.current = false;
            });
            
            // Unlock after a short delay for audio messages
            setTimeout(() => {
                isSendingRef.current = false;
            }, 300);
            return; // Exit early for audio messages
        }

        // Send non-audio messages IMMEDIATELY (synchronous call, no Promise wrapper)
        // The sendMessage function handles optimistic updates internally
        if (onSend) {
            onSend(messageData).then(() => {
                if (messageData.scheduledFor) toast.success("Message scheduled");
            }).catch((error) => {
                console.error("Failed to send message:", error);
                toast.error("Failed to send message");
            });
        } else {
            // Call sendMessage immediately - it will add optimistic message instantly
            sendMessage(messageData).then(() => {
                if (messageData.scheduledFor) toast.success("Message scheduled");
            }).catch((error) => {
                console.error("Failed to send message:", error);
                toast.error("Failed to send message");
            });
        }
        
        // Unlock immediately for non-audio messages (no setTimeout delay)
        isSendingRef.current = false;
    };
    sendHandlerRef.current = handleSendMessage;

    // --- Event Handlers (Paste, KeyDown, TextChange) ---
    // (Simiplified logic from previous implementation)

    const handlePaste = (e) => {
        if (isRestricted) return;
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (!file) continue;
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result);
                    setGifPreview(null);
                    setMediaType('image');
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    };

    const handleKeyDown = (e) => {
        if (showMentions && filteredMembers.length > 0) {
            // ... duplicate navigation logic or reuse ...
            // For brevity, skipping advanced mention nav keys here, assume simple works
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const insertMention = (member) => {
        const before = text.slice(0, mentionStartIndex);
        const after = text.slice(textareaRef.current?.selectionStart || text.length);
        const mentionText = `@${member.user?.fullName} `;
        setText(before + mentionText + after);
        setShowMentions(false);
        setMentionSearch("");
        setMentionStartIndex(-1);
        if (!selectedMentions.includes(member.user?._id)) {
            setSelectedMentions(prev => [...prev, member.user?._id]);
        }
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleTextChange = (e) => {
        if (isRestricted) return;
        const val = e.target.value;
        setText(val);

        // Optimized typing indicator - only emit on first character and debounce
        if (socket && val.trim()) {
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                if (isGroupChat && selectedGroup) {
                    socket.emit("group:typing", { groupId: selectedGroup._id });
                } else if (selectedUser) {
                    socket.emit("typing", { receiverId: selectedUser._id });
                }
            }

            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Auto-stop typing after 1 second of no typing
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                if (isGroupChat && selectedGroup) {
                    socket.emit("group:stopTyping", { groupId: selectedGroup._id });
                } else if (selectedUser) {
                    socket.emit("stopTyping", { receiverId: selectedUser._id });
                }
            }, 1000);
        }

        // Optimized mention detection - only run when @ is typed or in mention mode
        if (isGroupChat && groupMembers.length > 0) {
            const cursorPos = e.target.selectionStart;
            const lastChar = val[cursorPos - 1];

            // Only check mentions if we just typed @ OR we're already in mention mode
            if (lastChar === '@' || showMentions) {
                const textBefore = val.slice(0, cursorPos);
                const lastAt = textBefore.lastIndexOf("@");
                if (lastAt !== -1) {
                    const charBefore = lastAt > 0 ? textBefore[lastAt - 1] : " ";
                    if (charBefore === " " || charBefore === "\n" || lastAt === 0) {
                        const search = textBefore.slice(lastAt + 1);
                        if (!search.includes(" ")) {
                            setShowMentions(true);
                            setMentionSearch(search);
                            setMentionStartIndex(lastAt);
                        } else setShowMentions(false);
                    } else setShowMentions(false);
                } else setShowMentions(false);
            } else if (showMentions) {
                // Close mentions if we're in mention mode but no @ found
                setShowMentions(false);
            }
        }

        // Optimized textarea auto-resize — only write when height actually changes
        if (textareaRef.current) {
            const el = textareaRef.current;
            el.style.height = "auto";
            const next = `${Math.min(el.scrollHeight, 120)}px`;
            if (el.style.height !== next) {
                el.style.height = next;
            }
        }
    };

    return (
        <div className="w-full message-input-container">
            {isRestricted ? (
                <div className="flex items-center justify-center gap-2 p-4 bg-base-200/50 rounded-2xl border border-dashed border-base-300 text-base-content/50">
                    <Megaphone className="w-4 h-4" />
                    <p className="text-sm font-medium">Only admins can send messages in this group</p>
                </div>
            ) : (
                <>
                    {/* Preview Areas (Reply, Image, Audio, File) */}
                    {replyingToMessage && (
                        <div className="mb-3 preview-container reply-preview flex items-center gap-3 p-3 bg-base-200/50 rounded-xl border border-base-300 backdrop-blur-sm">
                            <div className="h-full w-1 bg-primary rounded-full absolute left-0 top-0 bottom-0 my-2 ml-1"></div>
                            <div className="p-2 rounded-full bg-primary/10 text-primary ml-2"><Reply size={18} /></div>
                            <div className="flex-1 overflow-hidden min-w-0">
                                <p className="text-xs font-bold text-primary mb-0.5 truncate">Replying to {replyingToMessage.senderName}</p>
                                <p className="text-sm truncate opacity-70">{replyingToMessage.text || "Media"}</p>
                            </div>
                            <button onClick={clearReplyingToMessage} className="btn btn-circle btn-xs btn-ghost"><X className="w-4 h-4" /></button>
                        </div>
                    )}

                    {(imagePreview || gifPreview) && (
                        <div className="mb-3 preview-container relative">
                            <img src={imagePreview || gifPreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-base-300" />
                            <button onClick={removeMedia} className="absolute -top-2 left-20 btn btn-circle btn-xs bg-base-100 shadow-md"><X className="w-3 h-3" /></button>
                        </div>
                    )}

                    {filePreview && (
                        <div className="mb-3 p-3 bg-base-200 rounded-xl flex items-center gap-3 relative inline-flex">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg"><FileText size={24} /></div>
                            <div>
                                <p className="text-sm font-bold">{filePreview.name}</p>
                                <p className="text-xs opacity-60">{filePreview.size}</p>
                            </div>
                            <button onClick={removeMedia} className="btn btn-circle btn-xs btn-ghost hover:bg-base-300 ml-2"><X className="w-4 h-4" /></button>
                        </div>
                    )}

                    {audioBlob && !voice.isRecording && (
                        <div className="mb-3 p-2 bg-base-200 rounded-xl flex items-center gap-2 max-w-xs animate-[voiceSendIn_0.28s_ease-out]">
                            <VoiceMessagePlayer audioUrl={audioUrl} compact />
                            <button onClick={cancelRecording} className="btn btn-circle btn-xs btn-ghost hover:bg-base-300 flex-shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                    )}

                    {videoPreview && (
                        <div className="mb-3 p-3 bg-base-200 rounded-xl flex items-center gap-3 max-w-sm relative">
                            <video src={videoPreview.url} className="w-20 h-20 rounded-lg object-cover bg-black" muted />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{videoPreview.file.name}</p>
                                {isVideoUploading ? (
                                    <div className="mt-1">
                                        <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all" style={{ width: `${videoUploadProgress}%` }} />
                                        </div>
                                        <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading {videoUploadProgress}%
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs opacity-60">Ready to send</p>
                                )}
                            </div>
                            <button onClick={removeMedia} className="btn btn-circle btn-xs btn-ghost"><X className="w-4 h-4" /></button>
                        </div>
                    )}

                    {/* Main Input Row */}
                    <form onSubmit={handleFormSubmit} className="flex items-end gap-2 min-w-0 w-full max-w-full">
                        {/* Hidden Inputs */}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                        <input type="file" accept={VIDEO_ACCEPT} className="hidden" ref={videoInputRef} onChange={handleVideoChange} />
                        <input type="file" className="hidden" ref={docInputRef} onChange={handleFileChange} />

                        {voice.isRecording || (voice.isLocked && !audioBlob) ? (
                            <div className="flex-grow min-w-0 relative">
                                <VoiceRecorderBar
                                    duration={voice.duration}
                                    levels={voice.levels}
                                    slideX={voice.slideX}
                                    slideY={voice.slideY}
                                    cancelProgress={voice.cancelProgress}
                                    lockProgress={voice.lockProgress}
                                    isLocked={voice.isLocked}
                                    previewUrl={voice.previewUrl}
                                    onCancel={cancelRecording}
                                    onSend={() => {
                                            voice.sendLocked();
                                            setAudioBlob(null);
                                            setAudioUrl(null);
                                            setMediaType(null);
                                        }}
                                        onStopToPreview={() => voice.stopToPreview()}
                                />
                            </div>
                        ) : (
                        /* WhatsApp-Style Input Capsule */
                        <div className="flex-grow flex-shrink min-w-0 flex items-end bg-base-200/90 hover:bg-base-200 rounded-[24px] px-1 py-1 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                            {/* Emoji Group (Left) */}
                            <div className="flex items-center shrink-0 self-end mb-0.5 ml-0.5">
                                <EmojiPickerComponent onEmojiSelect={handleEmojiSelect} />
                            </div>

                            {/* Text Area (Middle) */}
                            <textarea
                                ref={textareaRef}
                                className="message-textarea flex-1 bg-transparent py-2.5 px-1.5 sm:px-2 outline-none resize-none min-h-[20px] max-h-[120px] text-[14px] leading-[18px] sm:text-[15px] placeholder:text-base-content/40"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                placeholder="Message"
                                value={text}
                                onChange={handleTextChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                rows={1}
                            />

                            {/* Attachment Actions (Right) */}
                            <div className="flex items-center shrink-0 self-end mb-0.5 mr-0.5 gap-0.5">
                                {/* Attachment (Paperclip) */}
                                <div className="relative" ref={attachmentMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                        className={`p-1.5 rounded-full transition-all text-base-content/60 hover:bg-base-300 hover:text-base-content ${showAttachmentMenu ? 'rotate-45 text-primary bg-primary/10' : ''}`}
                                        title="Attach file"
                                    >
                                        <Paperclip className="w-[22px] h-[22px]" />
                                    </button>

                                    {/* Attachment Menu */}
                                    {showAttachmentMenu && (
                                        <div className="absolute bottom-12 right-0 bg-base-100 p-2 rounded-2xl shadow-xl border border-base-300 flex flex-col gap-1 min-w-[150px] animate-scale-in z-50">
                                            <button type="button" onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
                                                <span className="p-1.5 bg-green-100 text-green-600 rounded-lg"><Image className="w-4 h-4" /></span> Photos
                                            </button>
                                            <button type="button" onClick={() => { videoInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
                                                <span className="p-1.5 bg-violet-100 text-violet-600 rounded-lg"><Film className="w-4 h-4" /></span> Video
                                            </button>
                                            <button type="button" onClick={() => { setShowAttachmentMenu(false); setShowGifPicker(true); }} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium w-full">
                                                <span className="p-1.5 bg-pink-100 text-pink-600 rounded-lg"><Clapperboard className="w-4 h-4" /></span> GIF
                                            </button>
                                            <button type="button" onClick={() => { docInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
                                                <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><FileText className="w-4 h-4" /></span> Document
                                            </button>
                                            <button type="button" onClick={() => { setShowPollCreator(true); setShowAttachmentMenu(false); }} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
                                                <span className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg"><BarChart2 className="w-4 h-4" /></span> Poll
                                            </button>
                                            <button type="button" onClick={() => { setShowScheduleModal(true); setShowAttachmentMenu(false); }} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
                                                <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Calendar className="w-4 h-4" /></span> Schedule
                                            </button>
                                        </div>
                                    )}

                                    {/* Standalone GIF Picker controlled by state */}
                                    <GifPicker 
                                        isOpen={showGifPicker}
                                        onClose={() => setShowGifPicker(false)}
                                        onGifSelect={(gifUrl) => {
                                            handleGifSelect(gifUrl);
                                            setShowGifPicker(false);
                                        }} 
                                    />
                                </div>

                                {/* Camera Instant Button */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 rounded-full text-base-content/60 hover:bg-base-300 hover:text-base-content"
                                    title="Take photo"
                                >
                                    <Camera className="w-[22px] h-[22px]" />
                                </button>
                            </div>
                        </div>
                        )}

                        {/* Mic / Send — mic stays mounted while recording so pointer capture survives */}
                        {!(voice.isRecording || (voice.isLocked && !audioBlob)) &&
                        (text.trim() || imagePreview || gifPreview || filePreview || audioBlob || videoPreview) ? (
                            <button
                                type="submit"
                                className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-primary text-primary-content shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        ) : voice.isLocked && !audioBlob ? null : (
                            <button
                                type="button"
                                className={`voice-mic-btn ${voice.isRecording ? "voice-mic-btn--recording" : ""}`}
                                onPointerDown={voice.onPointerDown}
                                onPointerMove={voice.onPointerMove}
                                onPointerUp={voice.onPointerUp}
                                onPointerCancel={voice.onPointerCancel}
                                aria-label={voice.isRecording ? "Recording" : "Hold to record voice message"}
                                title="Hold to record"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                        )}
                    </form>

                    {/* Modals */}
                    {showPollCreator && (
                        <PollCreator
                            onSubmit={(pollData) => { setShowPollCreator(false); handleSendMessage(null, { poll: pollData }); }}
                            onCancel={() => setShowPollCreator(false)}
                        />
                    )}

                    {showScheduleModal && (
                        <ScheduleMessageModal
                            initialText={text}
                            onSubmit={({ date, text: scheduledText, isScheduled }) => {
                                setShowScheduleModal(false);
                                setText(""); // Clear input
                                handleSendMessage(null, { scheduledFor: date, text: scheduledText, isScheduled });
                            }}
                            onCancel={() => setShowScheduleModal(false)}
                        />
                    )}

                    {/* Mentions Dropdown */}
                    {showMentions && isGroupChat && filteredMembers.length > 0 && (
                        <div ref={mentionsRef} className="absolute bottom-full mb-2 left-0 w-full max-w-xs bg-base-100 rounded-xl border border-base-300 shadow-xl overflow-hidden max-h-48 overflow-y-auto z-50">
                            {/* ... reuse mention list rendering ... */}
                            {filteredMembers.map((member, index) => (
                                <button
                                    key={member.user?._id}
                                    type="button"
                                    className={`w-full flex items-center gap-3 px-3 py-2 ${index === selectedMentionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                                    onClick={() => insertMention(member)}
                                >
                                    <img src={member.user?.profilePic || "/avatar.png"} className="w-8 h-8 rounded-full object-cover" />
                                    <div className="text-left">
                                        <p className="text-sm font-bold">{member.user?.fullName}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default memo(MessageInput, (prev, next) => {
    return (
        prev.onSend === next.onSend &&
        prev.isGroupChat === next.isGroupChat &&
        prev.isAdmin === next.isAdmin &&
        prev.announcementOnly === next.announcementOnly &&
        prev.groupMembers === next.groupMembers
    );
});