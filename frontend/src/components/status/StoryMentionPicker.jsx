import { useState, useMemo, useEffect } from "react";
import { Search, AtSign, Check, X, UserCheck } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";
import { useAuthStore } from "../../store/useAuthStore";

export default function StoryMentionPicker({ selectedMentions = [], onSelectUser, onClose }) {
  const { authUser } = useAuthStore();
  const { users = [], getUsers } = useChatStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!users || users.length === 0) {
      getUsers();
    }
  }, [users, getUsers]);

  // Instant local filtering of friends / users
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return (users || []).filter((u) => u._id !== authUser?._id);

    return (users || []).filter((u) => {
      if (u._id === authUser?._id) return false;
      const nameMatch = u.fullName?.toLowerCase().includes(q);
      const unameMatch = u.username?.toLowerCase().includes(q);
      return nameMatch || unameMatch;
    });
  }, [users, query, authUser]);

  return (
    <div className="absolute inset-x-3 bottom-16 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-2xl animate-[statusSlideUp_0.2s_ease-out] flex flex-col gap-2.5 max-h-[260px]">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <AtSign className="w-4 h-4 text-primary animate-pulse" />
          <span>Mention Friends</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by @username or name..."
          className="w-full bg-zinc-800/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
          autoFocus
        />
      </div>

      {/* Suggestion List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 no-scrollbar scrollbar-none">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-4 text-xs text-zinc-400">
            No friends found matching "{query}"
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isAlreadySelected = selectedMentions.some((m) => m.userId === u._id);
            return (
              <button
                key={u._id}
                type="button"
                disabled={isAlreadySelected}
                onClick={() => onSelectUser(u)}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition ${
                  isAlreadySelected
                    ? "opacity-50 cursor-not-allowed bg-zinc-800/40"
                    : "hover:bg-white/10 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={u.profilePic || "/avatar.png"}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-white truncate">
                      {u.fullName}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      @{u.username || u.fullName?.toLowerCase().replace(/\s+/g, "")}
                    </p>
                  </div>
                </div>

                {isAlreadySelected ? (
                  <span className="flex items-center gap-1 text-[10px] text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10">
                    <Check className="w-3 h-3" /> Added
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                    <AtSign className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
