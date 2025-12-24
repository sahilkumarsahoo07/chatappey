import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Trash2 } from "lucide-react";

const PollCreator = ({ onSubmit, onCancel }) => {
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState([{ text: "" }, { text: "" }]);

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index].text = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        if (options.length < 5) {
            setOptions([...options, { text: "" }]);
        }
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        const validOptions = options.filter(opt => opt.text.trim());
        if (validOptions.length < 2) return;

        onSubmit({
            question,
            options: validOptions
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-base-100 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-in">
                <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200/50">
                    <h3 className="font-bold text-lg">Create Poll</h3>
                    <button onClick={onCancel} className="btn btn-ghost btn-circle btn-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Question</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-colors"
                            placeholder="Ask something..."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="label pb-0">
                            <span className="label-text font-medium">Options</span>
                        </label>
                        {options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    className="input input-bordered flex-1 input-sm bg-base-200/50 focus:bg-base-100"
                                    placeholder={`Option ${index + 1}`}
                                    value={option.text}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                />
                                {options.length > 2 && (
                                    <button
                                        onClick={() => removeOption(index)}
                                        className="btn btn-ghost btn-square btn-sm text-error/70 hover:text-error hover:bg-error/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {options.length < 5 && (
                        <button
                            onClick={addOption}
                            className="btn btn-ghost btn-sm btn-block border-dashed border-base-300 gap-2 normal-case font-normal"
                        >
                            <Plus className="w-4 h-4" /> Add Option
                        </button>
                    )}
                </div>

                <div className="p-4 border-t border-base-300 bg-base-200/30 flex justify-end gap-2">
                    <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        className="btn btn-primary px-6"
                        disabled={!question.trim() || options.filter(o => o.text.trim()).length < 2}
                    >
                        Create Poll
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PollCreator;
