import { useChatStore } from "../store/useChatStore";
import { useState, useEffect } from "react";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
    const { selectedUser } = useChatStore();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="h-screen bg-base-200 pl-16 md:pl-20">
            <div className="flex h-full w-full bg-base-100">
                {/* Sidebar - Hidden on mobile when chat is selected */}
                {(!isMobile || !selectedUser) && (
                    <div className={isMobile ? 'w-full' : ''}>
                        <Sidebar />
                    </div>
                )}

                {/* Chat Area - Always visible on desktop, conditional on mobile */}
                {(!isMobile || selectedUser) && (
                    <div className={`flex-1 ${isMobile ? 'w-full' : ''}`}>
                        {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
                    </div>
                )}
            </div>
        </div>
    );
};
export default HomePage;