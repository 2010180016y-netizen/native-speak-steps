import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Clock, AlertTriangle, Zap, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  userId: string;
}

const FeedbackDashboard = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_feedback")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      setFeedback(data || []);
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-bounce-in text-4xl">💬</div>
      </div>
    );
  }

  // Summary metrics
  const totalFeedback = feedback.length;
  const rated = feedback.filter((f) => f.rating !== null);
  const positiveCount = rated.filter((f) => f.rating === 1).length;
  const negativeCount = rated.filter((f) => f.rating === -1).length;
  const satisfactionRate = rated.length > 0 ? Math.round((positiveCount / rated.length) * 100) : 0;

  const withResponseTime = feedback.filter((f) => f.response_time_ms > 0);
  const avgResponseTime = withResponseTime.length > 0
    ? Math.round(withResponseTime.reduce((s, f) => s + f.response_time_ms, 0) / withResponseTime.length)
    : 0;
  const maxResponseTime = withResponseTime.length > 0
    ? Math.max(...withResponseTime.map((f) => f.response_time_ms))
    : 0;

  const errors = feedback.filter((f) => f.error_type);
  const errorRate = totalFeedback > 0 ? Math.round((errors.length / totalFeedback) * 100) : 0;

  // Response time trend (last 14 days)
  const days14 = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
  const responseTimeTrend = days14.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const dayFeedback = withResponseTime.filter((f) => format(new Date(f.created_at), "yyyy-MM-dd") === key);
    const avg = dayFeedback.length > 0
      ? Math.round(dayFeedback.reduce((s, f) => s + f.response_time_ms, 0) / dayFeedback.length)
      : 0;
    return { label: format(d, "M/d", { locale: ko }), avgMs: avg, count: dayFeedback.length };
  });

  // Error pattern by type
  const errorByType = errors.reduce((acc: Record<string, number>, f) => {
    acc[f.error_type] = (acc[f.error_type] || 0) + 1;
    return acc;
  }, {});
  const errorData = Object.entries(errorByType).map(([name, value]) => ({ name, value }));

  // Rating by feature
  const featureRatings = feedback.reduce((acc: Record<string, { pos: number; neg: number; total: number }>, f) => {
    if (!acc[f.feature]) acc[f.feature] = { pos: 0, neg: 0, total: 0 };
    acc[f.feature].total++;
    if (f.rating === 1) acc[f.feature].pos++;
    if (f.rating === -1) acc[f.feature].neg++;
    return acc;
  }, {});

  const FEATURE_NAMES: Record<string, string> = {
    chat: "회화", speaking: "스피킹", cards: "카드", analysis: "분석",
  };

  const featureData = Object.entries(featureRatings).map(([feature, data]) => ({
    name: FEATURE_NAMES[feature] || feature,
    positive: data.pos,
    negative: data.neg,
    satisfaction: data.pos + data.neg > 0 ? Math.round((data.pos / (data.pos + data.neg)) * 100) : 0,
  }));

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--duo-orange))", "hsl(var(--duo-purple))"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
        <p className="font-bold text-foreground text-xs mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value.toLocaleString()}{p.unit || ""}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid grid-cols-2 gap-3">
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ThumbsUp size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-primary">{satisfactionRate}%</div>
          <div className="text-[10px] text-muted-foreground font-bold">만족도</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock size={16} className="text-duo-blue" />
          </div>
          <div className="text-2xl font-extrabold text-duo-blue">{(avgResponseTime / 1000).toFixed(1)}s</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 응답</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle size={16} className="text-duo-orange" />
          </div>
          <div className="text-2xl font-extrabold text-duo-orange">{errorRate}%</div>
          <div className="text-[10px] text-muted-foreground font-bold">오류율</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap size={16} className="text-duo-purple" />
          </div>
          <div className="text-2xl font-extrabold text-duo-purple">{totalFeedback}</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 요청</div>
        </div>
      </motion.div>

      {/* Response Time Trend */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-duo-blue" />
          <h3 className="font-bold text-foreground">응답 시간 추이 (14일)</h3>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={responseTimeTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} unit="ms" />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avgMs" name="평균 응답(ms)" stroke="hsl(var(--duo-blue))" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Feature Satisfaction */}
      {featureData.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsUp size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">기능별 만족도</h3>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={featureData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={25} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="positive" name="👍 긍정" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="negative" name="👎 부정" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Error Pattern */}
      {errorData.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-duo-orange" />
            <h3 className="font-bold text-foreground">오류 패턴</h3>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={120}>
              <PieChart>
                <Pie data={errorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                  {errorData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {errorData.map((e, idx) => (
                <div key={e.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="text-xs font-bold text-foreground truncate">{e.name}</span>
                  <span className="text-xs text-muted-foreground font-semibold ml-auto">{e.value}건</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Ratings */}
      {rated.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="duo-card">
          <h3 className="font-bold text-foreground mb-3">최근 평가</h3>
          <div className="space-y-2">
            {rated.slice(0, 8).map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {f.rating === 1 ? (
                    <ThumbsUp size={12} className="text-primary" />
                  ) : (
                    <ThumbsDown size={12} className="text-destructive" />
                  )}
                  <span className="font-bold text-foreground">{FEATURE_NAMES[f.feature] || f.feature}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                  <span>{(f.response_time_ms / 1000).toFixed(1)}s</span>
                  <span>{format(new Date(f.created_at), "M/d HH:mm")}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {totalFeedback === 0 && (
        <div className="duo-card text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-bold text-foreground mb-1">아직 데이터가 없어요</p>
          <p className="text-sm text-muted-foreground font-semibold">
            AI 기능을 사용하면 피드백 데이터가 쌓여요
          </p>
        </div>
      )}
    </div>
  );
};

export default FeedbackDashboard;
