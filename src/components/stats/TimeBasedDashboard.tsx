import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Timer, AlertTriangle, RotateCcw, TrendingDown, Zap } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, ScatterChart, Scatter, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, differenceInHours, differenceInDays, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

type Props = { userId: string };

type HourlyData = { hour: string; minutes: number };
type ReviewInterval = { label: string; count: number; avgDays: number };
type DropoffPoint = { day: string; label: string; sessions: number; dropoff: boolean };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="font-bold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const TimeBasedDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [reviewIntervals, setReviewIntervals] = useState<ReviewInterval[]>([]);
  const [dropoffData, setDropoffData] = useState<DropoffPoint[]>([]);
  const [totalStudyMin, setTotalStudyMin] = useState(0);
  const [avgDailyMin, setAvgDailyMin] = useState(0);
  const [peakHour, setPeakHour] = useState("");
  const [avgReviewDays, setAvgReviewDays] = useState(0);
  const [longestGap, setLongestGap] = useState(0);
  const [streakRisk, setStreakRisk] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setLoading(true);
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);

      // Fetch sessions
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", userId)
        .gte("started_at", thirtyDaysAgo.toISOString())
        .order("started_at", { ascending: true });

      // Fetch SRS cards for review intervals
      const { data: cards } = await supabase
        .from("srs_cards")
        .select("interval_days, review_count, next_review_at, updated_at, created_at")
        .eq("user_id", userId)
        .gt("review_count", 0);

      const allSessions = sessions || [];
      const allCards = cards || [];

      // === 1. Hourly study distribution ===
      const hourBuckets: number[] = new Array(24).fill(0);
      allSessions.forEach((s: any) => {
        const h = new Date(s.started_at).getHours();
        hourBuckets[h] += (s.duration_seconds || 0) / 60;
      });
      const hourly: HourlyData[] = hourBuckets.map((min, i) => ({
        hour: `${i}시`,
        minutes: Math.round(min * 10) / 10,
      }));
      setHourlyData(hourly);

      // Peak hour
      const maxMin = Math.max(...hourBuckets);
      const peakIdx = hourBuckets.indexOf(maxMin);
      setPeakHour(maxMin > 0 ? `${peakIdx}시` : "-");

      // === 2. Total & average study time ===
      const totalMin = Math.round(allSessions.reduce((s: number, x: any) => s + (x.duration_seconds || 0), 0) / 60);
      setTotalStudyMin(totalMin);
      const activeDays = new Set(allSessions.map((s: any) => format(new Date(s.started_at), "yyyy-MM-dd"))).size;
      setAvgDailyMin(activeDays > 0 ? Math.round(totalMin / activeDays) : 0);

      // === 3. Review interval distribution ===
      const intervalBuckets: Record<string, { count: number; totalDays: number }> = {
        "1일 이하": { count: 0, totalDays: 0 },
        "2-3일": { count: 0, totalDays: 0 },
        "4-7일": { count: 0, totalDays: 0 },
        "1-2주": { count: 0, totalDays: 0 },
        "2주+": { count: 0, totalDays: 0 },
      };
      let totalInterval = 0;
      let intervalCount = 0;

      allCards.forEach((c: any) => {
        const days = c.interval_days || 0;
        totalInterval += days;
        intervalCount++;
        if (days <= 1) { intervalBuckets["1일 이하"].count++; intervalBuckets["1일 이하"].totalDays += days; }
        else if (days <= 3) { intervalBuckets["2-3일"].count++; intervalBuckets["2-3일"].totalDays += days; }
        else if (days <= 7) { intervalBuckets["4-7일"].count++; intervalBuckets["4-7일"].totalDays += days; }
        else if (days <= 14) { intervalBuckets["1-2주"].count++; intervalBuckets["1-2주"].totalDays += days; }
        else { intervalBuckets["2주+"].count++; intervalBuckets["2주+"].totalDays += days; }
      });

      const intervals: ReviewInterval[] = Object.entries(intervalBuckets).map(([label, d]) => ({
        label,
        count: d.count,
        avgDays: d.count > 0 ? Math.round((d.totalDays / d.count) * 10) / 10 : 0,
      }));
      setReviewIntervals(intervals);
      setAvgReviewDays(intervalCount > 0 ? Math.round((totalInterval / intervalCount) * 10) / 10 : 0);

      // === 4. Dropoff analysis (daily session count, find gaps) ===
      const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });
      const daySessionMap: Record<string, number> = {};
      days.forEach((d) => { daySessionMap[format(d, "yyyy-MM-dd")] = 0; });
      allSessions.forEach((s: any) => {
        const key = format(new Date(s.started_at), "yyyy-MM-dd");
        if (daySessionMap[key] !== undefined) daySessionMap[key]++;
      });

      let maxGap = 0;
      let currentGap = 0;
      const dropoff: DropoffPoint[] = days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const count = daySessionMap[key] || 0;
        if (count === 0) {
          currentGap++;
          maxGap = Math.max(maxGap, currentGap);
        } else {
          currentGap = 0;
        }
        return {
          day: key,
          label: format(d, "M/d", { locale: ko }),
          sessions: count,
          dropoff: count === 0,
        };
      });
      setDropoffData(dropoff);
      setLongestGap(maxGap);

      // Check if user hasn't been active recently (risk)
      const lastActiveDay = [...dropoff].reverse().find((d) => d.sessions > 0);
      if (lastActiveDay) {
        const daysSinceActive = differenceInDays(now, parseISO(lastActiveDay.day));
        setStreakRisk(daysSinceActive >= 3);
      } else {
        setStreakRisk(true);
      }

      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-bounce text-3xl">⏱️</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-3 gap-2">
        <div className="duo-card text-center py-3">
          <Clock size={16} className="mx-auto mb-1 text-primary" />
          <div className="text-lg font-extrabold text-primary">{totalStudyMin}분</div>
          <div className="text-[9px] text-muted-foreground font-bold">총 학습 시간</div>
        </div>
        <div className="duo-card text-center py-3">
          <Timer size={16} className="mx-auto mb-1 text-duo-blue" />
          <div className="text-lg font-extrabold text-duo-blue">{avgDailyMin}분</div>
          <div className="text-[9px] text-muted-foreground font-bold">일 평균</div>
        </div>
        <div className="duo-card text-center py-3">
          <Zap size={16} className="mx-auto mb-1 text-duo-orange" />
          <div className="text-lg font-extrabold text-duo-orange">{peakHour}</div>
          <div className="text-[9px] text-muted-foreground font-bold">피크 시간</div>
        </div>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 gap-3">
        <div className="duo-card text-center py-3">
          <RotateCcw size={16} className="mx-auto mb-1 text-duo-purple" />
          <div className="text-xl font-extrabold text-duo-purple">{avgReviewDays}일</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 복습 주기</div>
        </div>
        <div className={`duo-card text-center py-3 ${streakRisk ? "border-2 border-duo-red" : ""}`}>
          <AlertTriangle size={16} className={`mx-auto mb-1 ${streakRisk ? "text-duo-red" : "text-muted-foreground"}`} />
          <div className={`text-xl font-extrabold ${streakRisk ? "text-duo-red" : "text-foreground"}`}>{longestGap}일</div>
          <div className="text-[10px] text-muted-foreground font-bold">최장 공백</div>
        </div>
      </motion.div>

      {/* Streak risk warning */}
      {streakRisk && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-3 rounded-xl bg-duo-red/10 border border-duo-red/30">
          <p className="text-sm font-bold text-duo-red flex items-center gap-2">
            <AlertTriangle size={16} /> 3일 이상 학습이 없습니다! 오늘 복습해보세요 💪
          </p>
        </motion.div>
      )}

      {/* Hourly study distribution */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">시간대별 학습 분포</h3>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }}
              interval={2}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="minutes" name="학습 시간(분)" radius={[4, 4, 0, 0]}>
              {hourlyData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.hour === peakHour ? "hsl(var(--duo-orange))" : "hsl(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted-foreground font-semibold text-center mt-1">
          🔥 가장 집중하는 시간: <strong className="text-duo-orange">{peakHour}</strong>
        </p>
      </motion.div>

      {/* Review interval distribution */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw size={18} className="text-duo-purple" />
          <h3 className="font-bold text-foreground">복습 주기 분포</h3>
        </div>
        {reviewIntervals.some((r) => r.count > 0) ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={reviewIntervals}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="카드 수" fill="hsl(var(--duo-purple))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5">
              {reviewIntervals.filter((r) => r.count > 0).map((r, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/30">
                  <span className="text-xs font-bold text-foreground">{r.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-muted-foreground">평균 {r.avgDays}일</span>
                    <span className="text-xs font-bold text-duo-purple">{r.count}장</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground font-semibold text-center py-6">
            아직 복습 데이터가 없어요. 카드를 복습하면 분석됩니다! 📚
          </p>
        )}
      </motion.div>

      {/* Dropoff heatmap */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={18} className="text-duo-red" />
          <h3 className="font-bold text-foreground">드롭아웃 분석 (30일)</h3>
        </div>
        <div className="grid grid-cols-10 gap-1 mb-3">
          {dropoffData.map((d, i) => {
            const intensity = d.sessions === 0 ? 0 : Math.min(d.sessions / 3, 1);
            return (
              <div
                key={i}
                className="aspect-square rounded-sm transition-colors relative group"
                style={{
                  backgroundColor: d.sessions === 0
                    ? "hsl(var(--muted))"
                    : `hsl(var(--primary) / ${0.3 + intensity * 0.7})`,
                }}
                title={`${d.label}: ${d.sessions}세션`}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-1.5 py-0.5 text-[9px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {d.label}: {d.sessions}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted" /> 비활동
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--primary) / 0.4)" }} /> 소량
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--primary) / 0.7)" }} /> 보통
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-primary" /> 활발
          </div>
        </div>

        {/* Gap analysis */}
        {longestGap >= 2 && (
          <div className="mt-3 p-2.5 rounded-xl bg-muted/50">
            <p className="text-[11px] font-semibold text-muted-foreground">
              💡 최장 공백 <strong className="text-foreground">{longestGap}일</strong> — 
              {longestGap >= 7
                ? " 일주일 이상 쉬면 학습 효과가 크게 떨어져요. 매일 5분이라도 복습해보세요!"
                : longestGap >= 3
                ? " 3일 이상 쉬면 기억 유지율이 급감해요. 짧게라도 꾸준히!"
                : " 좋은 패턴이에요! 꾸준함을 유지하세요 👍"}
            </p>
          </div>
        )}
      </motion.div>

      {/* Daily session trend */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={18} className="text-duo-blue" />
          <h3 className="font-bold text-foreground">일별 세션 추이</h3>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={dropoffData.slice(-14)}>
            <defs>
              <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--duo-blue))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--duo-blue))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={20} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="sessions" name="세션" stroke="hsl(var(--duo-blue))" strokeWidth={2.5} fill="url(#dropGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default TimeBasedDashboard;
