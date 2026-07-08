import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Star, ArrowLeft } from "lucide-react";
import { useChatFeaturesStore } from "../store/useChatFeaturesStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { formatMessageTime } from "../lib/utils";
import defaultImg from "../public/avatar.png";

export default function StarredMessagesPage() {
  const navigate = useNavigate();
  const { starredItems, isStarredLoading, loadStarred } = useChatFeaturesStore();
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);
  const setSelectedGroup = useGroupStore((s) => s.setSelectedGroup);
  const users = useChatStore((s) => s.users);
  const groups = useGroupStore((s) => s.groups);

  useEffect(() => {
    loadStarred();
  }, [loadStarred]);

  const openMessage = (item) => {
    try {
      sessionStorage.setItem("scrollToMessageId", item.message._id);
    } catch {
      /* ignore */
    }
    if (item.chatType === "group") {
      const group = groups.find((g) => g._id === item.targetId) || { _id: item.targetId };
      setSelectedUser(null);
      setSelectedGroup(group);
    } else {
      const user = users.find((u) => u._id === item.targetId) || { _id: item.targetId };
      setSelectedGroup(null);
      setSelectedUser(user);
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-base-100 pb-navbar md:pl-20 lg:pl-80">
      <header className="sticky top-0 z-10 bg-base-100/95 backdrop-blur border-b border-base-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-base-200 md:hidden">
          <ArrowLeft size={20} />
        </button>
        <Star className="text-warning" size={22} />
        <h1 className="text-xl font-bold">Starred Messages</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {isStarredLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : starredItems.length === 0 ? (
          <p className="text-center text-base-content/50 py-16">No starred messages yet</p>
        ) : (
          <ul className="space-y-3">
            {[...starredItems].reverse().map((item) => {
              const msg = item.message;
              const sender = msg.senderId?.fullName || "Unknown";
              return (
                <li key={item.starId}>
                  <button
                    type="button"
                    onClick={() => openMessage(item)}
                    className="w-full text-left p-4 rounded-2xl bg-base-200/50 border border-base-300/50 hover:bg-base-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={msg.senderId?.profilePic || defaultImg}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className="font-semibold text-sm">{sender}</span>
                      <span className="text-xs text-base-content/50 ml-auto">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3">
                      {msg.text ||
                        (msg.image ? "📷 Photo" : msg.video ? "🎬 Video" : msg.audio ? "🎤 Voice" : "Attachment")}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
