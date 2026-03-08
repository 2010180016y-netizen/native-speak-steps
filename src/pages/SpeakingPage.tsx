import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, RotateCcw, ArrowLeft, Square } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import SpeakingFeedback from "@/components/speaking/SpeakingFeedback";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string };

type Scenario = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};

const SCENARIOS: Scenario[] = [
  { id: "cafe", emoji: "☕", title: "카페 주문", description: "커피숍에서 음료 주문하기" },
  { id: "restaurant", emoji: "🍽️", title: "레스토랑", description: "레스토랑에서 음식 주문하기" },
  { id: "hotel", emoji: "🏨", title: "호텔 체크인", description: "호텔에서 체크인하기" },
  { id: "shopping", emoji: "🛍️", title: "쇼핑", description: "옷가게에서 쇼핑하기" },
  { id: "airport", emoji: "✈️", title: "공항", description: "공항에서 체크인하기" },
  { id: "free", emoji: "💬", title: "자유 대화", description: "자유롭게 대화 연습하기" },
];

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
  ko: "ko-KR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

const SpeakingPage = () => {
  const { user } = useAuth();
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [profile, setProfile] = useState<{ target_language: string; native_language: string; current_level: string } | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const targetLang = LANG_MAP[profile?.target_language || "en"] || "en-US";
  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition(targetLang);
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechSynthesis(targetLang);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("target_language, native_language, current_level").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiLoading]);

  // When transcript finalizes, send to AI
  useEffect(() => {
    if (transcript && !isListening) {
      sendMessage(transcript);
      resetTranscript();
    }
  }, [transcript, isListening]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isAiLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("speaking", {
        body: {
          messages: newMessages,
          targetLanguage: profile?.target_language || "en",
          nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner",
          scenario: scenario || "free",
        },
      });

      if (error) throw error;

      const aiMsg: Message = { role: "assistant", content: data.content };
      setMessages((prev) => [...prev, aiMsg]);

      if (autoSpeak && data.content) {
        // Small delay so UI updates first
        setTimeout(() => speak(data.content), 300);
      }
    } catch (e: any) {
      console.error("Speaking error:", e);
      toast.error(e?.message || "AI 응답에 실패했어요");
    } finally {
      setIsAiLoading(false);
    }
  }, [messages, profile, scenario, autoSpeak, speak, isAiLoading]);

  const startScenario = useCallback(async (scenarioId: string) => {
    setScenario(scenarioId);
    setMessages([]);
    setFeedback(null);
    setIsAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("speaking", {
        body: {
          messages: [{ role: "user", content: "Let's start the conversation. Please greet me first and set the scene." }],
          targetLanguage: profile?.target_language || "en",
          nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner",
          scenario: scenarioId,
        },
      });

      if (error) throw error;

      const aiMsg: Message = { role: "assistant", content: data.content };
      setMessages([aiMsg]);

      if (autoSpeak && data.content) {
        setTimeout(() => speak(data.content), 300);
      }
    } catch (e: any) {
      toast.error("대화를 시작할 수 없어요");
    } finally {
      setIsAiLoading(false);
    }
  }, [profile, autoSpeak, speak]);

  const endConversation = useCallback(async () => {
    if (messages.length < 2) {
      toast.error("대화를 좀 더 진행한 후 피드백을 받아보세요");
      return;
    }
    stopSpeaking();
    setIsFeedbackLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("speaking-feedback", {
        body: {
          messages,
          targetLanguage: profile?.target_language || "en",
          nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner",
        },
      });

      if (error) throw error;
      if (data.feedback) {
        setFeedback(data.feedback);
      } else {
        toast.error("피드백을 생성할 수 없어요");
      }
    } catch (e: any) {
      console.error("Feedback error:", e);
      toast.error(e?.message || "피드백 생성에 실패했어요");
    } finally {
      setIsFeedbackLoading(false);
    }
  }, [messages, profile, stopSpeaking]);

  const handleMicClick = () => {
    if (isSpeaking) stopSpeaking();
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const replayMessage = (text: string) => {
    if (isSpeaking) stopSpeaking();
    else speak(text);
  };

  // Scenario selection screen
  if (!scenario) {
    return (
      <AppLayout>
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">스피킹 연습 🎙️</h1>
          <p className="text-sm text-muted-foreground font-semibold mb-5">상황을 선택하고 음성으로 대화해보세요!</p>
        </motion.div>

        {!isSupported && (
          <div className="duo-card bg-destructive/10 border-destructive/30 mb-4">
            <p className="text-sm font-bold text-destructive">⚠️ 이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SCENARIOS.map((s, idx) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => startScenario(s.id)}
              className="duo-card text-left p-4 cursor-pointer hover:border-primary transition-colors"
            >
              <div className="text-3xl mb-2">{s.emoji}</div>
              <div className="font-bold text-foreground text-sm">{s.title}</div>
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">{s.description}</div>
            </motion.button>
          ))}
        </div>
      </AppLayout>
    );
  }

  // Conversation screen
  const currentScenario = SCENARIOS.find((s) => s.id === scenario)!;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setScenario(null); stopSpeaking(); }} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div>
            <h2 className="font-extrabold text-foreground text-base">
              {currentScenario.emoji} {currentScenario.title}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`p-2 rounded-xl transition-colors ${autoSpeak ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => startScenario(scenario)}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 mb-28 min-h-[40vh]">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border-2 border-border text-foreground rounded-bl-md"
                }`}
              >
                <p className="text-sm font-semibold whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && (
                  <button
                    onClick={() => replayMessage(msg.content)}
                    className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Volume2 size={12} /> {isSpeaking ? "중지" : "다시 듣기"}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isAiLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-card border-2 border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
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
          {/* Interim transcript preview */}
          <AnimatePresence>
            {(isListening || interimTranscript) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-card border-2 border-primary/30 rounded-2xl px-4 py-2.5 mb-3 text-center"
              >
                <p className="text-sm font-semibold text-foreground">
                  {interimTranscript || (
                    <span className="text-muted-foreground">듣고 있어요... 🎧</span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleMicClick}
              disabled={isAiLoading || !isSupported}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40 ${
                isListening
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
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

          {!isListening && !isAiLoading && (
            <p className="text-center text-[11px] font-semibold text-muted-foreground mt-2">
              마이크 버튼을 눌러 말해보세요
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SpeakingPage;
