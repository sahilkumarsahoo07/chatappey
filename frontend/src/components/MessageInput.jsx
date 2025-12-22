import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Reply } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPickerComponent from "./EmojiPickerComponent";
import GifPicker from "./GifPicker";
import "./MessageInput.css";

const MessageInput = ({ onSend, isGroupChat = false }) => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [gifPreview, setGifPreview] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'image' or 'gif'
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const { sendMessage, replyingToMessage, clearReplyingToMessage } = useChatStore();

    const handleImageChange = (e) => {
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

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() && !imagePreview && !gifPreview) return;

        // Store message data before clearing
        const messageData = {
            text: text.trim(),
            image: imagePreview || gifPreview,
        };

        // Clear form IMMEDIATELY for instant feedback
        setText("");
        setImagePreview(null);
        setGifPreview(null);
        setMediaType(null);
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
        // Send message on Enter key (without Shift)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const handleTextChange = (e) => {
        setText(e.target.value);

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    };

    return (
        <div className="p-4 w-full message-input-container">
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
        </div>
    );
};

export default MessageInput;