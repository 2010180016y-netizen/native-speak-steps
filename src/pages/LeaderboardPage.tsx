import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Trophy, Flame, Zap, Crown, Medal, Award, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type LeaderboardEntry = Database["public"]["Functions"]["get_leaderboard"]["Returns"][number];

const LEVEL_SHORT: Record<string, string> = {
  beginner: "A1",
  elementary: "A2",
  intermediate: "B1",
  advanced: "B2",
};

const RANK_STYLES: Record<number, { icon: typeof Crown; color: string; bg: string }> = {
  1: { icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  2: { icon: Medal, color: "text-gray-400", bg: "bg-gray-400/10" },
  3: { icon: Award, color: "text-amber-600", bg: "bg-amber-600/10" },
};

const LeaderboardPage = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"xp" | "streak">("xp");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [leaderboardRes, rankRes] = await Promise.all([
        supabase.rpc("get_leaderboard", { limit_count: 50 }),
        user ? supabase.rpc("get_my_rank") : Promise.resolve({ data: null }),
      ]);

      if (leaderboardRes.data) {
        setEntries(leaderboardRes.data);
      }
      if (rankRes.data !== null) {
        setMyRank(rankRes.data as number);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const sorted = tab === "streak"
    ? [...entries].sort((a, b) => b.streak_days - a.streak_days)
    : entries; // already sorted by XP

  const myEntry = entries.find(e => e.is_me);

  return (
    <AppLayout>
      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/dashboard" className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
            <ArrowLeft size={20} className="text-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="text-primary" size={24} />
            <h1 className="text-2xl font-extrabold text-foreground">리더보드</h1>
          </div>
        </div>

        {/* My Rank Card */}
        {myEntry && myRank && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="duo-card bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl font-extrabold text-primary">
                {myRank}
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-foreground">{myEntry.display_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1"><Zap size={12} className="text-primary" />{myEntry.total_xp} XP</span>
                  <span className="flex items-center gap-1"><Flame size={12} className="text-duo-orange" />{myEntry.streak_days}일 연속</span>
                  <span>{LEVEL_SHORT[myEntry.current_level] || "A1"}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "xp" as const, label: "XP 랭킹", icon: Zap },
            { key: "streak" as const, label: "연속 학습", icon: Flame },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Leaderboard List */}
      {!loading && (
        <div className="space-y-2">
          {sorted.map((entry, idx) => {
            const rank = idx + 1;
            const isMe = entry.is_me;
            const rankStyle = RANK_STYLES[rank];
            const RankIcon = rankStyle?.icon;

            return (
              <motion.div
                key={entry.rank}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isMe ? "bg-primary/5 border border-primary/20" : "bg-card hover:bg-muted/30"
                }`}
              >
                {/* Rank */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  rankStyle ? rankStyle.bg : "bg-muted/50"
                }`}>
                  {RankIcon ? (
                    <RankIcon size={18} className={rankStyle.color} />
                  ) : (
                    <span className="text-sm font-extrabold text-muted-foreground">{rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold flex-shrink-0 ${
                  isMe ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {entry.display_name?.[0]?.toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold text-sm truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                      {entry.display_name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        나
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {LEVEL_SHORT[entry.current_level] || "A1"}
                  </span>
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0">
                  <div className="font-extrabold text-sm text-foreground">
                    {tab === "xp" ? `${entry.total_xp.toLocaleString()} XP` : `${entry.streak_days}일`}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold flex items-center justify-end gap-1">
                    {tab === "xp" ? (
                      <><Flame size={10} className="text-duo-orange" />{entry.streak_days}일</>
                    ) : (
                      <><Zap size={10} className="text-primary" />{entry.total_xp.toLocaleString()}</>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {sorted.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="font-bold text-muted-foreground">아직 랭킹 데이터가 없습니다</p>
              <p className="text-xs text-muted-foreground/70 mt-1">학습을 시작하면 랭킹에 표시됩니다!</p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default LeaderboardPage;
