import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

const ScheduleMessageModal = ({ onSubmit, onCancel, initialText = "" }) => {
    // Default to 1 hour from now
    const getDefaultTime = () => {
        const date = new Date();
        date.setHours(date.getHours() + 1);
        date.setMinutes(0);
        return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    };

    const [scheduledTime, setScheduledTime] = useState(getDefaultTime());
    const [messageText, setMessageText] = useState(initialText);
    const dateInputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        const date = new Date(scheduledTime);
        if (date <= new Date()) {
            toast.error("Please pick a time in the future");
            return;
        }
        if (!messageText.trim()) {
            toast.error("Please enter a message");
            return;
        }
        console.log("Scheduling message for:", date.toISOString());

        onSubmit({
            date: date.toISOString(),
            text: messageText.trim(),
            isScheduled: true
        });
    };

    const handleDateChange = (e) => {
        setScheduledTime(e.target.value);
    };

    const isValid = messageText.trim().length > 0 && new Date(scheduledTime) > new Date();

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-base-100 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-scale-in">
                <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Clock className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">Schedule Message</h3>
                    </div>
                    <button onClick={onCancel} className="btn btn-ghost btn-circle btn-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <p className="text-sm text-base-content/70">
                        Pick a time to send your message. It will be delivered automatically.
                    </p>

                    {/* Message Input */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Message</span>
                        </label>
                        <textarea
                            className="textarea textarea-bordered w-full resize-none bg-base-200/50 focus:bg-base-100"
                            placeholder="Type your message..."
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            rows={3}
                            autoFocus
                        />
                    </div>

                    {/* Date & Time Input */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Date & Time</span>
                        </label>
                        <input
                            ref={dateInputRef}
                            type="datetime-local"
                            className="input input-bordered w-full text-base-content bg-base-200/50 focus:bg-base-100"
                            value={scheduledTime}
                            onChange={handleDateChange}
                            min={new Date().toISOString().slice(0, 16)}
                        />
                    </div>

                    <div className="text-xs text-base-content/50 text-center bg-base-200/30 p-2 rounded-lg border border-base-content/5">
                        Will be sent: <span className="font-medium text-primary">{format(new Date(scheduledTime), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                </div>

                <div className="p-4 border-t border-base-300 bg-base-200/30 flex justify-end gap-2">
                    <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        className="btn btn-primary gap-2 px-6"
                        disabled={!isValid}
                    >
                        <Send className="w-4 h-4" />
                        Schedule
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ScheduleMessageModal;
