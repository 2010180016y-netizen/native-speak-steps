import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Activity, Clock, Target, MessagesSquare, Radar, Heart, BookCheck, Map, ChevronDown, Phone } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfWeek, eachDayOfInterval } from "date-fns";
import { ko } from "date-fns/locale";
import ActivityLogDashboard from "@/components/stats/ActivityLogDashboard";
import TimeBasedDashboard from "@/components/stats/TimeBasedDashboard";
import PerformanceDashboard from "@/components/stats/PerformanceDashboard";
// FeedbackDashboard removed
import ChatScoreDashboard from "@/components/stats/ChatScoreDashboard";
import SyncGapDashboard from "@/components/stats/SyncGapDashboard";
import SrsHealthDashboard from "@/components/stats/SrsHealthDashboard";
import VocabUtilizationDashboard from "@/components/stats/VocabUtilizationDashboard";
import VocabGrowthMap from "@/components/stats/VocabGrowthMap";
import SpeakingScoreDashboard from "@/components/stats/SpeakingScoreDashboard";
import { FEATURES } from "@/lib/features";

type DailyData = {
  date: string;
  label: string;
  nativeWords: number;
  targetWords: number;
  cardsReviewed: number;
  syncRate: number;
};

type TabId = "learning" | "syncgap" | "srshealth" | "vocabutil" | "growthmap" | "activity" | "time" | "performance" | "chat" | "speaking";

type CategoryId = "overview" | "vocabulary" | "activity";

const TAB_GROUPS: { id: CategoryId; label: string; icon: React.ReactNode; tabs: { id: TabId; label: string; icon: React.ReactNode }[] }[] = [
  {
    id: "overview", label: "개요", icon: <BarChart3 size={14} />,
    tabs: [
      { id: "learning", label: "학습", icon: <BarChart3 size={13} /> },
      { id: "performance", label: "성과", icon: <Target size={13} /> },
      { id: "chat", label: "회화", icon: <MessagesSquare size={13} /> },
      { id: "speaking", label: "스피킹", icon: <Phone size={13} /> },
    ],
  },
  {
    id: "vocabulary", label: "어휘", icon: <BookCheck size={14} />,
    tabs: [
      { id: "srshealth", label: "SRS 건강", icon: <Heart size={13} /> },
      { id: "syncgap", label: "동기화 갭", icon: <Radar size={13} /> },
      { id: "vocabutil", label: "활용률", icon: <BookCheck size={13} /> },
      { id: "growthmap", label: "성장맵", icon: <Map size={13} /> },
    ],
  },
  {
    id: "activity", label: "활동", icon: <Activity size={14} />,
    tabs: [
      { id: "activity", label: "활동 로그", icon: <Activity size={13} /> },
      { id: "time", label: "시간 분석", icon: <Clock size={13} /> },
    ],
  },
];

// D1: unless extendedStats is on, only the core-loop views stay visible.
const CORE_STATS_TABS: TabId[] = ["srshealth", "activity"];
const VISIBLE_TAB_GROUPS = TAB_GROUPS
  .map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => FEATURES.extendedStats || CORE_STATS_TABS.includes(tab.id)),
  }))
  .filter((group) => group.tabs.length > 0);

const StatsPage = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [activeTab, setActiveTab] = useState<TabId>(VISIBLE_TAB_GROUPS[0].tabs[0].id);
  const [activeCategory, setActiveCategory] = useState<CategoryId>(VISIBLE_TAB_GROUPS[0].id);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      const daysBack = viewMode === "daily" ? 7 : 28;
      const startDate = subDays(new Date(), daysBack);

      const { data: imports } = await supabase
        .from("language_imports")
        .select("word_count, created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at");

      const { data: cards } = await supabase
        .from("srs_cards")
        .select("review_count, updated_at, created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString());

      const days = eachDayOfInterval({ start: startDate, end: new Date() });
      const buckets: Record<string, { nativeWords: number; cardsCreated: number }> = {};

      days.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        buckets[key] = { nativeWords: 0, cardsCreated: 0 };
      });

      (imports || []).forEach((imp) => {
        const key = format(new Date(imp.created_at), "yyyy-MM-dd");
        if (buckets[key]) buckets[key].nativeWords += imp.word_count;
      });

      (cards || []).forEach((card) => {
        const key = format(new Date(card.created_at), "yyyy-MM-dd");
        if (buckets[key]) buckets[key].cardsCreated += 1;
      });

      if (viewMode === "daily") {
        const result: DailyData[] = days.slice(-7).map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const b = buckets[key] || { nativeWords: 0, cardsCreated: 0 };
          const targetWords = Math.round(b.nativeWords * 0.7);
          return {
            date: key,
            label: format(d, "EEE", { locale: ko }),
            nativeWords: b.nativeWords,
            targetWords,
            cardsReviewed: b.cardsCreated,
            syncRate: b.nativeWords > 0 ? Math.min(Math.round((targetWords / b.nativeWords) * 100), 100) : 0,
          };
        });
        setDailyData(result);
      } else {
        const weeks: DailyData[] = [];
        for (let w = 3; w >= 0; w--) {
          const weekStart = startOfWeek(subDays(new Date(), w * 7), { locale: ko });
          const weekEnd = subDays(weekStart, -6);
          const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd > new Date() ? new Date() : weekEnd });

          let nw = 0;
          let cc = 0;
          weekDays.forEach((d) => {
            const key = format(d, "yyyy-MM-dd");
            if (buckets[key]) {
              nw += buckets[key].nativeWords;
              cc += buckets[key].cardsCreated;
            }
          });

          const tw = Math.round(nw * 0.7);
          weeks.push({
            date: format(weekStart, "yyyy-MM-dd"),
            label: `${format(weekStart, "M/d")}~`,
            nativeWords: nw,
            targetWords: tw,
            cardsReviewed: cc,
            syncRate: nw > 0 ? Math.min(Math.round((tw / nw) * 100), 100) : 0,
          });
        }
        setDailyData(weeks);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, viewMode]);

  const totalNative = dailyData.reduce((s, d) => s + d.nativeWords, 0);
  const totalTarget = dailyData.reduce((s, d) => s + d.targetWords, 0);
  const totalCards = dailyData.reduce((s, d) => s + d.cardsReviewed, 0);
  const avgSync = totalNative > 0 ? Math.min(Math.round((totalTarget / totalNative) * 100), 100) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
        <p className="font-bold text-foreground text-xs mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">학습 통계 📈</h1>
        <p className="text-sm text-muted-foreground font-semibold mb-4">
          학습 진행 상황을 한눈에 확인하세요
        </p>
      </motion.div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-3">
        {VISIBLE_TAB_GROUPS.map((group) => (
          <button
            key={group.id}
            onClick={() => {
              setActiveCategory(group.id);
              setActiveTab(group.tabs[0].id);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeCategory === group.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {group.icon} {group.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      {(() => {
        const group = VISIBLE_TAB_GROUPS.find((g) => g.id === activeCategory)!;
        return group.tabs.length > 1 ? (
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {group.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1 ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        ) : null;
      })()}

      {activeTab === "syncgap" ? (
        user ? <SyncGapDashboard userId={user.id} /> : null
      ) : activeTab === "srshealth" ? (
        user ? <SrsHealthDashboard userId={user.id} /> : null
      ) : activeTab === "vocabutil" ? (
        user ? <VocabUtilizationDashboard userId={user.id} /> : null
      ) : activeTab === "growthmap" ? (
        user ? <VocabGrowthMap userId={user.id} /> : null
      ) : activeTab === "activity" ? (
        user ? <ActivityLogDashboard userId={user.id} /> : null
      ) : activeTab === "time" ? (
        user ? <TimeBasedDashboard userId={user.id} /> : null
      ) : activeTab === "performance" ? (
        user ? <PerformanceDashboard userId={user.id} /> : null
      ) : activeTab === "chat" ? (
        user ? <ChatScoreDashboard userId={user.id} /> : null
      ) : activeTab === "speaking" ? (
        user ? <SpeakingScoreDashboard userId={user.id} /> : null
      ) : (
        <>
          {/* View toggle */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setViewMode("daily")}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
                viewMode === "daily" ? "bg-duo-blue text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              일별 (7일)
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
                viewMode === "weekly" ? "bg-duo-blue text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              주별 (4주)
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-bounce-in text-4xl">📊</div>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-2 gap-3 mb-5">
                <div className="duo-card text-center py-3">
                  <div className="text-2xl font-extrabold text-primary">{totalNative.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground font-bold">모국어 단어</div>
                </div>
                <div className="duo-card text-center py-3">
                  <div className="text-2xl font-extrabold text-duo-blue">{totalTarget.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground font-bold">학습 단어</div>
                </div>
                <div className="duo-card text-center py-3">
                  <div className="text-2xl font-extrabold text-duo-orange">{totalCards}</div>
                  <div className="text-[10px] text-muted-foreground font-bold">생성 카드</div>
                </div>
                <div className="duo-card text-center py-3">
                  <div className="text-2xl font-extrabold text-duo-purple">{avgSync}%</div>
                  <div className="text-[10px] text-muted-foreground font-bold">평균 동기화율</div>
                </div>
              </motion.div>

              {/* Words Chart */}
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={18} className="text-primary" />
                  <h3 className="font-bold text-foreground">단어 분석량</h3>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dailyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={35} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="nativeWords" name="모국어" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="targetWords" name="학습" fill="hsl(var(--duo-blue))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground">모국어</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-duo-blue" />
                    <span className="text-[10px] font-bold text-muted-foreground">학습</span>
                  </div>
                </div>
              </motion.div>

              {/* Sync Rate Chart */}
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-duo-purple" />
                  <h3 className="font-bold text-foreground">동기화율 추이</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="syncGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--duo-purple))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--duo-purple))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="syncRate"
                      name="동기화율"
                      stroke="hsl(var(--duo-purple))"
                      strokeWidth={3}
                      fill="url(#syncGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Cards Created Chart */}
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={18} className="text-duo-orange" />
                  <h3 className="font-bold text-foreground">카드 생성 현황</h3>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cardsReviewed" name="생성 카드" fill="hsl(var(--duo-orange))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </>
          )}
        </>
      )}
    </AppLayout>
  );
};

export default StatsPage;
