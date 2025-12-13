import { MessageSquare } from "lucide-react";

const NoChatSelected = () => {
    return (
        <div className="w-full flex flex-1 flex-col items-center justify-center p-6 md:p-16 bg-base-100">
            <div className="max-w-md text-center space-y-6">
                {/* Icon Display */}
                <div className="flex justify-center gap-4 mb-6">
                    <div className="relative">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                            <MessageSquare className="w-10 h-10 md:w-12 md:h-12 text-primary" strokeWidth={2} />
                        </div>
                    </div>
                </div>

                {/* Welcome Text */}
                <div className="space-y-3">
                    <h2 className="text-2xl md:text-3xl font-bold">
                        Welcome to ChatAppey!
                    </h2>
                    <p className="text-base md:text-lg text-base-content/60">
                        Select a conversation from the sidebar to start chatting
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NoChatSelected;