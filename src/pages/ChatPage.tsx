import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ThumbsUp, ThumbsDown, Clock, Flag, Target, CheckCircle2, History, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import ChatSetup, { type Persona, type ChatScenario } from "@/components/chat/ChatSetup";
import ChatFeedback from "@/components/chat/ChatFeedback";
import { SCENARIO_STARTERS, SCENARIO_MISSIONS, DEFAULT_MISSIONS, type MiniMission } from "@/lib/chatScenarioData";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

const LANG_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語", zh: "中文",
  es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
};

type Message = {
  role: "user" | "assistant";
  content: string;
  responseTimeMs?: number;
  feedbackId?: string;
  rating?: -1 | 1 | null;
};

type Phase = "setup" | "chat" | "feedback";

const SESSION_KEY = "chat_active_session";

interface SavedSession {
  sessionId: string;
  persona: Persona;
  scenario: ChatScenario;
  messages: Message[];
}

// Map language codes to BCP-47 for speech APIs
const SPEECH_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN",
  es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR",
};

const ChatPage = () => {
  const { user, profile } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [restoringSession, setRestoringSession] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speechLang = SPEECH_LANG_MAP[profile?.target_language || "en"] || "en-US";
  const { isListening, transcript, interimTranscript, isSupported: sttSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition(speechLang);
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechSynthesis(speechLang);

  // When STT transcript is finalized, append to input
  useEffect(() => {
    if (transcript) {
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  const handleTTS = (text: string, index: number) => {
    if (isSpeaking && playingIndex === index) {
      stopSpeaking();
      setPlayingIndex(null);
    } else {
      // Strip markdown for cleaner TTS
      const clean = text.replace(/[*_~`#>\[\]()!]/g, "").replace(/\n+/g, " ").trim();
      speak(clean);
      setPlayingIndex(index);
    }
  };

  // Reset playing index when speech ends
  useEffect(() => {
    if (!isSpeaking) setPlayingIndex(null);
  }, [isSpeaking]);

  // Get missions for current scenario
  const missions: MiniMission[] = scenario
    ? SCENARIO_MISSIONS[scenario.id] || DEFAULT_MISSIONS
    : [];

  // ── Session Restoration ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed: SavedSession = JSON.parse(saved);
        if (parsed.sessionId && parsed.persona && parsed.scenario && parsed.messages?.length > 0) {
          setSessionId(parsed.sessionId);
          setPersona(parsed.persona);
          setScenario(parsed.scenario);
          setMessages(parsed.messages);
          setPhase("chat");
        }
      }
    } catch { /* ignore */ }
    setRestoringSession(false);
  }, []);

  // ── Persist session to localStorage ──
  useEffect(() => {
    if (phase === "chat" && persona && scenario && messages.length > 0) {
      const session: SavedSession = { sessionId, persona, scenario, messages };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }, [phase, persona, scenario, messages, sessionId]);

  const clearSavedSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mission checking ──
  const checkMissions = useCallback(
    (allMessages: Message[]) => {
      if (!scenario) return;
      const userMessages = allMessages.filter((m) => m.role === "user");
      const allUserText = userMessages.map((m) => m.content.toLowerCase()).join(" ");
      const questionCount = userMessages.filter((m) => m.content.includes("?")).length;

      const newCompleted = new Set(completedMissions);
      let xpGained = 0;

      for (const mission of missions) {
        if (newCompleted.has(mission.id)) continue;

        let completed = false;

        // Special: message count mission
        if (mission.id.includes("5msg") && userMessages.length >= 5) {
          completed = true;
        }
        // Special: question count mission
        else if (mission.id.includes("question") && mission.checkKeywords.includes("?") && questionCount >= 2) {
          completed = true;
        }
        // Keyword-based missions
        else if (mission.checkKeywords.length > 0 && !mission.checkKeywords.includes("?")) {
          const matchCount = mission.checkKeywords.filter((kw) => allUserText.includes(kw.toLowerCase())).length;
          if (matchCount >= 2) completed = true;
        }

        if (completed) {
          newCompleted.add(mission.id);
          xpGained += mission.xpReward;
        }
      }

      if (newCompleted.size > completedMissions.size) {
        setCompletedMissions(newCompleted);
        const newlyCompleted = [...newCompleted].filter((id) => !completedMissions.has(id));
        for (const id of newlyCompleted) {
          const mission = missions.find((m) => m.id === id);
          if (mission) {
            toast.success(`🎯 미션 완료! "${mission.title}" +${mission.xpReward}XP`);
          }
        }
        // Award XP
        if (xpGained > 0 && user) {
          awardXP(xpGained);
        }
      }
    },
    [scenario, missions, completedMissions, user]
  );

  const awardXP = async (xp: number) => {
    if (!user || !profile) return;
    try {
      await supabase.from("profiles").update({ total_xp: profile.total_xp + xp }).eq("user_id", user.id);
      await supabase.from("learning_stats").upsert(
        { user_id: user.id, date: new Date().toISOString().split("T")[0], xp_earned: xp },
        { onConflict: "user_id,date" }
      );
    } catch { /* silent */ }
  };

  const handleStart = (p: Persona, s: ChatScenario) => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    setPersona(p);
    setScenario(s);
    setMessages([]);
    setCompletedMissions(new Set());
    setPhase("chat");
  };

  const handleEndChat = () => {
    if (messages.filter((m) => m.role === "user").length < 2) {
      toast.error("최소 2개 이상 메시지를 보낸 후 마무리할 수 있습니다");
      return;
    }
    clearSavedSession();
    setPhase("feedback");
  };

  const handleBackToSetup = () => {
    clearSavedSession();
    setPhase("setup");
    setMessages([]);
    setPersona(null);
    setScenario(null);
    setCompletedMissions(new Set());
  };

  const handleStarterClick = (text: string) => {
    setInput(text);
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || loading) return;

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    await supabase.from("chat_messages").insert({
      user_id: user.id, role: "user", content: input, session_id: sessionId,
    });

    try {
      const targetLang = LANG_NAMES[profile?.target_language || "en"];
      const nativeLang = LANG_NAMES[profile?.native_language || "ko"];
      const level = profile?.current_level || "beginner";

      // Sliding window: send last 20 messages + system context
      const windowedMessages = newMessages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: windowedMessages,
          targetLanguage: targetLang,
          nativeLanguage: nativeLang,
          level,
          persona,
          scenario: scenario?.label,
        },
      });

      if (error) throw error;

      const assistantContent = data?.content || "죄송합니다, 다시 시도해주세요.";
      const responseTimeMs = data?.response_time_ms || 0;

      const { data: feedbackData } = await supabase.from("ai_feedback").insert({
        user_id: user.id, feature: "chat", response_time_ms: responseTimeMs,
        metadata: { session_id: sessionId },
      }).select("id").single();

      const assistantMsg: Message = {
        role: "assistant", content: assistantContent, responseTimeMs,
        feedbackId: feedbackData?.id, rating: null,
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      await supabase.from("chat_messages").insert({
        user_id: user.id, role: "assistant", content: assistantContent, session_id: sessionId,
      });

      // Check missions after each exchange
      checkMissions(finalMessages);
    } catch (err: any) {
      await supabase.from("ai_feedback").insert({
        user_id: user.id, feature: "chat",
        error_type: err?.error_type || "unknown",
        error_message: err?.message || "Unknown error",
        response_time_ms: err?.response_time_ms || 0,
      });

      // Specific error handling
      if (err?.message?.includes("429") || err?.error_type === "rate_limit") {
        toast.error("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } else if (err?.message?.includes("402") || err?.error_type === "payment_required") {
        toast.error("크레딧이 부족합니다. 설정에서 충전해주세요.");
      }

      setMessages([...newMessages, { role: "assistant", content: "⚠️ 오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async (msgIndex: number, rating: -1 | 1) => {
    const msg = messages[msgIndex];
    if (!msg.feedbackId || !user) return;
    const newRating = msg.rating === rating ? null : rating;
    const { error } = await supabase.from("ai_feedback").update({ rating: newRating }).eq("id", msg.feedbackId);
    if (error) { toast.error("평가 저장에 실패했습니다"); return; }
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, rating: newRating } : m)));
  };

  if (restoringSession) return null;

  // Get starter prompts
  const starters = scenario ? SCENARIO_STARTERS[scenario.id] || SCENARIO_STARTERS.free : [];

  return (
    <AppLayout>
      {phase === "setup" && (
        <>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">회화 연습 💬</h1>
                <p className="text-sm text-muted-foreground font-semibold">
                  대화 상대와 상황을 선택해 연습을 시작하세요
                </p>
              </div>
              <Link
                to="/chat-history"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-border text-muted-foreground text-xs font-bold hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <History size={14} /> 기록
              </Link>
            </div>
          </motion.div>
          <ChatSetup onStart={handleStart} />
        </>
      )}

      {phase === "feedback" && persona && scenario && (
        <>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
            <h1 className="text-2xl font-extrabold text-foreground">대화 피드백 📊</h1>
          </motion.div>
          <ChatFeedback
            messages={messages}
            persona={persona}
            scenario={scenario}
            onBack={handleBackToSetup}
          />
        </>
      )}

      {phase === "chat" && (
        <>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-foreground">
                  {scenario?.emoji} {scenario?.label}
                </h1>
                <p className="text-xs text-muted-foreground font-semibold">
                  {persona?.gender === "male" ? "👨" : "👩"} {persona?.occupation} · {persona?.personality}
                </p>
              </div>
              <button
                onClick={handleEndChat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-duo-orange text-duo-orange text-xs font-bold hover:bg-duo-orange/10 transition-colors"
              >
                <Flag size={12} /> 마무리
              </button>
            </div>
          </motion.div>

          {/* Mini Missions Bar */}
          {missions.length > 0 && (
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-3 bg-card rounded-2xl border border-border p-3 shadow-sm"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={14} className="text-primary" />
                <span className="text-[11px] font-extrabold text-foreground">미니 미션</span>
                <span className="text-[10px] font-bold text-primary ml-auto">
                  {completedMissions.size}/{missions.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {missions.map((mission) => {
                  const done = completedMissions.has(mission.id);
                  return (
                    <div
                      key={mission.id}
                      className={`flex items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 transition-colors ${
                        done ? "bg-primary/10" : "bg-muted/50"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={13} className="text-primary flex-shrink-0" />
                      ) : (
                        <div className="w-[13px] h-[13px] rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span className={`font-bold flex-1 ${done ? "text-primary line-through" : "text-foreground"}`}>
                        {mission.title}
                      </span>
                      <span className={`text-[10px] font-bold ${done ? "text-primary" : "text-muted-foreground"}`}>
                        +{mission.xpReward}XP
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="space-y-3 mb-4 min-h-[30vh]">
            {/* Empty state with starter prompts */}
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="bg-card rounded-2xl border border-border p-5 text-center shadow-sm">
                  <div className="text-3xl mb-2">{scenario?.emoji}</div>
                  <p className="font-bold text-foreground text-sm mb-1">대화를 시작해 보세요!</p>
                  <p className="text-xs text-muted-foreground font-semibold">{scenario?.description}</p>
                </div>

                {starters.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <Sparkles size={12} className="text-primary" />
                      <span className="text-[11px] font-extrabold text-muted-foreground">이렇게 시작해 보세요</span>
                    </div>
                    <div className="space-y-2">
                      {starters.map((text, i) => (
                        <motion.button
                          key={i}
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.1 + i * 0.08 }}
                          onClick={() => handleStarterClick(text)}
                          className="w-full text-left px-4 py-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-sm font-semibold text-foreground hover:border-primary hover:bg-primary/10 transition-colors"
                        >
                          💬 {text}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border shadow-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold">{msg.content}</p>
                  )}
                </div>

                {msg.role === "assistant" && msg.feedbackId && (
                  <div className="flex items-center gap-2 mt-1 px-1">
                    {msg.responseTimeMs != null && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-semibold">
                        <Clock size={10} />{(msg.responseTimeMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    <button
                      onClick={() => handleRating(i, 1)}
                      className={`p-1 rounded-md transition-colors ${
                        msg.rating === 1 ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    ><ThumbsUp size={12} /></button>
                    <button
                      onClick={() => handleRating(i, -1)}
                      className={`p-1 rounded-md transition-colors ${
                        msg.rating === -1 ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:text-foreground"
                      }`}
                    ><ThumbsDown size={12} /></button>
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
                  <Loader2 size={18} className="animate-spin text-muted-foreground" />
                </div>
              </motion.div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input bar */}
          <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-3">
            <div className="max-w-lg mx-auto flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-4 py-3 rounded-2xl border-2 border-border bg-card text-foreground font-semibold focus:border-primary focus:outline-none transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="duo-btn-primary px-4 disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default ChatPage;
