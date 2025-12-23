import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Reply, Megaphone } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPickerComponent from "./EmojiPickerComponent";
import GifPicker from "./GifPicker";
import "./MessageInput.css";

const MessageInput = ({ onSend, isGroupChat = false, isAdmin = false, announcementOnly = false, groupMembers = [] }) => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [gifPreview, setGifPreview] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'image' or 'gif'
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [selectedMentions, setSelectedMentions] = useState([]); // Track mentioned user IDs
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const mentionsRef = useRef(null);
    const { sendMessage, replyingToMessage, clearReplyingToMessage } = useChatStore();

    const isRestricted = isGroupChat && announcementOnly && !isAdmin;

    // Filter members based on search
    const filteredMembers = groupMembers.filter(member =>
        member.user?.fullName?.toLowerCase().includes(mentionSearch.toLowerCase())
    );

    // Reset selected index when filtered list changes
    useEffect(() => {
        setSelectedMentionIndex(0);
    }, [mentionSearch]);

    // Auto-focus input when replying to a message
    useEffect(() => {
        if (replyingToMessage && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [replyingToMessage]);

    // Close mentions dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (mentionsRef.current && !mentionsRef.current.contains(e.target)) {
                setShowMentions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
            setMediaType('image');
        };
        reader.readAsDataURL(file);
    };

    const handleGifSelect = (gifUrl) => {
        if (isRestricted) return;
        setGifPreview(gifUrl);
        setImagePreview(null);
        setMediaType('gif');
        toast.success("GIF selected!");
    };

    const removeMedia = () => {
        setImagePreview(null);
        setGifPreview(null);
        setMediaType(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Handle paste event for clipboard images (screenshots)
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
                    toast.success("Screenshot pasted!");
                };
                reader.readAsDataURL(file);
                break; // Only handle the first image
            }
        }
    };

    const insertMention = (member) => {
        const beforeMention = text.slice(0, mentionStartIndex);
        const afterMention = text.slice(textareaRef.current?.selectionStart || text.length);
        const mentionText = `@${member.user?.fullName} `;

        setText(beforeMention + mentionText + afterMention);
        setShowMentions(false);
        setMentionSearch("");
        setMentionStartIndex(-1);

        // Add to selected mentions if not already present
        if (!selectedMentions.includes(member.user?._id)) {
            setSelectedMentions(prev => [...prev, member.user?._id]);
        }

        // Focus back on textarea
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (isRestricted) return;
        if (!text.trim() && !imagePreview && !gifPreview) return;

        // Store message data before clearing
        const messageData = {
            text: text.trim(),
            image: imagePreview || gifPreview,
            mentions: selectedMentions, // Include mentions
        };

        // Clear form IMMEDIATELY for instant feedback
        setText("");
        setImagePreview(null);
        setGifPreview(null);
        setMediaType(null);
        setSelectedMentions([]);
        clearReplyingToMessage(); // Clear reply preview after sending
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Send message in background
        try {
            // Use onSend prop if provided (for group chat), otherwise use default sendMessage
            if (onSend) {
                await onSend(messageData);
            } else {
                await sendMessage(messageData);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send message");
            // Optionally restore the message on error
            setText(messageData.text);
            if (mediaType === 'image') {
                setImagePreview(messageData.image);
            } else if (mediaType === 'gif') {
                setGifPreview(messageData.image);
            }
        }
    };

    const handleKeyDown = (e) => {
        // Handle mention navigation
        if (showMentions && filteredMembers.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedMentionIndex(prev =>
                    prev < filteredMembers.length - 1 ? prev + 1 : 0
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedMentionIndex(prev =>
                    prev > 0 ? prev - 1 : filteredMembers.length - 1
                );
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(filteredMembers[selectedMentionIndex]);
                return;
            }
            if (e.key === "Escape") {
                setShowMentions(false);
                return;
            }
        }

        // Send message on Enter key (without Shift)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const handleTextChange = (e) => {
        if (isRestricted) return;
        const newText = e.target.value;
        setText(newText);

        // Detect @ mentions in group chat
        if (isGroupChat && groupMembers.length > 0) {
            const cursorPos = e.target.selectionStart;
            const textBeforeCursor = newText.slice(0, cursorPos);

            // Find the last @ before cursor
            const lastAtIndex = textBeforeCursor.lastIndexOf("@");

            if (lastAtIndex !== -1) {
                // Check if @ is at start or preceded by whitespace
                const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
                if (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) {
                    const searchText = textBeforeCursor.slice(lastAtIndex + 1);
                    // Only show if no space after the search text
                    if (!searchText.includes(" ")) {
                        setShowMentions(true);
                        setMentionSearch(searchText);
                        setMentionStartIndex(lastAtIndex);
                    } else {
                        setShowMentions(false);
                    }
                } else {
                    setShowMentions(false);
                }
            } else {
                setShowMentions(false);
            }
        }

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
                    {/* Reply Preview */}
                    {replyingToMessage && (
                        <div className="mb-3 preview-container reply-preview flex items-center gap-3 p-3 bg-base-200/50 rounded-xl border border-base-300 backdrop-blur-sm">
                            <div className="h-full w-1 bg-primary rounded-full absolute left-0 top-0 bottom-0 my-2 ml-1"></div>
                            <div className="p-2 rounded-full bg-primary/10 text-primary ml-2">
                                <Reply size={18} />
                            </div>
                            <div className="flex-1 overflow-hidden min-w-0">
                                <p className="text-xs font-bold text-primary mb-0.5 truncate">
                                    Replying to {replyingToMessage.senderName || "User"}
                                </p>
                                <p className="text-sm truncate opacity-70 text-base-content">
                                    {replyingToMessage.text || (replyingToMessage.image ? "📷 Photo" : "")}
                                </p>
                            </div>
                            <button
                                onClick={clearReplyingToMessage}
                                className="btn btn-circle btn-xs btn-ghost hover:bg-base-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            {replyingToMessage.image && (
                                <img
                                    src={replyingToMessage.image}
                                    alt="Reply preview"
                                    className="w-10 h-10 rounded object-cover ml-2 border border-base-300"
                                />
                            )}
                        </div>
                    )}

                    {/* Media Preview */}
                    {(imagePreview || gifPreview) && (
                        <div className="mb-3 preview-container">
                            <div className="flex items-start gap-3">
                                <div className="relative group">
                                    <img
                                        src={imagePreview || gifPreview}
                                        alt="Preview"
                                        className="w-24 h-24 object-cover preview-image"
                                    />
                                    <button
                                        onClick={removeMedia}
                                        className="absolute -top-2 -right-2 btn btn-circle btn-xs remove-preview-btn"
                                        type="button"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>

                                    {/* Media Type Badge */}
                                    <div className="absolute bottom-2 left-2 media-type-badge">
                                        {mediaType === 'gif' ? 'GIF' : 'IMAGE'}
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <p className="text-sm font-medium mb-1">
                                        {mediaType === 'gif' ? '🎬 GIF Selected' : '🖼️ Image Selected'}
                                    </p>
                                    <p className="text-xs text-base-content/60">
                                        {mediaType === 'gif'
                                            ? 'Your GIF is ready to send!'
                                            : 'Your image is ready to send!'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mentions Suggestions Dropdown */}
                    {showMentions && isGroupChat && filteredMembers.length > 0 && (
                        <div
                            ref={mentionsRef}
                            className="mb-3 bg-base-100 rounded-xl border border-base-300 shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                        >
                            <div className="px-3 py-2 text-xs font-semibold text-base-content/60 bg-base-200/50 border-b border-base-300">
                                Mention a member
                            </div>
                            {filteredMembers.map((member, index) => (
                                <button
                                    key={member.user?._id}
                                    type="button"
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-base-200 transition-colors ${index === selectedMentionIndex ? 'bg-primary/10' : ''
                                        }`}
                                    onClick={() => insertMention(member)}
                                >
                                    <img
                                        src={member.user?.profilePic || "/avatar.png"}
                                        alt={member.user?.fullName}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-base-content">
                                            {member.user?.fullName}
                                        </p>
                                        <p className="text-xs text-base-content/50">
                                            {member.role === "admin" ? "Admin" : "Member"}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Form */}
                    <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                        {/* Main Input Area */}
                        <div className="flex-1 min-w-0 flex items-center gap-2 bg-base-200/80 hover:bg-base-200 rounded-full px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-primary/30 focus-within:bg-base-200">
                            <textarea
                                ref={textareaRef}
                                className="flex-1 bg-transparent py-1.5 outline-none resize-none message-textarea min-w-0 text-sm md:text-base placeholder:text-base-content/40"
                                placeholder="Type a message..."
                                value={text}
                                onChange={handleTextChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                rows={1}
                            />

                            {/* Action Buttons Row */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Emoji Picker */}
                                <EmojiPickerComponent
                                    onEmojiSelect={(emoji) => setText(prev => prev + emoji)}
                                />

                                {/* GIF Picker */}
                                <GifPicker onGifSelect={handleGifSelect} />

                                {/* Image Button */}
                                <button
                                    type="button"
                                    className="p-2 rounded-full hover:bg-base-300 text-base-content/60 hover:text-base-content transition-all"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Add image"
                                >
                                    <Image className="w-5 h-5" />
                                </button>

                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                />
                            </div>
                        </div>

                        {/* Send Button */}
                        <button
                            type="submit"
                            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${text.trim() || imagePreview || gifPreview
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                                : 'bg-base-200 text-base-content/30 cursor-not-allowed'
                                }`}
                            disabled={!text.trim() && !imagePreview && !gifPreview}
                            title="Send message"
                        >
                            <Send className={`w-5 h-5 ${text.trim() || imagePreview || gifPreview ? '' : ''}`} />
                        </button>
                    </form>
                </>
            )}
        </div>
    );
};

export default MessageInput;