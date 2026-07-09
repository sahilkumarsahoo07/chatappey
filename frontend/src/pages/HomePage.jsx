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

    const hasChatSelected = !!(selectedUser || selectedGroup);
    // Bottom nav is hidden while a chat is open — no need to reserve pb-14
    const showBottomNavPad = isMobile && !hasChatSelected;

    return (
        // 100svh keeps shell stable when soft keyboard opens (dvh would shrink/jump)
        <div
            className={`h-[100svh] max-h-[100svh] bg-base-200 pl-0 md:pl-20 md:pb-0 overflow-hidden overflow-x-hidden ${
                showBottomNavPad ? "pb-navbar" : "pb-0"
            }`}
        >
            <div className="flex h-full w-full bg-base-100 overflow-hidden min-h-0">
                {(!isMobile || !hasChatSelected) && (
                    <div className={isMobile ? "w-full h-full min-h-0" : ""}>
                        <Sidebar />
                    </div>
                )}

                {(!isMobile || hasChatSelected) && (
                    <div
                        className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden ${
                            isMobile ? "w-full" : ""
                        }`}
                    >
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
