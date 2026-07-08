import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Phone, Video, Mic, Image as ImageIcon, TrendingUp } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import defaultImg from "../public/avatar.png";

export default function InsightsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get("/insights/top-friends");
        setData(res.data);
      } catch {
        setData({ friends: [], weekly: [], monthly: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weeklyMax = Math.max(1, ...(data?.weekly || []).map((d) => d.count));

  return (
    <div className="min-h-screen bg-base-100 pb-navbar md:pl-20">
      <header className="sticky top-0 z-10 bg-base-100/95 backdrop-blur border-b border-base-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-base-200 md:hidden">
          <ArrowLeft size={20} />
        </button>
        <TrendingUp className="text-primary" size={22} />
        <h1 className="text-xl font-bold">Insights</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-base-content/50 mb-3">
                Weekly activity
              </h2>
              <div className="rounded-2xl bg-base-200/60 border border-base-300/40 p-4">
                {(data?.weekly || []).length === 0 ? (
                  <p className="text-sm opacity-50 text-center py-6">No activity this week</p>
                ) : (
                  <div className="flex items-end gap-1.5 h-28">
                    {data.weekly.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full rounded-t-md bg-primary/80 min-h-[4px] transition-all"
                          style={{ height: `${(d.count / weeklyMax) * 100}%` }}
                          title={`${d.count} messages`}
                        />
                        <span className="text-[9px] opacity-40 truncate w-full text-center">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-base-content/50 mb-3">
                Top friends
              </h2>
              {(data?.friends || []).length === 0 ? (
                <p className="text-center text-sm opacity-50 py-8">Chat more to unlock insights</p>
              ) : (
                <ul className="space-y-2">
                  {data.friends.map((f, i) => (
                    <li
                      key={f.user?._id || i}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-base-200/50 border border-base-300/40"
                    >
                      <span className="w-6 text-sm font-bold text-primary/70">{i + 1}</span>
                      <img
                        src={f.user?.profilePic || defaultImg}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{f.user?.fullName}</p>
                        <p className="text-xs opacity-50">
                          {f.messages} msgs · {f.media} media · {f.voice} voice
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{f.score}</p>
                        <p className="text-[10px] opacity-40">score</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: MessageCircle, label: "Most contacted", hint: "Based on chat volume" },
                { icon: Heart, label: "Top reactions", hint: "Coming from engagement" },
                { icon: Phone, label: "Calls", hint: "Boosts relationship score" },
                { icon: ImageIcon, label: "Shared media", hint: "Photos & videos" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-base-300/30"
                >
                  <card.icon className="w-5 h-5 text-primary mb-2" />
                  <p className="font-semibold text-sm">{card.label}</p>
                  <p className="text-[11px] opacity-50 mt-0.5">{card.hint}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
