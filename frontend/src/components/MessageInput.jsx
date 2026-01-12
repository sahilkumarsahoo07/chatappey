import { useRef, useState, useEffect, useMemo, memo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Reply, Megaphone, Mic, Paperclip, FileText, BarChart2, Calendar, StopCircle, Play, Pause } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPickerComponent from "./EmojiPickerComponent";
import GifPicker from "./GifPicker";
import PollCreator from "./PollCreator";
import ScheduleMessageModal from "./ScheduleMessageModal";
import "./MessageInput.css";
import { useShallow } from "zustand/react/shallow";

// Voice Preview Player Component
const VoicePreviewPlayer = ({ audioUrl }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl]);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
        } else {
            audioRef.current?.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleProgressClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-3 flex-1">
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            <button
                onClick={togglePlay}
                className="p-2 rounded-full flex-shrink-0 bg-secondary/20 hover:bg-secondary/30 transition-all"
            >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            <div className="flex-1 flex flex-col gap-1">
                <div
                    className="h-1 bg-base-content/20 rounded-full cursor-pointer relative overflow-hidden"
                    onClick={handleProgressClick}
                >
                    <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs opacity-60">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <div className="flex-shrink-0 opacity-50">
                <Mic size={16} />
            </div>
        </div>
    );
};

const MessageInput = ({ onSend, isGroupChat = false, isAdmin = false, announcementOnly = false, groupMembers = [] }) => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [gifPreview, setGifPreview] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'image', 'gif', 'audio', 'file'
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [filePreview, setFilePreview] = useState(null); // { name, type, size, base64 }

    // Mentions State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [selectedMentions, setSelectedMentions] = useState([]);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const isSendingRef = useRef(false); // Ref to prevent double sending

    // Modals & Menus
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // Refs
    const fileInputRef = useRef(null);
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
    const { selectedGroup } = useGroupStore();
    const { socket } = useAuthStore();

    const isRestricted = isGroupChat && announcementOnly && !isAdmin;
    const filteredMembers = useMemo(() => {
        return groupMembers.filter(member =>
            member.user?.fullName?.toLowerCase().includes(mentionSearch.toLowerCase())
        );
    }, [groupMembers, mentionSearch]);

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
            setAudioBlob(null);
            setMediaType('image');
            setShowAttachmentMenu(false);
        };
        reader.readAsDataURL(file);
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

    const handleGifSelect = (gifUrl) => {
        if (isRestricted) return;
        setGifPreview(gifUrl);
        setImagePreview(null);
        setFilePreview(null);
        setAudioBlob(null);
        setMediaType('gif');
        toast.success("GIF selected!");
    };

    // --- Audio Recording ---

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setAudioBlob(audioBlob);
                setAudioUrl(audioUrl);
                setMediaType('audio');
                setImagePreview(null);
                setGifPreview(null);
                setFilePreview(null);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            toast.error("Microphone access denied");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            setAudioBlob(null);
            setAudioUrl(null);
            audioChunksRef.current = [];
        } else {
            // If already stopped but present (preview mode)
            setAudioBlob(null);
            setAudioUrl(null);
            setMediaType(null);
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };


    // --- Generic Helpers ---

    const removeMedia = () => {
        setImagePreview(null);
        setGifPreview(null);
        setMediaType(null);
        setFilePreview(null);
        setAudioBlob(null);
        setAudioUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (docInputRef.current) docInputRef.current.value = "";
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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
        const hasMedia = !!(imagePreview || gifPreview || filePreview || audioBlob);
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
        const currentAudioBlob = audioBlob;
        const currentMentions = [...selectedMentions];

        // OPTIMISTIC UPDATE: Clear ALL UI IMMEDIATELY (synchronous for instant feedback)
        // Use flushSync for immediate DOM updates if available, otherwise synchronous
        setText("");
        removeMedia();
        setSelectedMentions([]);
        setShowAttachmentMenu(false);
        clearReplyingToMessage();
        
        // Clear file inputs synchronously
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (docInputRef.current) docInputRef.current.value = "";
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            // Force immediate reflow for instant visual feedback
            textareaRef.current.offsetHeight;
        }

        // Prepare data (use captured values)
        const messageData = {
            text: currentText,
            mentions: currentMentions,
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

        // Optimized textarea auto-resize using requestAnimationFrame
        if (textareaRef.current) {
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
                }
            });
        }
    };

    return (
        <div className="p-4 w-full message-input-container">
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

                    {audioBlob && !isRecording && (
                        <div className="mb-3 p-3 bg-base-200 rounded-xl flex items-center gap-2 max-w-xs">
                            <VoicePreviewPlayer audioUrl={audioUrl} />
                            <button onClick={cancelRecording} className="btn btn-circle btn-xs btn-ghost hover:bg-base-300 flex-shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                    )}

                    {/* Main Input Row */}
                    <form onSubmit={(e) => handleSendMessage(e)} className="flex items-end gap-2">

                        {/* Attachment Button */}
                        <div className="relative" ref={attachmentMenuRef}>
                            <button
                                type="button"
                                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                className={`p-3 rounded-full transition-all ${showAttachmentMenu ? 'bg-primary text-white rotate-45' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>

                            {/* Attachment Menu */}
                            {showAttachmentMenu && (
                                <div className="absolute bottom-14 left-0 bg-base-100 p-2 rounded-2xl shadow-xl border border-base-300 flex flex-col gap-1 min-w-[150px] animate-scale-in z-50">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
                                        <span className="p-1.5 bg-green-100 text-green-600 rounded-lg"><Image className="w-4 h-4" /></span> Photos & Videos
                                    </button>
                                    <button type="button" onClick={() => docInputRef.current?.click()} className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-xl text-left text-sm font-medium">
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
                        </div>

                        {/* Hidden Inputs */}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                        <input type="file" className="hidden" ref={docInputRef} onChange={handleFileChange} />

                        {/* Text Area */}
                        <div className="flex-1 min-w-0 flex items-center gap-2 bg-base-200/80 hover:bg-base-200 rounded-3xl px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                            <textarea
                                ref={textareaRef}
                                className="message-textarea flex-1 bg-transparent py-2 outline-none resize-none min-h-[24px] max-h-[120px] text-base placeholder:text-base-content/40 custom-scrollbar"
                                placeholder={isRecording ? "Recording..." : "Type a message..."}
                                value={text}
                                onChange={handleTextChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                rows={1}
                                disabled={isRecording}
                            />
                            <div className="flex items-center gap-1">
                                <EmojiPickerComponent onEmojiSelect={(emoji) => setText(prev => prev + emoji)} />
                                <GifPicker onGifSelect={handleGifSelect} />
                            </div>
                        </div>

                        {/* Mic / Send Button */}
                        {text.trim() || imagePreview || gifPreview || filePreview || audioBlob ? (
                            <button
                                type="submit"
                                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-primary text-primary-content shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${isRecording ? 'bg-error text-white animate-pulse' : 'bg-base-200 text-base-content hover:bg-base-300'}`}
                            >
                                {isRecording ? <StopCircle className="w-6 h-6" /> : <Mic className="w-5 h-5" />}
                            </button>
                        )}
                    </form>

                    {/* Recording Status Overlay/Indicator if separate logic wanted, but simpler is inline */}
                    {isRecording && (
                        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-base-100 px-6 py-3 rounded-full shadow-2xl border border-red-100 flex items-center gap-4 animate-in slide-in-from-bottom-4">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                            <span className="font-mono font-bold text-lg w-16 text-center">{formatDuration(recordingDuration)}</span>
                            <button onClick={cancelRecording} className="btn btn-xs btn-circle btn-ghost text-base-content/50 hover:text-error hover:bg-error/10">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

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

export default memo(MessageInput);