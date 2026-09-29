import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, BarChart3, MessageSquare, Lightbulb, AlertTriangle, BookOpen, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { Persona, ChatScenario } from "./ChatSetup";

type Message = { role: "user" | "assistant"; content: string };

type FeedbackData = {
  summary: string;
  totalUserMessages: number;
  totalUserWords: number;
  avgWordsPerMessage: number;
  vocabularyRichness: number;
  goodExpressions: { expression: string; reason: string }[];
  improvementAreas: { original: string; suggestion: string; reason: string }[];
  wordFrequency: { word: string; count: number }[];
  sentencePatterns: { pattern: string; count: number; description: string }[];
  overallScore: number;
  tips: string[];
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--duo-blue))",
  "hsl(var(--duo-orange))",
  "hsl(var(--duo-purple))",
  "hsl(var(--duo-red))",
  "hsl(var(--duo-yellow))",
];

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

type Props = {
  messages: Message[];
  persona: Persona;
  scenario: ChatScenario;
  onBack: () => void;
};

const ChatFeedback = ({ messages, persona, scenario, onBack }: Props) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);

  useEffect(() => {
    if (messages.length > 0) analyzeFeedback();
  }, []);

  const analyzeFeedback = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const targetLang = profile?.target_language || "en";
      const nativeLang = profile?.native_language || "ko";

      const { data, error } = await supabase.functions.invoke("chat-feedback", {
        body: {
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          targetLanguage: targetLang,
          nativeLanguage: nativeLang,
          level: profile?.current_level || "beginner",
          persona,
          scenario: scenario.label,
        },
      });

      if (error) throw error;
      setFeedback(data);

      // Save feedback to DB
      await supabase.from("chat_feedback_results" as any).insert({
        user_id: user.id,
        session_id: crypto.randomUUID(),
        overall_score: data.overallScore || 0,
        total_user_messages: data.totalUserMessages || 0,
        total_user_words: data.totalUserWords || 0,
        avg_words_per_message: data.avgWordsPerMessage || 0,
        vocabulary_richness: data.vocabularyRichness || 0,
        good_expressions_count: data.goodExpressions?.length || 0,
        improvement_areas_count: data.improvementAreas?.length || 0,
        persona_gender: persona.gender,
        persona_occupation: persona.occupation,
        scenario_label: scenario.label,
        feedback_data: data,
      });

      // Auto-generate SRS cards from good expressions & improvement areas
      const cardsToCreate: { native_text: string; target_text: string; context: string }[] = [];

      if (data.goodExpressions?.length) {
        for (const g of data.goodExpressions) {
          cardsToCreate.push({
            target_text: g.expression,
            native_text: g.reason,
            context: `✅ 좋은 표현 (${scenario.label})`,
          });
        }
      }

      if (data.improvementAreas?.length) {
        for (const a of data.improvementAreas) {
          cardsToCreate.push({
            target_text: a.suggestion,
            native_text: `${a.original} → ${a.suggestion}`,
            context: `✏️ 개선 표현: ${a.reason}`,
          });
        }
      }

      if (cardsToCreate.length > 0) {
        const { data: existing } = await supabase
          .from("srs_cards")
          .select("target_text")
          .eq("user_id", user.id);
        const existingSet = new Set((existing || []).map((c: any) => c.target_text.toLowerCase()));
        const newCards = cardsToCreate.filter((c) => !existingSet.has(c.target_text.toLowerCase()));

        if (newCards.length > 0) {
          await supabase.from("srs_cards").upsert(
            newCards.map((c) => ({
              user_id: user.id,
              target_text: c.target_text,
              native_text: c.native_text,
              context: c.context,
            })),
            { onConflict: "user_id,native_text", ignoreDuplicates: true },
          );
          toast.success(`📚 ${newCards.length}개의 학습 카드가 자동 생성되었습니다!`);
        }
      }
    } catch (err) {
      console.error("Feedback error:", err);
      toast.error("피드백 분석에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">대화를 분석하고 있습니다...</p>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground font-semibold">분석 결과를 불러올 수 없습니다.</p>
        <button onClick={onBack} className="duo-btn-primary mt-4 px-6 py-2">돌아가기</button>
      </div>
    );
  }

  const topWords = (feedback.wordFrequency || []).slice(0, 12);
  const patterns = feedback.sentencePatterns || [];

  return (
    <div className="space-y-4 pb-6">
      <button
        onClick={onBack}
        className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> 새 대화 시작
      </button>

      {/* Overall Score */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="duo-card text-center py-6">
        <div className="text-5xl font-extrabold text-primary mb-1">{feedback.overallScore}<span className="text-lg text-muted-foreground">/100</span></div>
        <p className="text-sm font-bold text-foreground">대화 종합 점수</p>
        <p className="text-xs text-muted-foreground font-semibold mt-1">
          {scenario.emoji} {scenario.label} · {persona.gender === "male" ? "👨" : "👩"} {persona.occupation}
        </p>
      </motion.div>

      {/* Summary */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="duo-card">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={16} className="text-primary" />
          <h3 className="font-bold text-foreground text-sm">종합 평가</h3>
        </div>
        <p className="text-xs font-semibold text-muted-foreground leading-relaxed">{feedback.summary}</p>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
        {[
          { label: "내 메시지", value: feedback.totalUserMessages, color: "text-primary" },
          { label: "총 단어 수", value: feedback.totalUserWords, color: "text-duo-blue" },
          { label: "평균 단어/메시지", value: feedback.avgWordsPerMessage?.toFixed(1), color: "text-duo-orange" },
          { label: "어휘 다양성", value: `${feedback.vocabularyRichness}%`, color: "text-duo-purple" },
        ].map((s, i) => (
          <div key={i} className="duo-card text-center py-3">
            <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground font-bold">{s.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Good Expressions */}
      {feedback.goodExpressions?.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-duo-yellow" />
            <h3 className="font-bold text-foreground text-sm">좋은 표현 👏</h3>
          </div>
          <div className="space-y-2">
            {feedback.goodExpressions.map((g, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-duo-yellow/5 border border-duo-yellow/20">
                <p className="text-sm font-bold text-foreground">"{g.expression}"</p>
                <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">{g.reason}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Improvement Areas */}
      {feedback.improvementAreas?.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-duo-orange" />
            <h3 className="font-bold text-foreground text-sm">개선이 필요한 표현 ✏️</h3>
          </div>
          <div className="space-y-2">
            {feedback.improvementAreas.map((a, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-duo-orange/5 border border-duo-orange/20">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-destructive line-through">{a.original}</p>
                    <p className="text-sm font-bold text-primary mt-0.5">→ {a.suggestion}</p>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground mt-1">{a.reason}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Word Frequency */}
      {topWords.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-primary" />
            <h3 className="font-bold text-foreground text-sm">사용 단어 빈도</h3>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(160, topWords.length * 24)}>
            <BarChart data={topWords} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="word" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))" }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="횟수" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Sentence Patterns */}
      {patterns.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-duo-purple" />
            <h3 className="font-bold text-foreground text-sm">문장 구조 패턴</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={patterns}
                dataKey="count"
                nameKey="pattern"
                cx="50%"
                cy="50%"
                outerRadius={65}
                innerRadius={30}
                label={({ pattern, percent }) => `${pattern} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={10}
                fontWeight={700}
              >
                {patterns.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {patterns.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="font-bold text-foreground">{p.pattern}</span>
                <span className="text-muted-foreground font-semibold flex-1">{p.description}</span>
                <span className="font-bold text-primary">{p.count}회</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tips */}
      {feedback.tips?.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="duo-card">
          <h3 className="font-bold text-foreground text-sm mb-2">💡 학습 팁</h3>
          <ul className="space-y-1.5">
            {feedback.tips.map((t, i) => (
              <li key={i} className="text-xs font-semibold text-muted-foreground flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <button onClick={onBack} className="duo-btn-primary w-full py-3 font-bold">
        🗣️ 새 대화 시작하기
      </button>
    </div>
  );
};

export default ChatFeedback;
