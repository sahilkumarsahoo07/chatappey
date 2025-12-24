import React, { useState } from 'react';
import { TextField } from "@mui/material";

const MessageEditField = ({ initialText, onSave, onCancel, isMyMessage }) => {
    const [text, setText] = useState(initialText);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim() && text !== initialText) {
                onSave(text);
            } else {
                onCancel();
            }
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="flex flex-col gap-2 min-w-[200px] py-1">
            <TextField
                fullWidth
                multiline
                size="small"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                variant="standard"
                autoFocus
                InputProps={{
                    disableUnderline: true,
                    style: {
                        fontSize: '0.875rem',
                        padding: '4px 0',
                        color: 'inherit'
                    }
                }}
            />
            <div className="flex justify-end gap-3 mt-1 pt-1 border-t border-base-content/10">
                <button
                    onClick={onCancel}
                    className={`text-[10px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100 ${isMyMessage ? 'text-white' : ''}`}
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        if (text.trim() && text !== initialText) {
                            onSave(text);
                        } else {
                            onCancel();
                        }
                    }}
                    className={`text-[10px] font-bold uppercase tracking-wider ${isMyMessage ? 'text-white' : 'text-primary'} hover:opacity-80`}
                >
                    Save
                </button>
            </div>
        </div>
    );
};

export default MessageEditField;
