import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Target, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Goal {
  id: string;
  goal_type: string;
  target_value: number;
  is_active: boolean;
}

interface GoalProgress {
  goal: Goal;
  current: number;
  percentage: number;
  label: string;
  emoji: string;
  unit: string;
}

const GOAL_META: Record<string, { label: string; emoji: string; unit: string }> = {
  daily_xp: { label: "일일 XP", emoji: "⚡", unit: "XP" },
  daily_cards: { label: "일일 복습", emoji: "📚", unit: "장" },
  daily_minutes: { label: "일일 학습", emoji: "⏱️", unit: "분" },
  daily_chat: { label: "일일 대화", emoji: "💬", unit: "개" },
  weekly_words: { label: "주간 단어", emoji: "📝", unit: "개" },
};

const GoalProgressWidget = () => {
  const { user } = useAuth();
  const [progresses, setProgresses] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchGoalsAndProgress = async () => {
      // Fetch active goals
      const { data: goals } = await supabase
        .from("learning_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (!goals || goals.length === 0) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Fetch today's stats and sessions
      const [statsRes, sessionsRes] = await Promise.all([
        supabase.from("learning_stats").select("*").eq("user_id", user.id).eq("date", today).single(),
        supabase.from("user_sessions").select("duration_seconds").eq("user_id", user.id).gte("started_at", new Date(today).toISOString()),
      ]);

      // Weekly words for weekly goal
      const weeklyStatsRes = await supabase
        .from("learning_stats")
        .select("target_words_learned")
        .eq("user_id", user.id)
        .gte("date", weekAgo.toISOString().split("T")[0]);

      const todayStats = statsRes.data;
      const todayMinutes = Math.round((sessionsRes.data || []).reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60);
      const weeklyWords = (weeklyStatsRes.data || []).reduce((s, r) => s + (r.target_words_learned || 0), 0);

      const results: GoalProgress[] = goals.map((goal: Goal) => {
        const meta = GOAL_META[goal.goal_type] || { label: goal.goal_type, emoji: "🎯", unit: "" };
        let current = 0;

        switch (goal.goal_type) {
          case "daily_xp":
            current = todayStats?.xp_earned || 0;
            break;
          case "daily_cards":
            current = todayStats?.cards_reviewed || 0;
            break;
          case "daily_minutes":
            current = todayMinutes;
            break;
          case "daily_chat":
            current = todayStats?.chat_messages_sent || 0;
            break;
          case "weekly_words":
            current = weeklyWords;
            break;
        }

        return {
          goal,
          current,
          percentage: Math.min(Math.round((current / goal.target_value) * 100), 100),
          label: meta.label,
          emoji: meta.emoji,
          unit: meta.unit,
        };
      });

      setProgresses(results);
      setLoading(false);
    };

    fetchGoalsAndProgress();
  }, [user]);

  if (loading) {
    return (
      <div className="duo-card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="text-primary" size={18} />
          <h3 className="font-bold text-foreground">오늘의 목표</h3>
        </div>
        <div className="h-16 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (progresses.length === 0) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
      >
        <Link to="/profile" className="duo-card mb-4 flex items-center gap-3 p-4 cursor-pointer hover:scale-[1.01] transition-transform">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm text-foreground">학습 목표 설정하기</div>
            <div className="text-xs text-muted-foreground font-semibold">일일/주간 목표를 세워보세요</div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </Link>
      </motion.div>
    );
  }

  const completedCount = progresses.filter(p => p.percentage >= 100).length;
  const allCompleted = completedCount === progresses.length;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.08 }}
      className="duo-card mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="text-primary" size={18} />
          <h3 className="font-bold text-foreground">오늘의 목표</h3>
        </div>
        <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
          allCompleted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {completedCount}/{progresses.length}
        </span>
      </div>

      <div className="space-y-3">
        {progresses.map((p) => (
          <div key={p.goal.id}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{p.emoji}</span>
                <span className="text-xs font-bold text-foreground">{p.label}</span>
              </div>
              <span className={`text-xs font-extrabold ${p.percentage >= 100 ? "text-primary" : "text-muted-foreground"}`}>
                {p.current}/{p.goal.target_value}{p.unit}
                {p.percentage >= 100 && " ✅"}
              </span>
            </div>
            <div className="duo-progress-bar">
              <motion.div
                className={`duo-progress-fill ${p.percentage >= 100 ? "!bg-primary" : ""}`}
                initial={{ width: 0 }}
                animate={{ width: `${p.percentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      {allCompleted && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-3 text-center p-2 rounded-xl bg-primary/5"
        >
          <p className="text-xs font-bold text-primary">🎉 오늘 목표를 모두 달성했어요!</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default GoalProgressWidget;
