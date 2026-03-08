import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Clock, Star, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface SpeakingSession {
  id: string;
  completed_at: string;
  lesson_type: string;
  score: number | null;
  duration_seconds: number | null;
  metadata: any;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}분 ${sec}초`;
};

const SpeakingHistoryPage = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("*")
        .eq("user_id", user.id)
        .eq("lesson_type", "speaking")
        .order("completed_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setSessions(data);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-400";
  };

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
        <Link to="/speaking" className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors mb-3">
          <ArrowLeft size={14} /> 스피킹으로 돌아가기
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground">통화 히스토리 📞</h1>
        <p className="text-sm text-muted-foreground font-semibold">과거 통화 기록과 점수를 확인하세요</p>
      </motion.div>

      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="animate-spin text-3xl">📞</div>
          <p className="text-sm text-muted-foreground font-semibold">불러오는 중...</p>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-bold text-foreground mb-1">통화 기록이 없어요</p>
          <p className="text-sm text-muted-foreground font-semibold">스피킹 연습을 시작해 보세요</p>
          <Link to="/speaking" className="duo-btn-primary inline-block mt-4 px-6 py-2 text-sm">
            통화 시작하기
          </Link>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session, idx) => {
            const meta = session.metadata || {};
            const scenarioEmoji = meta.scenario_label ? "📞" : "✨";
            const scenarioLabel = meta.scenario_label || "자유 대화";
            const personaName = meta.persona_name || "AI";
            const personaOccupation = meta.persona_occupation || "";

            return (
              <motion.div
                key={session.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-card rounded-2xl border border-border p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {/* Score */}
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg width={48} height={48} className="-rotate-90">
                      <circle cx={24} cy={24} r={20} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
                      <circle
                        cx={24} cy={24} r={20} fill="none"
                        stroke="currentColor"
                        strokeWidth={4}
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={2 * Math.PI * 20 * (1 - (session.score || 0) / 100)}
                        strokeLinecap="round"
                        className={`${getScoreColor(session.score || 0)} transition-all duration-700`}
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center font-extrabold text-xs ${getScoreColor(session.score || 0)}`}>
                      {session.score || 0}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground text-sm">{personaName}</span>
                      {personaOccupation && (
                        <span className="text-[10px] text-muted-foreground font-semibold">· {personaOccupation}</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-primary mt-0.5">
                      {scenarioEmoji} {scenarioLabel}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                        <Clock size={10} />
                        {format(new Date(session.completed_at), "M월 d일 HH:mm", { locale: ko })}
                      </span>
                      {session.duration_seconds != null && (
                        <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                          <Phone size={10} />
                          {formatDuration(session.duration_seconds)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default SpeakingHistoryPage;
