import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPickerComponent from "./EmojiPickerComponent";

const MessageInput = () => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    const { sendMessage } = useChatStore();

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() && !imagePreview) return;

        // Store message data before clearing
        const messageData = {
            text: text.trim(),
            image: imagePreview,
        };

        // Clear form IMMEDIATELY for instant feedback
        setText("");
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        // Send message in background
        try {
            await sendMessage(messageData);
        } catch (error) {
            console.error("Failed to send message:", error);
            // Optionally restore the message on error
            setText(messageData.text);
            setImagePreview(messageData.image);
        }
    };

    const handleKeyDown = (e) => {
        // Send message on Enter key (without Shift)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    return (
        <div className="p-4 w-full border-t border-base-300 bg-base-200">
            {imagePreview && (
                <div className="mb-3 flex items-center gap-2">
                    <div className="relative">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg"
                        />
                        <button
                            onClick={removeImage}
                            className="absolute -top-1.5 -right-1.5 btn btn-circle btn-xs btn-error"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex-1 flex gap-2 items-center">
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        placeholder="Type a message..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                    />

                    {/* Emoji Picker */}
                    <EmojiPickerComponent
                        onEmojiSelect={(emoji) => setText(prev => prev + emoji)}
                    />

                    {/* Image Button */}
                    <button
                        type="button"
                        className="btn btn-circle btn-ghost"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Image size={20} />
                    </button>
                </div>

                {/* Send Button */}
                <button
                    type="submit"
                    className="btn btn-circle btn-primary"
                    disabled={!text.trim() && !imagePreview}
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
};
export default MessageInput;