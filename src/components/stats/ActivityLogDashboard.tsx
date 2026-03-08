import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Users, CheckCircle, Activity, TrendingUp, Calendar } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";

type Props = {
  userId: string;
};

type DailySession = {
  date: string;
  label: string;
  totalMinutes: number;
  sessionCount: number;
};

type LessonStat = {
  type: string;
  count: number;
  avgScore: number;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="font-bold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          {p.dataKey === "totalMinutes" ? "분" : ""}
        </p>
      ))}
    </div>
  );
};

const ActivityLogDashboard = ({ userId }: Props) => {
  const [sessionData, setSessionData] = useState<DailySession[]>([]);
  const [lessonStats, setLessonStats] = useState<LessonStat[]>([]);
  const [dau, setDau] = useState(0);
  const [mau, setMau] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [avgSessionMin, setAvgSessionMin] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchActivityData = async () => {
      setLoading(true);
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const sevenDaysAgo = subDays(now, 7);

      // Fetch sessions (last 30 days)
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", userId)
        .gte("started_at", thirtyDaysAgo.toISOString())
        .order("started_at", { ascending: true });

      // Fetch lesson completions (last 30 days)
      const { data: completions } = await supabase
        .from("lesson_completions")
        .select("*")
        .eq("user_id", userId)
        .gte("completed_at", thirtyDaysAgo.toISOString())
        .order("completed_at", { ascending: true });

      // Calculate DAU (unique days with sessions in last 7 days)
      const recentSessions = (sessions || []).filter(
        (s: any) => new Date(s.started_at) >= sevenDaysAgo
      );
      const uniqueDays7 = new Set(
        recentSessions.map((s: any) => format(new Date(s.started_at), "yyyy-MM-dd"))
      );
      setDau(uniqueDays7.size);

      // Calculate MAU (unique days with sessions in last 30 days)
      const uniqueDays30 = new Set(
        (sessions || []).map((s: any) => format(new Date(s.started_at), "yyyy-MM-dd"))
      );
      setMau(uniqueDays30.size);

      // Total sessions & avg duration
      const allSessions = sessions || [];
      setTotalSessions(allSessions.length);
      const totalDuration = allSessions.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
      setAvgSessionMin(allSessions.length > 0 ? Math.round(totalDuration / allSessions.length / 60) : 0);

      // Build daily session data (last 7 days)
      const days = eachDayOfInterval({ start: sevenDaysAgo, end: now });
      const dailyBuckets: DailySession[] = days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const daySessions = allSessions.filter(
          (s: any) => format(new Date(s.started_at), "yyyy-MM-dd") === key
        );
        const totalMin = Math.round(
          daySessions.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) / 60
        );
        return {
          date: key,
          label: format(d, "EEE", { locale: ko }),
          totalMinutes: totalMin,
          sessionCount: daySessions.length,
        };
      });
      setSessionData(dailyBuckets);

      // Lesson completion stats by type
      const lessonMap: Record<string, { count: number; totalScore: number }> = {};
      (completions || []).forEach((c: any) => {
        if (!lessonMap[c.lesson_type]) {
          lessonMap[c.lesson_type] = { count: 0, totalScore: 0 };
        }
        lessonMap[c.lesson_type].count++;
        lessonMap[c.lesson_type].totalScore += c.score || 0;
      });
      const lessonStatsArr: LessonStat[] = Object.entries(lessonMap).map(([type, data]) => ({
        type,
        count: data.count,
        avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
      }));
      setLessonStats(lessonStatsArr);

      // Completion rate: days with at least one lesson / total active days
      const daysWithLessons = new Set(
        (completions || []).map((c: any) => format(new Date(c.completed_at), "yyyy-MM-dd"))
      );
      const activeDays = uniqueDays30.size;
      setCompletionRate(activeDays > 0 ? Math.round((daysWithLessons.size / activeDays) * 100) : 0);

      setLoading(false);
    };

    fetchActivityData();
  }, [userId]);

  const LESSON_TYPE_LABELS: Record<string, string> = {
    cards: "카드 복습",
    roleplay: "역할 연습",
    speaking: "스피킹",
    chat: "AI 대화",
    import: "텍스트 분석",
    general: "일반",
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-bounce text-3xl">🕐</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Activity Summary Cards */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-3 gap-2">
        <div className="duo-card text-center py-3">
          <div className="flex justify-center mb-1">
            <Calendar size={16} className="text-primary" />
          </div>
          <div className="text-lg font-extrabold text-primary">{dau}/7</div>
          <div className="text-[9px] text-muted-foreground font-bold">주간 활동일</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex justify-center mb-1">
            <Users size={16} className="text-duo-blue" />
          </div>
          <div className="text-lg font-extrabold text-duo-blue">{mau}/30</div>
          <div className="text-[9px] text-muted-foreground font-bold">월간 활동일</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex justify-center mb-1">
            <CheckCircle size={16} className="text-duo-orange" />
          </div>
          <div className="text-lg font-extrabold text-duo-orange">{completionRate}%</div>
          <div className="text-[9px] text-muted-foreground font-bold">레슨 완료율</div>
        </div>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 gap-3">
        <div className="duo-card text-center py-3">
          <div className="flex justify-center mb-1">
            <Activity size={16} className="text-duo-purple" />
          </div>
          <div className="text-xl font-extrabold text-duo-purple">{totalSessions}</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 세션 수 (30일)</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex justify-center mb-1">
            <Clock size={16} className="text-primary" />
          </div>
          <div className="text-xl font-extrabold text-primary">{avgSessionMin}분</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 세션 길이</div>
        </div>
      </motion.div>

      {/* Session Duration Chart */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">일별 학습 시간 (분)</h3>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sessionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="totalMinutes" name="학습 시간" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Session Count Chart */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-duo-blue" />
          <h3 className="font-bold text-foreground">일별 세션 수</h3>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={sessionData}>
            <defs>
              <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--duo-blue))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--duo-blue))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="sessionCount" name="세션 수" stroke="hsl(var(--duo-blue))" strokeWidth={3} fill="url(#sessionGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Lesson Completion by Type */}
      {lessonStats.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-duo-orange" />
            <h3 className="font-bold text-foreground">레슨 유형별 완료 현황</h3>
          </div>
          <div className="space-y-2">
            {lessonStats.map((ls, i) => {
              const maxCount = Math.max(...lessonStats.map((s) => s.count));
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-foreground w-20 truncate">
                    {LESSON_TYPE_LABELS[ls.type] || ls.type}
                  </span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-duo-orange rounded-full transition-all"
                      style={{ width: `${(ls.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-duo-orange w-8 text-right">{ls.count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ActivityLogDashboard;
