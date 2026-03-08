import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Target, Brain, TrendingUp, Award } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, PieChart, Pie, Cell,
} from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ko } from "date-fns/locale";

type Props = { userId: string };

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--duo-blue))",
  "hsl(var(--duo-orange))",
  "hsl(var(--duo-purple))",
  "hsl(var(--duo-red))",
];

const PerformanceDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [quizScores, setQuizScores] = useState<{ label: string; avgScore: number; count: number }[]>([]);
  const [accuracyByType, setAccuracyByType] = useState<{ name: string; value: number }[]>([]);
  const [wordAcquisition, setWordAcquisition] = useState<{ label: string; newCards: number; mastered: number }[]>([]);
  const [overallStats, setOverallStats] = useState({
    avgScore: 0,
    totalLessons: 0,
    masteryRate: 0,
    activeCards: 0,
    masteredCards: 0,
    accuracyRate: 0,
  });

  useEffect(() => {
    fetchPerformanceData();
  }, [userId]);

  const fetchPerformanceData = async () => {
    setLoading(true);

    const startDate = subDays(new Date(), 30);

    // Fetch lesson completions for quiz scores
    const { data: lessons } = await supabase
      .from("lesson_completions")
      .select("*")
      .eq("user_id", userId)
      .gte("completed_at", startDate.toISOString())
      .order("completed_at");

    // Fetch SRS cards for word acquisition & mastery
    const { data: allCards } = await supabase
      .from("srs_cards")
      .select("*")
      .eq("user_id", userId);

    const { data: recentCards } = await supabase
      .from("srs_cards")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    // === Quiz Scores by Day (last 14 days) ===
    const days14 = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    const scoreBuckets: Record<string, { total: number; count: number }> = {};
    days14.forEach((d) => {
      scoreBuckets[format(d, "yyyy-MM-dd")] = { total: 0, count: 0 };
    });

    (lessons || []).forEach((l) => {
      const key = format(new Date(l.completed_at), "yyyy-MM-dd");
      if (scoreBuckets[key] && l.score !== null) {
        scoreBuckets[key].total += l.score;
        scoreBuckets[key].count += 1;
      }
    });

    setQuizScores(
      days14.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const b = scoreBuckets[key];
        return {
          label: format(d, "M/d", { locale: ko }),
          avgScore: b.count > 0 ? Math.round(b.total / b.count) : 0,
          count: b.count,
        };
      })
    );

    // === Accuracy by Lesson Type ===
    const typeMap: Record<string, { total: number; count: number }> = {};
    (lessons || []).forEach((l) => {
      const type = l.lesson_type || "기타";
      if (!typeMap[type]) typeMap[type] = { total: 0, count: 0 };
      if (l.score !== null) {
        typeMap[type].total += l.score;
        typeMap[type].count += 1;
      }
    });

    const typeLabels: Record<string, string> = {
      cards: "카드 복습",
      speaking: "스피킹",
      chat: "AI 채팅",
      import: "텍스트 분석",
      dialogue: "대화 연습",
    };

    setAccuracyByType(
      Object.entries(typeMap).map(([key, val]) => ({
        name: typeLabels[key] || key,
        value: val.count > 0 ? Math.round(val.total / val.count) : 0,
      }))
    );

    // === Word Acquisition Trend (last 14 days) ===
    const cardBuckets: Record<string, { newCards: number; mastered: number }> = {};
    days14.forEach((d) => {
      cardBuckets[format(d, "yyyy-MM-dd")] = { newCards: 0, mastered: 0 };
    });

    (recentCards || []).forEach((c) => {
      const key = format(new Date(c.created_at), "yyyy-MM-dd");
      if (cardBuckets[key]) cardBuckets[key].newCards += 1;
    });

    // Cards with high ease_factor and multiple reviews = mastered
    (allCards || []).forEach((c) => {
      if (c.review_count >= 3 && c.ease_factor >= 2.5) {
        const key = format(new Date(c.updated_at), "yyyy-MM-dd");
        if (cardBuckets[key]) cardBuckets[key].mastered += 1;
      }
    });

    setWordAcquisition(
      days14.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const b = cardBuckets[key];
        return {
          label: format(d, "M/d", { locale: ko }),
          newCards: b.newCards,
          mastered: b.mastered,
        };
      })
    );

    // === Overall Stats ===
    const totalLessons = (lessons || []).length;
    const scoredLessons = (lessons || []).filter((l) => l.score !== null);
    const avgScore = scoredLessons.length > 0
      ? Math.round(scoredLessons.reduce((s, l) => s + (l.score || 0), 0) / scoredLessons.length)
      : 0;

    const cards = allCards || [];
    const masteredCards = cards.filter((c) => c.review_count >= 3 && c.ease_factor >= 2.5).length;
    const masteryRate = cards.length > 0 ? Math.round((masteredCards / cards.length) * 100) : 0;

    // Accuracy: cards with difficulty >= 4 (user rated "알겠어요") / total reviewed
    const reviewedCards = cards.filter((c) => c.review_count > 0);
    const accurateCards = reviewedCards.filter((c) => c.difficulty >= 4);
    const accuracyRate = reviewedCards.length > 0
      ? Math.round((accurateCards.length / reviewedCards.length) * 100)
      : 0;

    setOverallStats({
      avgScore,
      totalLessons,
      masteryRate,
      activeCards: cards.length,
      masteredCards,
      accuracyRate,
    });

    setLoading(false);
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-bounce-in text-4xl">🎯</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-2 gap-3">
        <div className="duo-card text-center py-3">
          <Target size={18} className="mx-auto text-primary mb-1" />
          <div className="text-2xl font-extrabold text-primary">{overallStats.avgScore}점</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 퀴즈 점수</div>
        </div>
        <div className="duo-card text-center py-3">
          <Brain size={18} className="mx-auto text-duo-blue mb-1" />
          <div className="text-2xl font-extrabold text-duo-blue">{overallStats.accuracyRate}%</div>
          <div className="text-[10px] text-muted-foreground font-bold">정확도</div>
        </div>
        <div className="duo-card text-center py-3">
          <TrendingUp size={18} className="mx-auto text-duo-orange mb-1" />
          <div className="text-2xl font-extrabold text-duo-orange">{overallStats.masteryRate}%</div>
          <div className="text-[10px] text-muted-foreground font-bold">단어 습득률</div>
        </div>
        <div className="duo-card text-center py-3">
          <Award size={18} className="mx-auto text-duo-purple mb-1" />
          <div className="text-2xl font-extrabold text-duo-purple">{overallStats.masteredCards}/{overallStats.activeCards}</div>
          <div className="text-[10px] text-muted-foreground font-bold">숙달 카드</div>
        </div>
      </motion.div>

      {/* Quiz Score Trend */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">퀴즈 점수 추이 (14일)</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={quizScores}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="avgScore"
              name="평균 점수"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Accuracy by Type */}
      {accuracyByType.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={18} className="text-duo-blue" />
            <h3 className="font-bold text-foreground">유형별 정확도</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={accuracyByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="정확도" radius={[0, 6, 6, 0]}>
                {accuracyByType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Word Acquisition Trend */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-duo-orange" />
          <h3 className="font-bold text-foreground">단어 습득 추이 (14일)</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={wordAcquisition} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="newCards" name="신규 카드" fill="hsl(var(--duo-orange))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="mastered" name="숙달 완료" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-duo-orange" />
            <span className="text-[10px] font-bold text-muted-foreground">신규 카드</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">숙달 완료</span>
          </div>
        </div>
      </motion.div>

      {/* Mastery Gauge */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="duo-card">
        <div className="flex items-center gap-2 mb-2">
          <Award size={18} className="text-duo-purple" />
          <h3 className="font-bold text-foreground">단어 숙달 현황</h3>
        </div>
        <div className="flex items-center justify-around">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-foreground">{overallStats.activeCards}</div>
            <div className="text-[10px] text-muted-foreground font-bold">전체 카드</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-primary">{overallStats.masteredCards}</div>
            <div className="text-[10px] text-muted-foreground font-bold">숙달 완료</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-duo-orange">{overallStats.activeCards - overallStats.masteredCards}</div>
            <div className="text-[10px] text-muted-foreground font-bold">학습 중</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="duo-progress-bar">
            <div
              className="duo-progress-fill"
              style={{ width: `${overallStats.masteryRate}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground font-bold text-center mt-1">
            숙달률 {overallStats.masteryRate}%
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PerformanceDashboard;
