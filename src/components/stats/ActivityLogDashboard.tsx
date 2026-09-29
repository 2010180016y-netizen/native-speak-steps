import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, CheckCircle, Activity, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, differenceInWeeks, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";

type Props = { userId: string };

type DayData = {
  date: Date;
  dateStr: string;
  minutes: number;
  sessions: number;
  level: 0 | 1 | 2 | 3 | 4;
};

const LEVEL_COLORS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
];

const WEEKDAY_LABELS = ["월", "", "수", "", "금", "", ""];

const ActivityLogDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [sessionMap, setSessionMap] = useState<Record<string, { minutes: number; sessions: number }>>({});
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [weeksOffset, setWeeksOffset] = useState(0); // 0 = current, negative = past

  // 12 weeks of data
  const totalWeeks = 12;

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setLoading(true);
      // Fetch last ~6 months of sessions to allow scrolling
      const startDate = subDays(new Date(), 180);
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("started_at, duration_seconds")
        .eq("user_id", userId)
        .gte("started_at", startDate.toISOString())
        .order("started_at", { ascending: true });

      const map: Record<string, { minutes: number; sessions: number }> = {};
      (sessions || []).forEach((s) => {
        const key = format(new Date(s.started_at), "yyyy-MM-dd");
        if (!map[key]) map[key] = { minutes: 0, sessions: 0 };
        map[key].minutes += Math.round((s.duration_seconds || 0) / 60);
        map[key].sessions += 1;
      });
      setSessionMap(map);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  // Build the grid for the visible 12-week window
  const { grid, periodLabel, totalMinutes, activeDays, currentStreak, longestStreak } = useMemo(() => {
    const now = new Date();
    const endDate = endOfWeek(addWeeks(now, weeksOffset), { weekStartsOn: 1 });
    const startDate = startOfWeek(subWeeks(endDate, totalWeeks - 1), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate > now ? now : endDate });

    // Compute level thresholds from data
    const allMinutes = Object.values(sessionMap).map(v => v.minutes).filter(m => m > 0);
    const maxMin = allMinutes.length > 0 ? Math.max(...allMinutes) : 30;
    const thresholds = [0, maxMin * 0.15, maxMin * 0.4, maxMin * 0.7];

    const getLevel = (min: number): 0 | 1 | 2 | 3 | 4 => {
      if (min <= 0) return 0;
      if (min <= thresholds[1]) return 1;
      if (min <= thresholds[2]) return 2;
      if (min <= thresholds[3]) return 3;
      return 4;
    };

    const dayDataList: DayData[] = days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      const s = sessionMap[key] || { minutes: 0, sessions: 0 };
      return { date: d, dateStr: key, minutes: s.minutes, sessions: s.sessions, level: getLevel(s.minutes) };
    });

    // Group into weeks (columns)
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];
    dayDataList.forEach((d, i) => {
      const dayOfWeek = (d.date.getDay() + 6) % 7; // Monday=0
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(d);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Stats
    let totalMin = 0;
    let active = 0;
    dayDataList.forEach(d => {
      totalMin += d.minutes;
      if (d.sessions > 0) active++;
    });

    // Streak calculation (from today backwards across all data)
    let streak = 0;
    let longest = 0;
    let tempStreak = 0;
    const allDays = eachDayOfInterval({ start: subDays(now, 180), end: now }).reverse();
    for (const d of allDays) {
      const key = format(d, "yyyy-MM-dd");
      if (sessionMap[key]?.sessions > 0) {
        tempStreak++;
        if (tempStreak > longest) longest = tempStreak;
        if (streak === 0 || streak === tempStreak - 1) streak = tempStreak;
      } else {
        if (streak > 0 && isSameDay(d, subDays(now, streak))) break;
        tempStreak = 0;
      }
    }

    const label = `${format(startDate, "M월 d일", { locale: ko })} — ${format(endDate > now ? now : endDate, "M월 d일", { locale: ko })}`;

    return { grid: weeks, periodLabel: label, totalMinutes: totalMin, activeDays: active, currentStreak: streak, longestStreak: longest };
  }, [sessionMap, weeksOffset]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-bounce text-3xl">🟩</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-2 gap-2">
        <div className="duo-card text-center py-3">
          <Flame size={16} className="mx-auto mb-1 text-duo-orange" />
          <div className="text-xl font-extrabold text-duo-orange">{currentStreak}일</div>
          <div className="text-[9px] text-muted-foreground font-bold">현재 스트릭</div>
        </div>
        <div className="duo-card text-center py-3">
          <Flame size={16} className="mx-auto mb-1 text-duo-purple" />
          <div className="text-xl font-extrabold text-duo-purple">{longestStreak}일</div>
          <div className="text-[9px] text-muted-foreground font-bold">최장 스트릭</div>
        </div>
        <div className="duo-card text-center py-3">
          <Clock size={16} className="mx-auto mb-1 text-primary" />
          <div className="text-xl font-extrabold text-primary">{totalMinutes}분</div>
          <div className="text-[9px] text-muted-foreground font-bold">총 학습 시간</div>
        </div>
        <div className="duo-card text-center py-3">
          <Calendar size={16} className="mx-auto mb-1 text-duo-blue" />
          <div className="text-xl font-extrabold text-duo-blue">{activeDays}일</div>
          <div className="text-[9px] text-muted-foreground font-bold">활동일</div>
        </div>
      </motion.div>

      {/* Grass Calendar */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeeksOffset(o => o - 4)}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <span className="text-xs font-bold text-foreground">{periodLabel}</span>
          <button
            onClick={() => setWeeksOffset(o => Math.min(o + 4, 0))}
            disabled={weeksOffset >= 0}
            className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex gap-[3px]">
          {/* Weekday labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="w-3 h-3 flex items-center justify-center">
                <span className="text-[8px] font-bold text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Week columns */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {/* Pad the first week if it doesn't start on Monday */}
              {wi === 0 && week.length < 7 &&
                Array.from({ length: 7 - week.length }).map((_, pi) => (
                  <div key={`pad-${pi}`} className="w-3 h-3" />
                ))
              }
              {week.map((day) => (
                <div
                  key={day.dateStr}
                  className={`w-3 h-3 rounded-[2px] cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${LEVEL_COLORS[day.level]}`}
                  onClick={() => setSelectedDay(selectedDay?.dateStr === day.dateStr ? null : day)}
                  title={`${format(day.date, "M/d (EEE)", { locale: ko })}: ${day.minutes}분, ${day.sessions}세션`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[9px] font-semibold text-muted-foreground">적음</span>
          <div className="flex items-center gap-1">
            {LEVEL_COLORS.map((color, i) => (
              <div key={i} className={`w-3 h-3 rounded-[2px] ${color}`} />
            ))}
          </div>
          <span className="text-[9px] font-semibold text-muted-foreground">많음</span>
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-xl bg-muted/50 border border-border"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {format(selectedDay.date, "yyyy년 M월 d일 (EEEE)", { locale: ko })}
              </span>
              <div className={`w-3 h-3 rounded-[2px] ${LEVEL_COLORS[selectedDay.level]}`} />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">{selectedDay.minutes}분</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-duo-blue" />
                <span className="text-xs font-semibold text-foreground">{selectedDay.sessions}세션</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Recent 7 days breakdown */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={18} className="text-duo-blue" />
          <h3 className="font-bold text-foreground">최근 7일</h3>
        </div>
        <div className="space-y-2">
          {eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).reverse().map(d => {
            const key = format(d, "yyyy-MM-dd");
            const s = sessionMap[key] || { minutes: 0, sessions: 0 };
            const isToday = isSameDay(d, new Date());
            return (
              <div key={key} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-14 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {isToday ? "오늘" : format(d, "M/d (EEE)", { locale: ko })}
                </span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min((s.minutes / Math.max(...Object.values(sessionMap).map(v => v.minutes), 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-10 text-right">
                  {s.minutes > 0 ? `${s.minutes}분` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default ActivityLogDashboard;
