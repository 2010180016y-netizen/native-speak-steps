import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Map, RefreshCw, TrendingUp, Sprout } from "lucide-react";
import { format, subDays, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ko } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { isMastered } from "@/lib/srs";

interface Props {
  userId: string;
}

interface CardData {
  target_text: string;
  native_text: string;
  context: string | null;
  interval_days: number;
  created_at: string;
}

interface CategoryBubble {
  name: string;
  emoji: string;
  count: number;
  mastered: number;
  recent: number; // added in last 7 days
  words: string[];
}

const CATEGORY_MAP: Record<string, { emoji: string; keywords: string[] }> = {
  "일상": { emoji: "🏠", keywords: ["daily", "everyday", "routine", "morning", "home", "일상", "생활"] },
  "비즈니스": { emoji: "💼", keywords: ["business", "work", "office", "meeting", "회의", "업무", "직장"] },
  "여행": { emoji: "✈️", keywords: ["travel", "trip", "hotel", "airport", "여행", "관광"] },
  "음식": { emoji: "🍽️", keywords: ["food", "eat", "cook", "restaurant", "음식", "요리", "식당"] },
  "감정": { emoji: "💬", keywords: ["feel", "emotion", "happy", "sad", "angry", "감정", "기분"] },
  "학교": { emoji: "📚", keywords: ["school", "study", "class", "learn", "학교", "공부", "수업"] },
  "쇼핑": { emoji: "🛍️", keywords: ["shop", "buy", "price", "store", "쇼핑", "구매", "가격"] },
  "건강": { emoji: "🏥", keywords: ["health", "doctor", "hospital", "sick", "건강", "병원", "의사"] },
  "취미": { emoji: "🎮", keywords: ["hobby", "game", "sport", "music", "취미", "운동", "음악"] },
  "기타": { emoji: "📝", keywords: [] },
};

const BUBBLE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--duo-blue))",
  "hsl(var(--duo-orange))",
  "hsl(var(--duo-purple))",
  "hsl(var(--duo-red))",
  "hsl(var(--secondary))",
  "hsl(var(--duo-green-dark))",
  "hsl(var(--duo-yellow))",
  "hsl(var(--primary))",
  "hsl(var(--duo-blue))",
];

const BG_COLORS = [
  "bg-primary/15",
  "bg-duo-blue/15",
  "bg-duo-orange/15",
  "bg-duo-purple/15",
  "bg-destructive/15",
  "bg-secondary/15",
  "bg-primary/10",
  "bg-duo-orange/10",
  "bg-duo-blue/10",
  "bg-duo-purple/10",
];

const TEXT_COLORS = [
  "text-primary",
  "text-duo-blue",
  "text-duo-orange",
  "text-duo-purple",
  "text-destructive",
  "text-secondary-foreground",
  "text-primary",
  "text-duo-orange",
  "text-duo-blue",
  "text-duo-purple",
];

function categorizeCard(card: CardData): string {
  const text = `${card.target_text} ${card.native_text} ${card.context || ""}`.toLowerCase();
  for (const [cat, { keywords }] of Object.entries(CATEGORY_MAP)) {
    if (cat === "기타") continue;
    if (keywords.some((kw) => text.includes(kw))) return cat;
  }
  return "기타";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="font-bold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}개
        </p>
      ))}
    </div>
  );
};

const VocabGrowthMap = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("srs_cards")
        .select("target_text, native_text, context, interval_days, created_at")
        .eq("user_id", userId)
        .order("created_at");
      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error("Failed to fetch cards:", err);
      toast.error("데이터를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const categories = useMemo(() => {
    const catMap: Record<string, { count: number; mastered: number; recent: number; words: string[] }> = {};
    const sevenDaysAgo = subDays(new Date(), 7);

    cards.forEach((card) => {
      const cat = categorizeCard(card);
      if (!catMap[cat]) catMap[cat] = { count: 0, mastered: 0, recent: 0, words: [] };
      catMap[cat].count++;
      if (isMastered(card)) catMap[cat].mastered++;
      if (new Date(card.created_at) >= sevenDaysAgo) catMap[cat].recent++;
      if (catMap[cat].words.length < 8) catMap[cat].words.push(card.target_text);
    });

    return Object.entries(catMap)
      .map(([name, data]) => ({
        name,
        emoji: CATEGORY_MAP[name]?.emoji || "📝",
        ...data,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cards]);

  // Weekly growth timeline (last 8 weeks)
  const weeklyGrowth = useMemo(() => {
    if (cards.length === 0) return [];
    const start = subDays(new Date(), 56);
    const weeks = eachWeekOfInterval({ start, end: new Date() }, { locale: ko });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { locale: ko });
      const count = cards.filter((c) =>
        isWithinInterval(new Date(c.created_at), { start: weekStart, end: weekEnd > new Date() ? new Date() : weekEnd })
      ).length;
      const cumulative = cards.filter((c) => new Date(c.created_at) <= weekEnd).length;
      return {
        label: format(weekStart, "M/d", { locale: ko }),
        new: count,
        total: cumulative,
      };
    });
  }, [cards]);

  const maxCount = Math.max(...categories.map((c) => c.count), 1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="animate-spin text-4xl">🌱</div>
        <p className="text-sm text-muted-foreground font-semibold">어휘 성장 맵을 그리고 있어요...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="duo-card text-center py-8">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="font-bold text-foreground mb-1">어휘 데이터가 없어요</p>
        <p className="text-sm text-muted-foreground font-semibold">
          SRS 카드를 생성하면 어휘 성장 맵을 볼 수 있어요
        </p>
      </div>
    );
  }

  const totalRecent = categories.reduce((s, c) => s + c.recent, 0);
  const totalMastered = categories.reduce((s, c) => s + c.mastered, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">어휘 성장 맵</h3>
        </div>
        <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
          <RefreshCw size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-3 gap-2">
        <div className="duo-card text-center py-3">
          <Map size={16} className="mx-auto mb-1 text-primary" />
          <div className="text-2xl font-extrabold text-primary">{cards.length}</div>
          <div className="text-[9px] text-muted-foreground font-bold">전체 어휘</div>
        </div>
        <div className="duo-card text-center py-3">
          <Sprout size={16} className="mx-auto mb-1 text-duo-blue" />
          <div className="text-2xl font-extrabold text-duo-blue">+{totalRecent}</div>
          <div className="text-[9px] text-muted-foreground font-bold">이번 주 신규</div>
        </div>
        <div className="duo-card text-center py-3">
          <TrendingUp size={16} className="mx-auto mb-1 text-duo-orange" />
          <div className="text-2xl font-extrabold text-duo-orange">{totalMastered}</div>
          <div className="text-[9px] text-muted-foreground font-bold">숙달 어휘</div>
        </div>
      </motion.div>

      {/* Bubble Map */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="duo-card"
      >
        <h3 className="font-bold text-foreground mb-4">카테고리별 어휘 버블</h3>
        <div className="flex flex-wrap gap-3 justify-center py-2">
          {categories.map((cat, i) => {
            const sizePct = Math.max(0.45, cat.count / maxCount);
            const size = Math.round(60 + sizePct * 60);
            const isSelected = selectedCat === cat.name;

            return (
              <motion.button
                key={cat.name}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
                onClick={() => setSelectedCat(isSelected ? null : cat.name)}
                className={`rounded-full flex flex-col items-center justify-center transition-all ${BG_COLORS[i % BG_COLORS.length]} ${
                  isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ width: size, height: size }}
              >
                <span className="text-lg leading-none">{cat.emoji}</span>
                <span className={`text-[9px] font-extrabold ${TEXT_COLORS[i % TEXT_COLORS.length]} leading-tight`}>
                  {cat.count}
                </span>
              </motion.button>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {categories.map((cat, i) => (
            <span key={cat.name} className="text-[10px] font-semibold text-muted-foreground">
              {cat.emoji} {cat.name}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Selected Category Detail */}
      {selectedCat && (() => {
        const cat = categories.find((c) => c.name === selectedCat);
        if (!cat) return null;
        const catIdx = categories.indexOf(cat);
        return (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="duo-card"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{cat.emoji}</span>
              <h3 className="font-bold text-foreground">{cat.name}</h3>
              <span className={`text-xs font-extrabold ${TEXT_COLORS[catIdx % TEXT_COLORS.length]}`}>
                {cat.count}개
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold mb-3">
              <span>숙달 {cat.mastered}</span>
              <span>이번 주 +{cat.recent}</span>
            </div>
            {/* Mini progress */}
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${cat.count > 0 ? Math.round((cat.mastered / cat.count) * 100) : 0}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.words.map((w, j) => (
                <span key={j} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                  {w}
                </span>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Category Bars */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="duo-card"
      >
        <h3 className="font-bold text-foreground mb-3">카테고리별 분포</h3>
        <div className="space-y-3">
          {categories.map((cat, i) => {
            const pct = Math.round((cat.count / cards.length) * 100);
            return (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-foreground">{cat.emoji} {cat.name}</span>
                  <div className="flex items-center gap-2">
                    {cat.recent > 0 && (
                      <span className="text-[10px] font-bold text-duo-blue">+{cat.recent}</span>
                    )}
                    <span className="text-xs font-extrabold text-foreground">{cat.count}개</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{pct}%</span>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: BUBBLE_COLORS[i % BUBBLE_COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Growth Timeline */}
      {weeklyGrowth.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="duo-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-duo-purple" />
            <h3 className="font-bold text-foreground">어휘 성장 추이 (8주)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyGrowth}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="누적 어휘"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#growthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
};

export default VocabGrowthMap;
