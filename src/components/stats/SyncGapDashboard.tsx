import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Radar, ShieldAlert, BookOpen, TrendingUp, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import {
  RadarChart, Radar as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { toast } from "sonner";

interface Props {
  userId: string;
}

interface Category {
  name: string;
  emoji: string;
  totalWords: number;
  learnedWords: number;
  masteredWords: number;
  sampleWords: string[];
  coverage?: number;
}

interface UncoveredWord {
  word: string;
  frequency: number;
  reason: string;
}

interface GapData {
  categories: Category[];
  overallCoverage: number;
  totalNativeWords: number;
  totalLearnedWords: number;
  totalMasteredWords: number;
  uncoveredWords: UncoveredWord[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--duo-blue))",
  "hsl(var(--duo-orange))",
  "hsl(var(--duo-purple))",
  "hsl(var(--duo-red))",
  "hsl(var(--secondary))",
  "hsl(var(--duo-green-dark))",
  "hsl(var(--duo-yellow))",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="font-bold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}{p.unit || ""}
        </p>
      ))}
    </div>
  );
};

const SyncGapDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<GapData | null>(null);

  const fetchGapAnalysis = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: result, error } = await supabase.functions.invoke("sync-gap-analysis");
      if (error) throw error;
      if (result) {
        // Add coverage percentage to each category
        const enriched = {
          ...result,
          categories: (result.categories || []).map((c: Category) => ({
            ...c,
            coverage: c.totalWords > 0 ? Math.round((c.learnedWords / c.totalWords) * 100) : 0,
          })),
        };
        setData(enriched);
      }
    } catch (err) {
      console.error("Failed to fetch gap analysis:", err);
      if (isRefresh) toast.error("분석을 새로고침하지 못했습니다");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGapAnalysis();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="animate-spin text-4xl">🔍</div>
        <p className="text-sm text-muted-foreground font-semibold">동기화 갭을 분석하고 있어요...</p>
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="duo-card text-center py-8">
        <div className="text-4xl mb-3">📊</div>
        <p className="font-bold text-foreground mb-1">분석할 데이터가 없어요</p>
        <p className="text-sm text-muted-foreground font-semibold">
          모국어 텍스트를 먼저 가져와 분석하면 동기화 갭을 확인할 수 있어요
        </p>
      </div>
    );
  }

  // Radar chart data
  const radarData = data.categories.map((c) => ({
    subject: `${c.emoji} ${c.name}`,
    coverage: c.coverage || 0,
    fullMark: 100,
  }));

  // Bar chart data (sorted by coverage ascending = weakest first)
  const barData = [...data.categories]
    .sort((a, b) => (a.coverage || 0) - (b.coverage || 0))
    .map((c) => ({
      name: `${c.emoji} ${c.name}`,
      coverage: c.coverage || 0,
      uncovered: 100 - (c.coverage || 0),
      total: c.totalWords,
      learned: c.learnedWords,
    }));

  // Coverage color helper
  const getCoverageColor = (pct: number) => {
    if (pct >= 80) return "text-primary";
    if (pct >= 50) return "text-duo-orange";
    return "text-destructive";
  };

  const getCoverageBg = (pct: number) => {
    if (pct >= 80) return "bg-primary";
    if (pct >= 50) return "bg-duo-orange";
    return "bg-destructive";
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">동기화 갭 분석</h3>
        </div>
        <button
          onClick={() => fetchGapAnalysis(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={`text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Overall Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-3 gap-2">
        <div className="duo-card text-center py-3">
          <ShieldAlert size={16} className="mx-auto mb-1 text-primary" />
          <div className={`text-2xl font-extrabold ${getCoverageColor(data.overallCoverage)}`}>
            {data.overallCoverage}%
          </div>
          <div className="text-[9px] text-muted-foreground font-bold">전체 커버리지</div>
        </div>
        <div className="duo-card text-center py-3">
          <BookOpen size={16} className="mx-auto mb-1 text-duo-blue" />
          <div className="text-2xl font-extrabold text-duo-blue">{data.totalNativeWords}</div>
          <div className="text-[9px] text-muted-foreground font-bold">모국어 어휘</div>
        </div>
        <div className="duo-card text-center py-3">
          <TrendingUp size={16} className="mx-auto mb-1 text-duo-orange" />
          <div className="text-2xl font-extrabold text-duo-orange">{data.totalLearnedWords}</div>
          <div className="text-[9px] text-muted-foreground font-bold">학습 카드</div>
        </div>
      </motion.div>

      {/* Coverage message */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className={`p-3 rounded-xl border ${
          data.overallCoverage >= 70
            ? "bg-primary/10 border-primary/30"
            : data.overallCoverage >= 40
            ? "bg-duo-orange/10 border-duo-orange/30"
            : "bg-destructive/10 border-destructive/30"
        }`}
      >
        <p className="text-sm font-bold flex items-center gap-2">
          {data.overallCoverage >= 70 ? (
            <>
              <Sparkles size={16} className="text-primary" />
              <span className="text-primary">좋은 커버리지! 모국어 표현의 대부분을 학습하고 있어요 🎉</span>
            </>
          ) : data.overallCoverage >= 40 ? (
            <>
              <TrendingUp size={16} className="text-duo-orange" />
              <span className="text-duo-orange">성장 중! 아래 약한 영역을 집중 학습해보세요 💪</span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} className="text-destructive" />
              <span className="text-destructive">갭이 커요! 자주 쓰는 표현부터 차근차근 학습해보세요 📚</span>
            </>
          )}
        </p>
      </motion.div>

      {/* Radar Chart */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="duo-card"
      >
        <h3 className="font-bold text-foreground mb-3">주제별 커버리지 레이더</h3>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickCount={5}
            />
            <RechartsRadar
              name="커버리지"
              dataKey="coverage"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Category Bars (weakest first) */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="duo-card"
      >
        <h3 className="font-bold text-foreground mb-3">카테고리별 학습 커버리지</h3>
        <div className="space-y-3">
          {barData.map((cat, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {cat.learned}/{cat.total}
                  </span>
                  <span className={`text-xs font-extrabold ${getCoverageColor(cat.coverage)}`}>
                    {cat.coverage}%
                  </span>
                </div>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getCoverageBg(cat.coverage)}`}
                  style={{ width: `${cat.coverage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Category Detail Cards */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <h3 className="font-bold text-foreground px-1">카테고리 상세</h3>
        {data.categories.map((cat, i) => (
          <div key={i} className="duo-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.emoji}</span>
                <span className="font-bold text-sm text-foreground">{cat.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-extrabold ${getCoverageColor(cat.coverage || 0)}`}>
                  {cat.coverage}%
                </span>
              </div>
            </div>
            {/* Mini progress */}
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${getCoverageBg(cat.coverage || 0)}`}
                style={{ width: `${cat.coverage}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold mb-2">
              <span>전체 {cat.totalWords}</span>
              <span>학습 {cat.learnedWords}</span>
              <span>숙달 {cat.masteredWords}</span>
            </div>
            {cat.sampleWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cat.sampleWords.map((w, j) => (
                  <span
                    key={j}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground"
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {/* Uncovered Important Words */}
      {data.uncoveredWords.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="duo-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-duo-red" />
            <h3 className="font-bold text-foreground">우선 학습 추천 단어</h3>
          </div>
          <p className="text-xs text-muted-foreground font-semibold mb-3">
            자주 사용하지만 아직 학습하지 않은 단어들이에요
          </p>
          <div className="space-y-2">
            {data.uncoveredWords.map((w, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/30">
                <span className="text-xs font-extrabold text-duo-red w-5 text-right mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{w.word}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{w.frequency}회 사용</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{w.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SyncGapDashboard;
