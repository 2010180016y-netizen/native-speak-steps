import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Phone, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const DashboardSpeakingWidget = () => {
  const { user } = useAuth();
  const [data, setData] = useState<{ avg: number; best: number; count: number; trend: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: sessions } = await supabase
        .from("lesson_completions")
        .select("score, completed_at")
        .eq("user_id", user.id)
        .eq("lesson_type", "speaking")
        .order("completed_at", { ascending: true })
        .limit(20);

      if (!sessions || sessions.length === 0) return;

      const scores = sessions.map(s => s.score || 0);
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const best = Math.max(...scores);
      const recent3 = scores.slice(-3);
      const prev3 = scores.slice(-6, -3);
      const recentAvg = recent3.length ? Math.round(recent3.reduce((a, b) => a + b, 0) / recent3.length) : 0;
      const prevAvg = prev3.length ? Math.round(prev3.reduce((a, b) => a + b, 0) / prev3.length) : 0;

      setData({ avg, best, count: sessions.length, trend: recentAvg - prevAvg });
    };
    fetch();
  }, [user]);

  if (!data) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-400";
  };

  return (
    <Link to="/speaking-history">
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="bg-card rounded-2xl border border-border p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-duo-blue/20 to-duo-purple/10 flex items-center justify-center">
            <Phone size={16} className="text-duo-blue" />
          </div>
          <h3 className="font-bold text-foreground text-sm">스피킹 점수</h3>
          {data.trend !== 0 && (
            <div className={`ml-auto flex items-center gap-0.5 text-[10px] font-bold ${data.trend > 0 ? "text-green-500" : "text-red-400"}`}>
              <TrendingUp size={12} className={data.trend < 0 ? "rotate-180" : ""} />
              {data.trend > 0 ? "+" : ""}{data.trend}
            </div>
          )}
        </div>
        <div className="flex items-end gap-4">
          <div>
            <div className={`text-3xl font-extrabold ${getScoreColor(data.avg)}`}>{data.avg}</div>
            <div className="text-[10px] text-muted-foreground font-bold">평균 점수</div>
          </div>
          <div className="text-right ml-auto">
            <div className="text-lg font-extrabold text-primary">{data.best}</div>
            <div className="text-[10px] text-muted-foreground font-bold">최고</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-duo-blue">{data.count}회</div>
            <div className="text-[10px] text-muted-foreground font-bold">통화</div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default DashboardSpeakingWidget;
