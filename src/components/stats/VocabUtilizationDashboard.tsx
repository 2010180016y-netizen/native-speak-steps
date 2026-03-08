import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { BookCheck, AlertCircle, CheckCircle2, RefreshCw, TrendingUp, Sparkles, Loader2, X } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

interface Props {
  userId: string;
}

interface SrsCard {
  target_text: string;
  native_text: string;
  ease_factor: number;
  review_count: number;
}

interface UsedWord {
  target_text: string;
  native_text: string;
  usageCount: number;
  mastered: boolean;
}

interface UnusedWord {
  target_text: string;
  native_text: string;
  mastered: boolean;
}

const COLORS = {
  used: "hsl(var(--primary))",
  unused: "hsl(var(--muted))",
  mastered: "hsl(var(--duo-blue))",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="text-xs font-bold text-foreground">
        {payload[0].name}: {payload[0].value}개 ({Math.round(payload[0].payload.percent)}%)
      </p>
    </div>
  );
};

const VocabUtilizationDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [userMessages, setUserMessages] = useState<string[]>([]);
  const [showAllUnused, setShowAllUnused] = useState(false);
  const [selectedWord, setSelectedWord] = useState<UnusedWord | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [examples, setExamples] = useState<string>("");

  const generateExamples = async (word: UnusedWord) => {
    if (selectedWord?.target_text === word.target_text && examples) {
      setSelectedWord(null);
      setExamples("");
      return;
    }
    setSelectedWord(word);
    setExamples("");
    setExampleLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-examples", {
        body: { target_text: word.target_text, native_text: word.native_text },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setExamples(data?.examples || "예문을 생성하지 못했습니다.");
    } catch (err) {
      console.error("Example generation failed:", err);
      toast.error("예문 생성에 실패했습니다");
    } finally {
      setExampleLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cardsRes, messagesRes] = await Promise.all([
        supabase
          .from("srs_cards")
          .select("target_text, native_text, ease_factor, review_count")
          .eq("user_id", userId),
        supabase
          .from("chat_messages")
          .select("content, role")
          .eq("user_id", userId)
          .eq("role", "user"),
      ]);

      setCards(cardsRes.data || []);
      setUserMessages((messagesRes.data || []).map((m) => m.content.toLowerCase()));
    } catch (err) {
      console.error("Failed to fetch vocab data:", err);
      toast.error("데이터를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const { usedWords, unusedWords, utilizationRate } = useMemo(() => {
    if (cards.length === 0) return { usedWords: [], unusedWords: [], utilizationRate: 0 };

    const allText = userMessages.join(" ");
    const used: UsedWord[] = [];
    const unused: UnusedWord[] = [];

    cards.forEach((card) => {
      const target = card.target_text.toLowerCase().trim();
      // Count occurrences across all messages
      let count = 0;
      userMessages.forEach((msg) => {
        // Match whole words or phrases
        const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        const matches = msg.match(regex);
        if (matches) count += matches.length;
      });

      const mastered = card.ease_factor >= 2.5 && card.review_count >= 3;

      if (count > 0) {
        used.push({ target_text: card.target_text, native_text: card.native_text, usageCount: count, mastered });
      } else {
        unused.push({ target_text: card.target_text, native_text: card.native_text, mastered });
      }
    });

    // Sort: most used first
    used.sort((a, b) => b.usageCount - a.usageCount);
    // Sort unused: mastered first (should prioritize using them)
    unused.sort((a, b) => (a.mastered === b.mastered ? 0 : a.mastered ? -1 : 1));

    const rate = cards.length > 0 ? Math.round((used.length / cards.length) * 100) : 0;
    return { usedWords: used, unusedWords: unused, utilizationRate: rate };
  }, [cards, userMessages]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="animate-spin text-4xl">🔍</div>
        <p className="text-sm text-muted-foreground font-semibold">어휘 활용률을 분석하고 있어요...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="duo-card text-center py-8">
        <div className="text-4xl mb-3">📝</div>
        <p className="font-bold text-foreground mb-1">학습 카드가 없어요</p>
        <p className="text-sm text-muted-foreground font-semibold">
          SRS 카드를 먼저 생성하면 회화 속 활용률을 분석할 수 있어요
        </p>
      </div>
    );
  }

  const pieData = [
    { name: "사용한 단어", value: usedWords.length, percent: utilizationRate },
    { name: "미사용 단어", value: unusedWords.length, percent: 100 - utilizationRate },
  ];

  const getCoverageColor = (pct: number) => {
    if (pct >= 60) return "text-primary";
    if (pct >= 30) return "text-duo-orange";
    return "text-destructive";
  };

  const getCoverageBg = (pct: number) => {
    if (pct >= 60) return "bg-primary";
    if (pct >= 30) return "bg-duo-orange";
    return "bg-destructive";
  };

  const displayedUnused = showAllUnused ? unusedWords : unusedWords.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookCheck size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">회화 속 어휘 활용률</h3>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <RefreshCw size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Summary Cards */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-3 gap-2">
        <div className="duo-card text-center py-3">
          <BookCheck size={16} className="mx-auto mb-1 text-primary" />
          <div className={`text-2xl font-extrabold ${getCoverageColor(utilizationRate)}`}>
            {utilizationRate}%
          </div>
          <div className="text-[9px] text-muted-foreground font-bold">활용률</div>
        </div>
        <div className="duo-card text-center py-3">
          <CheckCircle2 size={16} className="mx-auto mb-1 text-duo-blue" />
          <div className="text-2xl font-extrabold text-duo-blue">{usedWords.length}</div>
          <div className="text-[9px] text-muted-foreground font-bold">사용 단어</div>
        </div>
        <div className="duo-card text-center py-3">
          <AlertCircle size={16} className="mx-auto mb-1 text-duo-orange" />
          <div className="text-2xl font-extrabold text-duo-orange">{unusedWords.length}</div>
          <div className="text-[9px] text-muted-foreground font-bold">미사용 단어</div>
        </div>
      </motion.div>

      {/* Coverage Message */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className={`p-3 rounded-xl border ${
          utilizationRate >= 60
            ? "bg-primary/10 border-primary/30"
            : utilizationRate >= 30
            ? "bg-duo-orange/10 border-duo-orange/30"
            : "bg-destructive/10 border-destructive/30"
        }`}
      >
        <p className="text-sm font-bold flex items-center gap-2">
          {utilizationRate >= 60 ? (
            <>
              <TrendingUp size={16} className="text-primary" />
              <span className="text-primary">훌륭해요! 학습한 단어를 회화에서 잘 활용하고 있어요 🎉</span>
            </>
          ) : utilizationRate >= 30 ? (
            <>
              <TrendingUp size={16} className="text-duo-orange" />
              <span className="text-duo-orange">성장 중! 아래 미사용 단어를 대화에 활용해보세요 💪</span>
            </>
          ) : (
            <>
              <AlertCircle size={16} className="text-destructive" />
              <span className="text-destructive">학습한 단어를 회화에서 더 활용해보세요 📚</span>
            </>
          )}
        </p>
      </motion.div>

      {/* Pie Chart */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="duo-card"
      >
        <h3 className="font-bold text-foreground mb-3">활용 비율</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={COLORS.used} />
              <Cell fill={COLORS.unused} />
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 -mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">사용 ({usedWords.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <span className="text-[10px] font-bold text-muted-foreground">미사용 ({unusedWords.length})</span>
          </div>
        </div>
      </motion.div>

      {/* Used Words - Top 10 */}
      {usedWords.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="duo-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">회화에서 사용한 단어 TOP</h3>
          </div>
          <div className="space-y-2">
            {usedWords.slice(0, 10).map((w, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/5">
                <span className="text-xs font-extrabold text-primary w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{w.target_text}</span>
                    {w.mastered && (
                      <span className="text-[9px] font-bold text-duo-blue bg-duo-blue/10 px-1.5 py-0.5 rounded-full">숙달</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-semibold">{w.native_text}</p>
                </div>
                <span className="text-xs font-extrabold text-primary">{w.usageCount}회</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Unused Words */}
      {unusedWords.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="duo-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-duo-orange" />
            <h3 className="font-bold text-foreground">아직 회화에서 안 쓴 단어</h3>
          </div>
          <p className="text-xs text-muted-foreground font-semibold mb-3">
            다음 대화에서 이 단어들을 사용해보세요!
          </p>
           <div className="space-y-2">
            {displayedUnused.map((w, i) => (
              <div key={i}>
                <button
                  onClick={() => generateExamples(w)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                    selectedWord?.target_text === w.target_text ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{w.target_text}</span>
                      {w.mastered && (
                        <span className="text-[9px] font-bold text-duo-blue bg-duo-blue/10 px-1.5 py-0.5 rounded-full">숙달</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-semibold">{w.native_text}</p>
                  </div>
                  <Sparkles size={14} className="text-primary flex-shrink-0" />
                </button>
                <AnimatePresence>
                  {selectedWord?.target_text === w.target_text && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 mt-1 rounded-xl bg-primary/5 border border-primary/20">
                        {exampleLoading ? (
                          <div className="flex items-center gap-2 justify-center py-3">
                            <Loader2 size={16} className="animate-spin text-primary" />
                            <span className="text-xs font-semibold text-muted-foreground">예문 생성 중...</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-primary">✨ AI 예문</span>
                              <button onClick={() => { setSelectedWord(null); setExamples(""); }} className="p-0.5">
                                <X size={12} className="text-muted-foreground" />
                              </button>
                            </div>
                            <p className="text-xs text-foreground font-medium whitespace-pre-line leading-relaxed">
                              {examples}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
          {unusedWords.length > 10 && (
            <button
              onClick={() => setShowAllUnused(!showAllUnused)}
              className="w-full mt-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-xl transition-colors"
            >
              {showAllUnused ? "접기" : `${unusedWords.length - 10}개 더 보기`}
            </button>
          )}
        </motion.div>
      )}

      {/* Overall Progress Bar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="duo-card"
      >
        <h3 className="font-bold text-foreground mb-3">전체 활용 진행률</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {usedWords.length} / {cards.length} 단어 활용
          </span>
          <span className={`text-sm font-extrabold ${getCoverageColor(utilizationRate)}`}>
            {utilizationRate}%
          </span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${getCoverageBg(utilizationRate)}`}
            style={{ width: `${utilizationRate}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default VocabUtilizationDashboard;
