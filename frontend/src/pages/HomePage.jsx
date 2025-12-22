import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useState, useEffect } from "react";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";

const HomePage = () => {
    const { selectedUser } = useChatStore();
    const { selectedGroup } = useGroupStore();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Determine if any chat (user or group) is selected
    const hasChatSelected = selectedUser || selectedGroup;

    return (
        // Use dvh for dynamic viewport height (works better on mobile Safari)
        // pl-0 for mobile (bottom navbar), pl-20 for desktop (side navbar)
        // pb-[72px] for mobile to account for bottom navbar height
        <div className="h-[100dvh] bg-base-200 pl-0 md:pl-20 pb-14 md:pb-0">
            <div className="flex h-full w-full bg-base-100 overflow-hidden">
                {/* Sidebar - Hidden on mobile when chat is selected */}
                {(!isMobile || !hasChatSelected) && (
                    <div className={isMobile ? 'w-full h-full' : ''}>
                        <Sidebar />
                    </div>
                )}

                {/* Chat Area - Always visible on desktop, conditional on mobile */}
                {(!isMobile || hasChatSelected) && (
                    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isMobile ? 'w-full' : ''}`}>
                        {selectedGroup ? (
                            <GroupChatContainer />
                        ) : selectedUser ? (
                            <ChatContainer />
                        ) : (
                            <NoChatSelected />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default HomePage;

