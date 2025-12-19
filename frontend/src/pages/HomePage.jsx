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
        // Use dvh for dynamic viewport height (works better on mobile Safari)
        // pl-0 for mobile (bottom navbar), pl-20 for desktop (side navbar)
        // pb-[72px] for mobile to account for bottom navbar height
        <div className="h-[100dvh] bg-base-200 pl-0 md:pl-20 pb-14 md:pb-0">
            <div className="flex h-full w-full bg-base-100 overflow-hidden">
                {/* Sidebar - Hidden on mobile when chat is selected */}
                {(!isMobile || !selectedUser) && (
                    <div className={isMobile ? 'w-full h-full' : ''}>
                        <Sidebar />
                    </div>
                )}

                {/* Chat Area - Always visible on desktop, conditional on mobile */}
                {(!isMobile || selectedUser) && (
                    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isMobile ? 'w-full' : ''}`}>
                        {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
                    </div>
                )}
            </div>
        </div>
    );
};
export default HomePage;
