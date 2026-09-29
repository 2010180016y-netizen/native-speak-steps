import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Heart, ShieldCheck, AlertTriangle, BookOpen, Clock, TrendingDown, Brain } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, type TooltipProps,
} from "recharts";
import { format, addDays, differenceInDays, isPast } from "date-fns";
import { ko } from "date-fns/locale";
import { isMastered } from "@/lib/srs";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  userId: string;
}

interface CardHealth {
  id: string;
  nativeText: string;
  targetText: string;
  easeFactor: number;
  reviewCount: number;
  intervalDays: number;
  nextReviewAt: Date;
  status: "new" | "learning" | "mastered" | "overdue";
}

const STATUS_CONFIG = {
  new: { label: "신규", color: "hsl(var(--duo-blue))", emoji: "🆕" },
  learning: { label: "학습 중", color: "hsl(var(--duo-orange))", emoji: "📖" },
  mastered: { label: "숙달", color: "hsl(var(--primary))", emoji: "✅" },
  overdue: { label: "위험", color: "hsl(var(--destructive))", emoji: "⚠️" },
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="font-bold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const classifyCard = (card: Tables<"srs_cards">): CardHealth => {
  const nextReview = new Date(card.next_review_at);
  const now = new Date();
  let status: CardHealth["status"];

  if (card.review_count === 0) {
    status = "new";
  } else if (isMastered(card)) {
    status = isPast(nextReview) ? "overdue" : "mastered";
  } else if (isPast(nextReview) && differenceInDays(now, nextReview) > 2) {
    status = "overdue";
  } else {
    status = "learning";
  }

  return {
    id: card.id,
    nativeText: card.native_text,
    targetText: card.target_text,
    easeFactor: card.ease_factor,
    reviewCount: card.review_count,
    intervalDays: card.interval_days,
    nextReviewAt: nextReview,
    status,
  };
};

const SrsHealthDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardHealth[]>([]);
  const [todayDue, setTodayDue] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [cardsRes, todayStatsRes] = await Promise.all([
        supabase.from("srs_cards").select("*").eq("user_id", userId),
        supabase.from("learning_stats")
          .select("cards_reviewed")
          .eq("user_id", userId)
          .eq("date", format(new Date(), "yyyy-MM-dd"))
          .maybeSingle(),
      ]);

      const allCards = (cardsRes.data || []).map(classifyCard);
      setCards(allCards);

      const now = new Date();
      setTodayDue(allCards.filter(c => isPast(c.nextReviewAt) || differenceInDays(c.nextReviewAt, now) === 0).length);
      setTodayCompleted(todayStatsRes.data?.cards_reviewed || 0);

      setLoading(false);
    };
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-bounce-in text-4xl">💊</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="duo-card text-center py-8">
        <div className="text-4xl mb-3">📚</div>
        <p className="font-bold text-foreground mb-1">SRS 카드가 없어요</p>
        <p className="text-sm text-muted-foreground font-semibold">
          모국어 텍스트를 분석하면 학습 카드가 자동 생성돼요
        </p>
      </div>
    );
  }

  // Status distribution
  const statusCounts = { new: 0, learning: 0, mastered: 0, overdue: 0 };
  cards.forEach(c => statusCounts[c.status]++);

  const pieData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_CONFIG[key as keyof typeof STATUS_CONFIG].label,
      value,
      color: STATUS_CONFIG[key as keyof typeof STATUS_CONFIG].color,
    }));

  const healthScore = cards.length > 0
    ? Math.round(((statusCounts.mastered * 1.0 + statusCounts.learning * 0.5) / cards.length) * 100)
    : 0;

  // Forgetting forecast: how many cards become overdue in the next 7 days
  const now = new Date();
  const forecastDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(now, i);
    const dueCount = cards.filter(c => {
      const diff = differenceInDays(c.nextReviewAt, day);
      return diff === 0 || (diff < 0 && differenceInDays(c.nextReviewAt, addDays(now, i - 1)) >= 0);
    }).length;
    // Cumulative overdue if not reviewed
    const cumulativeOverdue = cards.filter(c => {
      return differenceInDays(c.nextReviewAt, day) <= 0 && c.status !== "new";
    }).length;
    return {
      label: i === 0 ? "오늘" : format(day, "EEE", { locale: ko }),
      due: dueCount,
      cumulativeOverdue,
    };
  });

  // Review completion rate
  const completionRate = todayDue > 0 ? Math.min(Math.round((todayCompleted / todayDue) * 100), 100) : 100;

  // Overdue cards list (worst first)
  const overdueCards = cards
    .filter(c => c.status === "overdue")
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
    .slice(0, 10);

  // Ease factor distribution
  const easeBuckets = [
    { label: "1.3-1.7", min: 1.3, max: 1.7, count: 0 },
    { label: "1.7-2.1", min: 1.7, max: 2.1, count: 0 },
    { label: "2.1-2.5", min: 2.1, max: 2.5, count: 0 },
    { label: "2.5-2.9", min: 2.5, max: 2.9, count: 0 },
    { label: "2.9+", min: 2.9, max: 10, count: 0 },
  ];
  cards.filter(c => c.reviewCount > 0).forEach(c => {
    const bucket = easeBuckets.find(b => c.easeFactor >= b.min && c.easeFactor < b.max);
    if (bucket) bucket.count++;
  });

  const getHealthColor = (score: number) => {
    if (score >= 70) return "text-primary";
    if (score >= 40) return "text-duo-orange";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      {/* Health Score + Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-3 gap-2">
        <div className="duo-card text-center py-3">
          <Heart size={16} className="mx-auto mb-1 text-duo-red" />
          <div className={`text-2xl font-extrabold ${getHealthColor(healthScore)}`}>{healthScore}</div>
          <div className="text-[9px] text-muted-foreground font-bold">건강 점수</div>
        </div>
        <div className="duo-card text-center py-3">
          <BookOpen size={16} className="mx-auto mb-1 text-duo-blue" />
          <div className="text-2xl font-extrabold text-duo-blue">{cards.length}</div>
          <div className="text-[9px] text-muted-foreground font-bold">전체 카드</div>
        </div>
        <div className="duo-card text-center py-3">
          <AlertTriangle size={16} className={`mx-auto mb-1 ${statusCounts.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <div className={`text-2xl font-extrabold ${statusCounts.overdue > 0 ? "text-destructive" : "text-foreground"}`}>
            {statusCounts.overdue}
          </div>
          <div className="text-[9px] text-muted-foreground font-bold">위험 카드</div>
        </div>
      </motion.div>

      {/* Today's Review Status */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="duo-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <span className="font-bold text-sm text-foreground">오늘 복습</span>
          </div>
          <span className={`text-sm font-extrabold ${completionRate >= 100 ? "text-primary" : "text-duo-orange"}`}>
            {todayCompleted}/{todayDue}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completionRate >= 100 ? "bg-primary" : "bg-duo-orange"}`}
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground font-semibold mt-1.5 text-center">
          {completionRate >= 100
            ? "오늘 복습 완료! 🎉"
            : `${todayDue - todayCompleted}개 카드가 복습을 기다리고 있어요`}
        </p>
      </motion.div>

      {/* Card Status Distribution - Pie */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <h3 className="font-bold text-foreground mb-3">카드 상태 분포</h3>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="45%" height={140}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={55}
                innerRadius={30}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{config.emoji}</span>
                  <span className="text-xs font-bold text-foreground">{config.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold" style={{ color: config.color }}>
                    {statusCounts[key as keyof typeof statusCounts]}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    ({cards.length > 0 ? Math.round((statusCounts[key as keyof typeof statusCounts] / cards.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Forgetting Forecast */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={18} className="text-duo-red" />
          <h3 className="font-bold text-foreground">망각 예측 (7일)</h3>
        </div>
        <p className="text-[11px] text-muted-foreground font-semibold mb-3">
          복습하지 않으면 기한 초과되는 카드 수
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={forecastDays}>
            <defs>
              <linearGradient id="overdueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cumulativeOverdue"
              name="누적 위험 카드"
              stroke="hsl(var(--destructive))"
              strokeWidth={2.5}
              fill="url(#overdueGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
        {forecastDays[6]?.cumulativeOverdue > 0 && (
          <div className="mt-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-[11px] font-bold text-destructive">
              ⚠️ 7일 후 복습하지 않으면 {forecastDays[6].cumulativeOverdue}개 카드가 위험 상태가 돼요!
            </p>
          </div>
        )}
      </motion.div>

      {/* Ease Factor Distribution */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={18} className="text-duo-purple" />
          <h3 className="font-bold text-foreground">난이도 분포</h3>
        </div>
        <p className="text-[10px] text-muted-foreground font-semibold mb-3">
          낮을수록 어려운 카드 · 높을수록 쉬운 카드
        </p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={easeBuckets.filter(b => b.count > 0)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="카드 수" radius={[6, 6, 0, 0]}>
              {easeBuckets.filter(b => b.count > 0).map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.min < 2.1 ? "hsl(var(--destructive))" : entry.min < 2.5 ? "hsl(var(--duo-orange))" : "hsl(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Overdue Cards List */}
      {overdueCards.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-destructive" />
            <h3 className="font-bold text-foreground">기한 초과 카드</h3>
          </div>
          <div className="space-y-2">
            {overdueCards.map((card) => {
              const daysOverdue = differenceInDays(now, card.nextReviewAt);
              return (
                <div key={card.id} className="flex items-center justify-between p-2.5 rounded-xl bg-destructive/5 border border-destructive/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{card.nativeText}</p>
                    <p className="text-xs text-muted-foreground font-semibold truncate">{card.targetText}</p>
                  </div>
                  <span className="text-[10px] font-bold text-destructive flex-shrink-0 ml-2">
                    {daysOverdue}일 초과
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Health Tips */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">건강 관리 팁</h3>
        </div>
        <div className="space-y-2">
          {statusCounts.overdue > 0 && (
            <div className="p-2.5 rounded-xl bg-destructive/5">
              <p className="text-[11px] font-semibold text-destructive">
                🚨 {statusCounts.overdue}개의 위험 카드가 있어요. 지금 복습하면 잊기 전에 되살릴 수 있어요!
              </p>
            </div>
          )}
          {statusCounts.new > cards.length * 0.3 && (
            <div className="p-2.5 rounded-xl bg-duo-blue/5">
              <p className="text-[11px] font-semibold text-duo-blue">
                📘 신규 카드 비율이 높아요. 한 번이라도 복습해서 학습 흐름에 올려보세요!
              </p>
            </div>
          )}
          {healthScore >= 70 && (
            <div className="p-2.5 rounded-xl bg-primary/5">
              <p className="text-[11px] font-semibold text-primary">
                ✨ 건강한 SRS 상태! 꾸준히 복습하면 장기 기억으로 전환돼요.
              </p>
            </div>
          )}
          {statusCounts.mastered > 0 && (
            <div className="p-2.5 rounded-xl bg-muted/50">
              <p className="text-[11px] font-semibold text-muted-foreground">
                💡 숙달 카드 {statusCounts.mastered}개! 이 단어들은 대화에서 적극 활용해보세요.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SrsHealthDashboard;
