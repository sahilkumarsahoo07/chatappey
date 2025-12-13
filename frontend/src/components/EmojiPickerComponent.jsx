import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile } from 'lucide-react';

const EmojiPickerComponent = ({ onEmojiSelect }) => {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
            }
        };

        if (showPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPicker]);

    const handleEmojiClick = (emojiData) => {
        onEmojiSelect(emojiData.emoji);
        setShowPicker(false);
    };

    return (
        <div className="relative" ref={pickerRef}>
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="btn btn-circle btn-ghost hover-lift"
                title="Add emoji"
            >
                <Smile className="w-5 h-5" />
            </button>

            {showPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-base-300">
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={350}
                        height={400}
                        previewConfig={{
                            showPreview: false,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default EmojiPickerComponent;
