import { motion } from "framer-motion";
import { ArrowLeft, Star, BookOpen, MessageCircle, Zap, Lightbulb, Phone, Clock } from "lucide-react";

type FeedbackData = {
  overallScore: number;
  pronunciation: { score: number; comments: string[] };
  grammar: { score: number; errors: { original: string; corrected: string; explanation: string }[] };
  vocabulary: { score: number; comments: string[]; newWordsUsed: string[] };
  fluency: { score: number; comments: string[] };
  tips: string[];
};

type CallInfo = {
  callerName: string;
  gender: "male" | "female";
  occupation: string;
  personality: string;
  scenarioLabel: string;
  scenarioEmoji: string;
  durationSeconds: number;
};

type Props = {
  feedback: FeedbackData;
  onClose: () => void;
  callInfo?: CallInfo;
};

const ScoreRing = ({ score, size = 64 }: { score: number; size?: number }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-400";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round"
          className={`${color} transition-all duration-1000`}
        />
      </svg>
      <span className={`absolute font-extrabold text-sm ${color}`}>{score}</span>
    </div>
  );
};

const ScoreBar = ({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) => {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-bold text-foreground">{label}</span>
          <span className="text-xs font-bold text-muted-foreground">{score}점</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className={`h-full rounded-full ${color}`}
          />
        </div>
      </div>
    </div>
  );
};

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}분 ${sec}초`;
};

const SpeakingFeedback = ({ feedback, onClose, callInfo }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <h2 className="font-extrabold text-foreground text-lg">통화 피드백 📝</h2>
      </div>

      {/* Call Info Card */}
      {callInfo && (
        <div className="duo-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
              <span className="text-2xl">{callInfo.gender === "male" ? "👨" : "👩"}</span>
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-foreground text-base">{callInfo.callerName}</p>
              <p className="text-xs text-muted-foreground font-semibold">{callInfo.occupation} · {callInfo.personality}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs">
              <Phone size={12} className="text-primary" />
              <span className="font-bold text-foreground">{callInfo.scenarioEmoji} {callInfo.scenarioLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Clock size={12} className="text-primary" />
              <span className="font-bold text-foreground">{formatDuration(callInfo.durationSeconds)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Overall score */}
      <div className="duo-card flex items-center gap-4 p-4">
        <ScoreRing score={feedback.overallScore} size={72} />
        <div>
          <div className="font-extrabold text-foreground text-base">종합 점수</div>
          <div className="text-xs text-muted-foreground font-semibold mt-0.5">
            {feedback.overallScore >= 80 ? "훌륭해요! 계속 이렇게 연습하세요 🎉" :
             feedback.overallScore >= 60 ? "잘하고 있어요! 조금만 더 연습하면 돼요 💪" :
             "좋은 시작이에요! 꾸준히 연습해봐요 🌱"}
          </div>
        </div>
      </div>

      {/* Score bars */}
      <div className="duo-card p-4 space-y-3">
        <ScoreBar label="발음" score={feedback.pronunciation.score} icon={<MessageCircle size={16} />} />
        <ScoreBar label="문법" score={feedback.grammar.score} icon={<BookOpen size={16} />} />
        <ScoreBar label="어휘" score={feedback.vocabulary.score} icon={<Star size={16} />} />
        <ScoreBar label="유창성" score={feedback.fluency.score} icon={<Zap size={16} />} />
      </div>

      {/* Grammar errors */}
      {feedback.grammar.errors?.length > 0 && (
        <div className="duo-card p-4">
          <h3 className="font-bold text-foreground text-sm mb-3">📖 문법 교정</h3>
          <div className="space-y-2.5">
            {feedback.grammar.errors.map((err, i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-destructive font-bold line-through shrink-0">{err.original}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-600 font-bold shrink-0">{err.corrected}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-semibold mt-1">{err.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pronunciation & vocabulary comments */}
      {(feedback.pronunciation.comments?.length > 0 || feedback.vocabulary.comments?.length > 0) && (
        <div className="duo-card p-4">
          <h3 className="font-bold text-foreground text-sm mb-3">💬 상세 피드백</h3>
          <div className="space-y-2">
            {[...feedback.pronunciation.comments, ...feedback.vocabulary.comments].map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground font-semibold">• {c}</p>
            ))}
          </div>
        </div>
      )}

      {/* New words */}
      {feedback.vocabulary.newWordsUsed?.length > 0 && (
        <div className="duo-card p-4">
          <h3 className="font-bold text-foreground text-sm mb-2">🆕 사용한 새 단어</h3>
          <div className="flex flex-wrap gap-1.5">
            {feedback.vocabulary.newWordsUsed.map((w, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{w}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {feedback.tips?.length > 0 && (
        <div className="duo-card p-4 border-primary/30">
          <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-1.5">
            <Lightbulb size={16} className="text-primary" /> 학습 팁
          </h3>
          <div className="space-y-2">
            {feedback.tips.map((tip, i) => (
              <p key={i} className="text-xs text-foreground font-semibold">💡 {tip}</p>
            ))}
          </div>
        </div>
      )}

      {/* Back button */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
      >
        시나리오 선택으로 돌아가기
      </button>
    </motion.div>
  );
};

export default SpeakingFeedback;
