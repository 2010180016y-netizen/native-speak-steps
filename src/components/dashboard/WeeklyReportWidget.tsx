import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollText, TrendingUp, Lightbulb, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface WeeklyReport {
  headline: string;
  summary: string;
  insights: { emoji: string; text: string }[];
  tip: string;
  grade: string;
}

interface WeeklyStats {
  activeDays: number;
  xpEarned: number;
  wordsAnalyzed: number;
  wordsLearned: number;
  cardsReviewed: number;
  chatMessages: number;
  studyMinutes: number;
  lessonCount: number;
  avgScore: number;
  totalCards: number;
  masteredCards: number;
}

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  S: { bg: "bg-primary/20", text: "text-primary" },
  A: { bg: "bg-duo-blue/20", text: "text-duo-blue" },
  B: { bg: "bg-secondary/20", text: "text-secondary" },
  C: { bg: "bg-duo-orange/20", text: "text-duo-orange" },
  D: { bg: "bg-muted", text: "text-muted-foreground" },
};

const CACHE_KEY = "weekly_report_cache";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const WeeklyReportWidget = () => {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = async (forceRefresh = false) => {
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_DURATION) {
            setReport(parsed.report);
            setStats(parsed.stats);
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("weekly-report");
      if (error) throw error;

      if (data?.report) {
        setReport(data.report);
        setStats(data.stats);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          report: data.report,
          stats: data.stats,
          timestamp: Date.now(),
        }));
      }
    } catch (err: any) {
      console.error("Weekly report error:", err);
      if (!forceRefresh) {
        setReport({
          headline: "리포트를 불러올 수 없습니다",
          summary: "잠시 후 다시 시도해 주세요.",
          insights: [],
          tip: "꾸준히 학습을 이어가 보세요!",
          grade: "B",
        });
      } else {
        toast.error("리포트 새로고침에 실패했습니다");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="duo-card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText className="text-primary" size={18} />
          <h3 className="font-bold text-foreground">주간 리포트</h3>
        </div>
        <div className="space-y-2">
          <div className="h-6 rounded-lg bg-muted/50 animate-pulse w-3/4" />
          <div className="h-4 rounded-lg bg-muted/50 animate-pulse" />
          <div className="h-4 rounded-lg bg-muted/50 animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const gradeStyle = GRADE_STYLES[report.grade] || GRADE_STYLES.B;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.12 }}
      className="duo-card mb-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ScrollText className="text-primary" size={18} />
          <h3 className="font-bold text-foreground">주간 리포트</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={`text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${gradeStyle.bg} ${gradeStyle.text}`}>
            {report.grade}
          </div>
        </div>
      </div>

      {/* Headline & Summary */}
      <p className="font-extrabold text-foreground text-sm mb-1">{report.headline}</p>
      <p className="text-xs text-muted-foreground font-medium mb-3">{report.summary}</p>

      {/* Quick Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "활동일", value: `${stats.activeDays}일` },
            { label: "XP", value: stats.xpEarned.toLocaleString() },
            { label: "학습시간", value: `${stats.studyMinutes}분` },
            { label: "복습", value: `${stats.cardsReviewed}장` },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30">
              <div className="text-sm font-extrabold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground font-bold">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Expandable Details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-bold text-primary w-full justify-center py-1"
      >
        {expanded ? "접기" : "자세히 보기"}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Insights */}
            {report.insights.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <TrendingUp size={12} />
                  <span>인사이트</span>
                </div>
                {report.insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-foreground font-medium">
                    <span className="flex-shrink-0">{insight.emoji}</span>
                    <span>{insight.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tip */}
            <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
                <Lightbulb size={12} />
                <span>다음 주 팁</span>
              </div>
              <p className="text-xs text-foreground font-medium">{report.tip}</p>
            </div>

            {/* Detailed Stats */}
            {stats && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: "분석한 단어", value: stats.wordsAnalyzed.toLocaleString() },
                  { label: "학습한 단어", value: stats.wordsLearned.toLocaleString() },
                  { label: "대화 메시지", value: `${stats.chatMessages}개` },
                  { label: "레슨 완료", value: `${stats.lessonCount}개` },
                  { label: "평균 점수", value: stats.avgScore > 0 ? `${stats.avgScore}점` : "-" },
                  { label: "마스터 카드", value: `${stats.masteredCards}/${stats.totalCards}` },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between text-xs p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground font-semibold">{s.label}</span>
                    <span className="font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default WeeklyReportWidget;
