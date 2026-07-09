import { useState, useRef, useEffect, memo } from 'react';
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
        <div className="relative emoji-picker-wrapper" ref={pickerRef}>
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="p-1.5 rounded-full text-base-content/60 hover:bg-base-300 hover:text-base-content transition-colors"
                title="Add emoji"
            >
                <Smile className="w-[22px] h-[22px]" />
            </button>

            {showPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-base-300 w-[320px] emoji-picker-container">
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width="100%"
                        height={320}
                        searchDisabled={true}
                        previewConfig={{
                            showPreview: false,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default memo(EmojiPickerComponent);
