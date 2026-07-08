import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  Eye,
  Smile,
  MessageCircle,
  X,
  Trash2,
  LayoutDashboard,
  Clock,
  TrendingUp,
} from "lucide-react";
import { formatStatusTime } from "../../hooks/useStoryProgress";
import defaultImg from "../../public/avatar.png";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "views", label: "Views", icon: Eye },
  { id: "likes", label: "Likes", icon: Heart },
  { id: "reactions", label: "Reactions", icon: Smile },
  { id: "comments", label: "Comments", icon: MessageCircle },
];

function resolveUser(userId) {
  if (userId && typeof userId === "object") {
    return {
      _id: userId._id,
      fullName: userId.fullName || "User",
      profilePic: userId.profilePic || "",
    };
  }
  return { _id: userId, fullName: "User", profilePic: "" };
}

function buildAnalytics(viewers, likes, reactions, comments) {
  const breakdown = {};
  if (likes.length) breakdown["❤️"] = likes.length;
  for (const r of reactions) {
    breakdown[r.emoji] = (breakdown[r.emoji] || 0) + 1;
  }
  const breakdownSorted = Object.entries(breakdown)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
  const maxBreakdown = breakdownSorted[0]?.count || 1;

  const activityMap = new Map();
  const bump = (user, score) => {
    if (!user?._id) return;
    const id = String(user._id);
    const prev = activityMap.get(id) || { user, score: 0 };
    prev.score += score;
    activityMap.set(id, prev);
  };
  likes.forEach((l) => bump(l.user, 2));
  reactions.forEach((r) => bump(r.user, 1));
  comments.forEach((c) => bump(resolveUser(c.userId), 1));
  const mostActive = [...activityMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const timeline = [
    ...viewers.map((v) => ({
      key: `v-${v.user._id}-${v.viewedAt}`,
      user: v.user,
      emoji: "👁",
      label: "Viewed",
      at: v.viewedAt,
    })),
    ...likes.map((l) => ({
      key: `l-${l.user._id}-${l.likedAt}`,
      user: l.user,
      emoji: "❤️",
      label: "Liked",
      at: l.likedAt,
    })),
    ...reactions.map((r) => ({
      key: `r-${r.user._id}-${r.reactedAt}-${r.emoji}`,
      user: r.user,
      emoji: r.emoji,
      label: "Reacted",
      at: r.reactedAt,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12);

  const recentViewers = [...viewers]
    .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
    .slice(0, 5);

  return {
    breakdownSorted,
    maxBreakdown,
    mostActive,
    timeline,
    recentViewers,
    totals: {
      views: viewers.length,
      likes: likes.length,
      reactions: reactions.length,
      comments: comments.length,
    },
  };
}

/**
 * Premium status analytics bottom sheet for story owners.
 */
const StatusInsightsSheet = memo(function StatusInsightsSheet({
  open,
  tab,
  onTabChange,
  onClose,
  loading,
  viewers,
  likes,
  reactions,
  comments,
  onDeleteComment,
}) {
  const analytics = useMemo(
    () => buildAnalytics(viewers, likes, reactions, comments),
    [viewers, likes, reactions, comments]
  );

  if (!open) return null;

  const counts = {
    overview: 0,
    views: viewers.length,
    likes: likes.length,
    reactions: reactions.length,
    comments: comments.length,
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-h-[72vh] bg-base-100 text-base-content rounded-t-3xl flex flex-col shadow-2xl pb-[max(12px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-base-200">
          <h3 className="font-bold text-base">Status insights</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-base-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-base-200 px-1 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex-1 min-w-[68px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2.5 text-[11px] sm:text-sm font-semibold border-b-2 transition-colors shrink-0 ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {id !== "overview" && (
                <span className="text-[10px] font-bold opacity-60">({counts[id]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[240px]">
          {loading ? (
            <div className="py-12 flex justify-center">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : tab === "overview" ? (
            <OverviewPanel analytics={analytics} onTabChange={onTabChange} />
          ) : tab === "views" ? (
            viewers.length === 0 ? (
              <EmptyState text="No views yet" />
            ) : (
              <UserList
                items={viewers.map((v) => ({
                  key: v.user._id,
                  user: v.user,
                  sub: formatStatusTime(v.viewedAt),
                  trailing: null,
                }))}
              />
            )
          ) : tab === "likes" ? (
            likes.length === 0 ? (
              <EmptyState text="No likes yet" />
            ) : (
              <UserList
                items={likes.map((l) => ({
                  key: l.user._id,
                  user: l.user,
                  sub: formatStatusTime(l.likedAt),
                  trailing: <span className="text-lg leading-none">❤️</span>,
                }))}
              />
            )
          ) : tab === "reactions" ? (
            reactions.length === 0 ? (
              <EmptyState text="No reactions yet" />
            ) : (
              <UserList
                items={reactions.map((r) => ({
                  key: `${r.user._id}-${r.emoji}`,
                  user: r.user,
                  sub: formatStatusTime(r.reactedAt),
                  trailing: <span className="text-xl leading-none">{r.emoji}</span>,
                }))}
              />
            )
          ) : comments.length === 0 ? (
            <EmptyState text="No comments yet" />
          ) : (
            <CommentsList comments={comments} onDeleteComment={onDeleteComment} />
          )}
        </div>
      </motion.div>
    </div>
  );
});

function OverviewPanel({ analytics, onTabChange }) {
  const { totals, breakdownSorted, maxBreakdown, recentViewers, mostActive, timeline } =
    analytics;

  return (
    <div className="space-y-5 pb-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Views" value={totals.views} onClick={() => onTabChange("views")} />
        <StatCard label="Likes" value={totals.likes} onClick={() => onTabChange("likes")} />
        <StatCard
          label="Reactions"
          value={totals.reactions}
          onClick={() => onTabChange("reactions")}
        />
        <StatCard
          label="Comments"
          value={totals.comments}
          onClick={() => onTabChange("comments")}
        />
      </div>

      {breakdownSorted.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/45 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Reaction breakdown
          </h4>
          <ul className="space-y-2">
            {breakdownSorted.map(({ emoji, count }) => (
              <li key={emoji} className="flex items-center gap-2">
                <span className="text-lg w-7 text-center">{emoji}</span>
                <div className="flex-1 h-2 rounded-full bg-base-200 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxBreakdown) * 100}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums w-6 text-right">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentViewers.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/45 mb-2">
            Recent viewers
          </h4>
          <UserList
            items={recentViewers.map((v) => ({
              key: v.user._id,
              user: v.user,
              sub: formatStatusTime(v.viewedAt),
              trailing: null,
            }))}
          />
        </section>
      )}

      {mostActive.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/45 mb-2">
            Most active
          </h4>
          <ul className="space-y-1">
            {mostActive.map(({ user, score }) => (
              <li key={user._id} className="flex items-center gap-3 py-2">
                <img
                  src={user.profilePic || defaultImg}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
                <span className="flex-1 text-sm font-semibold truncate">{user.fullName}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{score} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/45 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Reaction timeline
          </h4>
          <ul className="space-y-1">
            {timeline.map((item) => (
              <li key={item.key} className="flex items-center gap-3 py-2 border-b border-base-200/50 last:border-0">
                <span className="text-lg w-7 text-center">{item.emoji}</span>
                <img
                  src={item.user.profilePic || defaultImg}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.user.fullName}</p>
                  <p className="text-[11px] text-base-content/45">
                    {item.label} · {formatStatusTime(item.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-base-200/60 hover:bg-base-200 p-3 text-left"
      whileTap={{ scale: 0.97 }}
    >
      <p className="text-[10px] uppercase tracking-wide text-base-content/45 font-bold">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
    </motion.button>
  );
}

function CommentsList({ comments, onDeleteComment }) {
  return (
    <ul className="space-y-1">
      {comments.map((c) => {
        const user = resolveUser(c.userId);
        return (
          <li
            key={c._id}
            className="flex items-start gap-3 py-2.5 px-1 border-b border-base-200/60 last:border-0"
          >
            <img
              src={user.profilePic || defaultImg}
              alt=""
              className="w-11 h-11 rounded-full object-cover ring-1 ring-base-300/50 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">{user.fullName}</p>
                <span className="text-[10px] text-base-content/40 shrink-0">
                  {formatStatusTime(c.createdAt)}
                </span>
              </div>
              <p className="text-sm mt-0.5 break-words leading-relaxed">{c.text}</p>
              {onDeleteComment && (
                <button
                  type="button"
                  onClick={() => onDeleteComment(c._id)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-error/80 hover:text-error"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ text }) {
  return <p className="text-sm text-base-content/50 text-center py-12">{text}</p>;
}

function UserList({ items }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-3 py-2.5 px-1">
          <img
            src={item.user.profilePic || defaultImg}
            alt=""
            className="w-11 h-11 rounded-full object-cover ring-1 ring-base-300/50 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{item.user.fullName || "User"}</p>
            <p className="text-xs text-base-content/45">{item.sub}</p>
          </div>
          {item.trailing}
        </li>
      ))}
    </ul>
  );
}

export default StatusInsightsSheet;
