import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { MessageCircle, TrendingUp, Award, BookOpen } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface Props {
  userId: string;
}

const ChatScoreDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chat_feedback_results" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(100);
      setResults((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-bounce-in text-4xl">💬</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="duo-card text-center py-8">
        <div className="text-4xl mb-3">🗣️</div>
        <p className="font-bold text-foreground mb-1">대화 피드백 데이터가 없어요</p>
        <p className="text-sm text-muted-foreground font-semibold">
          회화 연습 후 피드백을 받으면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  const totalSessions = results.length;
  const avgScore = Math.round(results.reduce((s, r) => s + r.overall_score, 0) / totalSessions);
  const bestScore = Math.max(...results.map((r) => r.overall_score));
  const latestScore = results[results.length - 1]?.overall_score || 0;
  const avgVocab = Math.round(results.reduce((s, r) => s + (r.vocabulary_richness || 0), 0) / totalSessions);

  // Score trend data
  const scoreTrend = results.map((r, i) => ({
    label: `#${i + 1}`,
    score: r.overall_score,
    date: format(new Date(r.created_at), "M/d"),
    scenario: r.scenario_label || "",
  }));

  // Scenario breakdown
  const scenarioMap: Record<string, { count: number; totalScore: number }> = {};
  results.forEach((r) => {
    const key = r.scenario_label || "기타";
    if (!scenarioMap[key]) scenarioMap[key] = { count: 0, totalScore: 0 };
    scenarioMap[key].count++;
    scenarioMap[key].totalScore += r.overall_score;
  });
  const scenarioData = Object.entries(scenarioMap)
    .map(([name, d]) => ({ name, avgScore: Math.round(d.totalScore / d.count), count: d.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Words per message trend
  const wordsTrend = results.map((r, i) => ({
    label: `#${i + 1}`,
    words: Math.round(r.avg_words_per_message * 10) / 10,
    vocab: r.vocabulary_richness || 0,
  }));

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
      {/* Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-2 gap-3">
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <MessageCircle size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-primary">{totalSessions}</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 대화</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp size={16} className="text-duo-blue" />
          </div>
          <div className="text-2xl font-extrabold text-duo-blue">{avgScore}</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 점수</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award size={16} className="text-duo-orange" />
          </div>
          <div className="text-2xl font-extrabold text-duo-orange">{bestScore}</div>
          <div className="text-[10px] text-muted-foreground font-bold">최고 점수</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen size={16} className="text-duo-purple" />
          </div>
          <div className="text-2xl font-extrabold text-duo-purple">{avgVocab}%</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 어휘 다양성</div>
        </div>
      </motion.div>

      {/* Score Trend */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">점수 추이</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={scoreTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="score" name="점수" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Scenario Breakdown */}
      {scenarioData.length > 1 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-duo-orange" />
            <h3 className="font-bold text-foreground">상황별 평균 점수</h3>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(120, scenarioData.length * 28)}>
            <BarChart data={scenarioData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))" }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgScore" name="평균 점수" fill="hsl(var(--duo-orange))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Words Trend */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-duo-purple" />
          <h3 className="font-bold text-foreground">어휘력 변화</h3>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={wordsTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="vocab" name="어휘 다양성(%)" stroke="hsl(var(--duo-purple))" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="words" name="평균 단어/메시지" stroke="hsl(var(--duo-blue))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Recent sessions */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="duo-card">
        <h3 className="font-bold text-foreground mb-3">최근 대화 기록</h3>
        <div className="space-y-2">
          {results.slice(-10).reverse().map((r, i) => (
            <div key={r.id || i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{r.scenario_label || "대화"}</span>
                <span className="text-muted-foreground font-semibold">
                  {r.persona_gender === "male" ? "👨" : "👩"} {r.persona_occupation}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold ${r.overall_score >= 70 ? "text-primary" : r.overall_score >= 50 ? "text-duo-orange" : "text-destructive"}`}>
                  {r.overall_score}점
                </span>
                <span className="text-muted-foreground font-semibold">{format(new Date(r.created_at), "M/d")}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ChatScoreDashboard;
