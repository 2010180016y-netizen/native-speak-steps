import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, PhoneOff, Target, CheckCircle2, Lightbulb } from "lucide-react";
import type { Persona, ChatScenario } from "@/components/chat/ChatSetup";
import type { SpeakingMessage, Correction } from "@/lib/speakingTypes";
import type { SpeakingMission } from "@/lib/speakingScenarioData";

interface Props {
  persona: Persona;
  callerName: string;
  scenario: ChatScenario;
  messages: SpeakingMessage[];
  isAiLoading: boolean;
  isFeedbackLoading: boolean;
  isListening: boolean;
  isSupported: boolean;
  interimTranscript: string;
  isSpeaking: boolean;
  autoSpeak: boolean;
  callDuration: number;
  missions: SpeakingMission[];
  completedMissions: Set<string>;
  levelHints: string[];
  onMicClick: () => void;
  onEndCall: () => void;
  onReset: () => void;
  onToggleAutoSpeak: () => void;
  onReplayMessage: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const SpeakingCall = ({
  persona, callerName, scenario, messages, isAiLoading, isFeedbackLoading,
  isListening, isSupported, interimTranscript, isSpeaking, autoSpeak,
  callDuration, missions, completedMissions, levelHints,
  onMicClick, onEndCall, onReset, onToggleAutoSpeak, onReplayMessage, messagesEndRef,
}: Props) => {
  return (
    <>
      {/* Call Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
              <span className="text-lg">{persona.gender === "male" ? "👨" : "👩"}</span>
            </div>
            <div>
              <h2 className="font-extrabold text-foreground text-sm">{callerName}</h2>
              <p className="text-[11px] text-muted-foreground font-semibold">
                {persona.occupation} · {scenario.emoji} {scenario.label}
              </p>
              <div className="flex items-center gap-1.5">
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-primary">{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleAutoSpeak} className={`p-2 rounded-xl transition-colors ${autoSpeak ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={onEndCall} disabled={isFeedbackLoading || messages.length < 2} className="p-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-40">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>

      {/* Mini Missions Bar */}
      {missions.length > 0 && !isFeedbackLoading && (
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-3 bg-card rounded-2xl border border-border p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Target size={14} className="text-primary" />
            <span className="text-[11px] font-extrabold text-foreground">통화 미션</span>
            <span className="text-[10px] font-bold text-primary ml-auto">{completedMissions.size}/{missions.length}</span>
          </div>
          <div className="space-y-1.5">
            {missions.map((mission) => {
              const done = completedMissions.has(mission.id);
              return (
                <div key={mission.id} className={`flex items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 transition-colors ${done ? "bg-primary/10" : "bg-muted/50"}`}>
                  {done ? <CheckCircle2 size={13} className="text-primary flex-shrink-0" /> : <div className="w-[13px] h-[13px] rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />}
                  <span className={`font-bold flex-1 ${done ? "text-primary line-through" : "text-foreground"}`}>{mission.title}</span>
                  <span className={`text-[10px] font-bold ${done ? "text-primary" : "text-muted-foreground"}`}>+{mission.xpReward}XP</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Level-based Hints */}
      {levelHints.length > 0 && messages.length <= 2 && !isFeedbackLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 bg-card rounded-2xl border border-dashed border-primary/30 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={14} className="text-primary" />
            <span className="text-[11px] font-extrabold text-foreground">이렇게 말해보세요</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {levelHints.slice(0, 4).map((hint, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{hint}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feedback loading */}
      {isFeedbackLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="duo-card p-6 text-center mb-4">
          <div className="flex justify-center gap-1.5 mb-3">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="w-2.5 h-2.5 rounded-full bg-primary" animate={{ y: [0, -8, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
          <p className="text-sm font-bold text-foreground">통화 내용을 분석하고 있어요... 📝</p>
        </motion.div>
      )}

      {/* Messages */}
      <div className="space-y-3 mb-28 min-h-[40vh]">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border-2 border-border text-foreground rounded-bl-md"}`}>
                <p className="text-sm font-semibold whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && (
                  <button onClick={() => onReplayMessage(msg.content)} className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors">
                    <Volume2 size={12} /> {isSpeaking ? "중지" : "다시 듣기"}
                  </button>
                )}
              </div>

              {msg.role === "assistant" && msg.corrections && msg.corrections.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="max-w-[85%] mt-1.5 space-y-1.5">
                  {msg.corrections.map((c, ci) => (
                    <div key={ci} className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px]">
                      <div className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold mt-px">✏️</span>
                        <div className="flex-1 min-w-0">
                          <span className="line-through text-destructive/70 font-semibold">{c.wrong}</span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="text-primary font-bold">{c.correct}</span>
                          {c.explanation && <p className="text-muted-foreground font-medium mt-0.5">{c.explanation}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isAiLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-card border-2 border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mic Button */}
      <div className="fixed bottom-20 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto px-4">
          <AnimatePresence>
            {(isListening || interimTranscript) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-card border-2 border-primary/30 rounded-2xl px-4 py-2.5 mb-3 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {interimTranscript || <span className="text-muted-foreground">듣고 있어요... 🎧</span>}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onMicClick}
              disabled={isAiLoading || !isSupported || isFeedbackLoading}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40 ${isListening ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
            >
              {isListening ? (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                  <MicOff size={28} />
                </motion.div>
              ) : (
                <Mic size={28} />
              )}
            </motion.button>
          </div>

          {!isListening && !isAiLoading && !isFeedbackLoading && (
            <p className="text-center text-[11px] font-semibold text-muted-foreground mt-2">마이크 버튼을 눌러 말해보세요</p>
          )}
        </div>
      </div>
    </>
  );
};

export default SpeakingCall;
