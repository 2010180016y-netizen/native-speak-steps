import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Phone, TrendingUp, Award, Clock } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  userId: string;
}

interface SessionData {
  id: string;
  completed_at: string;
  score: number | null;
  duration_seconds: number | null;
  metadata: any;
}

const SpeakingScoreDashboard = ({ userId }: Props) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lesson_completions")
        .select("*")
        .eq("user_id", userId)
        .eq("lesson_type", "speaking")
        .order("completed_at", { ascending: true })
        .limit(50);
      setSessions(data || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-bounce-in text-4xl">📞</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📭</div>
        <p className="font-bold text-foreground mb-1">스피킹 기록이 없어요</p>
        <p className="text-sm text-muted-foreground font-semibold">통화 연습을 시작하면 점수 추이가 표시됩니다</p>
      </div>
    );
  }

  // Score trend data
  const scoreData = sessions.map((s, i) => ({
    idx: i + 1,
    label: format(new Date(s.completed_at), "M/d", { locale: ko }),
    score: s.score || 0,
    duration: s.duration_seconds ? Math.round(s.duration_seconds / 60) : 0,
  }));

  // Summary stats
  const scores = sessions.map(s => s.score || 0);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const bestScore = Math.max(...scores);
  const totalCalls = sessions.length;
  const totalMinutes = Math.round(sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0) / 60);

  // Recent 5 vs previous 5 trend
  const recent5 = scores.slice(-5);
  const prev5 = scores.slice(-10, -5);
  const recentAvg = recent5.length ? Math.round(recent5.reduce((a, b) => a + b, 0) / recent5.length) : 0;
  const prevAvg = prev5.length ? Math.round(prev5.reduce((a, b) => a + b, 0) / prev5.length) : 0;
  const trend = recentAvg - prevAvg;

  // Scenario breakdown
  const scenarioMap: Record<string, { count: number; totalScore: number }> = {};
  sessions.forEach(s => {
    const meta = (s.metadata as any) || {};
    const label = meta.scenario_label || "자유 대화";
    if (!scenarioMap[label]) scenarioMap[label] = { count: 0, totalScore: 0 };
    scenarioMap[label].count++;
    scenarioMap[label].totalScore += s.score || 0;
  });
  const scenarioData = Object.entries(scenarioMap).map(([name, v]) => ({
    name: name.length > 6 ? name.slice(0, 6) + "…" : name,
    avg: Math.round(v.totalScore / v.count),
    count: v.count,
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-400";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
        <p className="font-bold text-foreground text-xs mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-2 gap-3">
        <div className="duo-card text-center py-3">
          <div className={`text-2xl font-extrabold ${getScoreColor(avgScore)}`}>{avgScore}</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 점수</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-2xl font-extrabold text-primary">{bestScore}</div>
          <div className="text-[10px] text-muted-foreground font-bold">최고 점수</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-2xl font-extrabold text-duo-blue">{totalCalls}</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 통화 수</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-2xl font-extrabold text-duo-orange">{totalMinutes}분</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 통화 시간</div>
        </div>
      </motion.div>

      {/* Trend indicator */}
      {prev5.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
          className={`duo-card flex items-center gap-3 py-3 ${trend >= 0 ? "border-green-500/30" : "border-red-400/30"}`}>
          <TrendingUp size={20} className={trend >= 0 ? "text-green-500" : "text-red-400 rotate-180"} />
          <div>
            <p className="font-bold text-sm text-foreground">
              최근 5회 평균 <span className={trend >= 0 ? "text-green-500" : "text-red-400"}>{recentAvg}점</span>
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold">
              이전 5회 대비 {trend >= 0 ? "+" : ""}{trend}점 {trend >= 0 ? "📈" : "📉"}
            </p>
          </div>
        </motion.div>
      )}

      {/* Score trend chart */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <Phone size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">점수 추이</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={scoreData}>
            <defs>
              <linearGradient id="speakingScoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="score" name="점수" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#speakingScoreGrad)" dot={{ r: 3, fill: "hsl(var(--primary))" }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Duration chart */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-duo-blue" />
          <h3 className="font-bold text-foreground">통화 시간 (분)</h3>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={scoreData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="duration" name="시간(분)" fill="hsl(var(--duo-blue))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Scenario breakdown */}
      {scenarioData.length > 1 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-duo-orange" />
            <h3 className="font-bold text-foreground">시나리오별 평균 점수</h3>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={scenarioData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" name="평균 점수" fill="hsl(var(--duo-orange))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
};

export default SpeakingScoreDashboard;
