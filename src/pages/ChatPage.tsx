import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Send, Loader2, ThumbsUp, ThumbsDown, Clock, Flag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import ChatSetup, { type Persona, type ChatScenario } from "@/components/chat/ChatSetup";
import ChatFeedback from "@/components/chat/ChatFeedback";

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

const ChatPage = () => {
  const { user, profile } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStart = (p: Persona, s: ChatScenario) => {
    setPersona(p);
    setScenario(s);
    setMessages([]);
    setPhase("chat");
  };

  const handleEndChat = () => {
    if (messages.filter((m) => m.role === "user").length < 2) {
      toast.error("최소 2개 이상 메시지를 보낸 후 마무리할 수 있습니다");
      return;
    }
    setPhase("feedback");
  };

  const handleBackToSetup = () => {
    setPhase("setup");
    setMessages([]);
    setPersona(null);
    setScenario(null);
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

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
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
      setMessages([...newMessages, assistantMsg]);

      await supabase.from("chat_messages").insert({
        user_id: user.id, role: "assistant", content: assistantContent, session_id: sessionId,
      });
    } catch (err: any) {
      await supabase.from("ai_feedback").insert({
        user_id: user.id, feature: "chat",
        error_type: err?.error_type || "unknown",
        error_message: err?.message || "Unknown error",
        response_time_ms: err?.response_time_ms || 0,
      });
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

  return (
    <AppLayout>
      {phase === "setup" && (
        <>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
            <h1 className="text-2xl font-extrabold text-foreground">회화 연습 💬</h1>
            <p className="text-sm text-muted-foreground font-semibold">
              대화 상대와 상황을 선택해 연습을 시작하세요
            </p>
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
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">
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

          <div className="space-y-3 mb-4 min-h-[40vh]">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="duo-card text-center py-6">
                <div className="text-3xl mb-2">{scenario?.emoji}</div>
                <p className="font-bold text-foreground text-sm mb-1">대화를 시작해 보세요!</p>
                <p className="text-xs text-muted-foreground font-semibold">{scenario?.description}</p>
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
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "duo-card"
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
                <div className="duo-card px-4 py-3">
                  <Loader2 size={18} className="animate-spin text-muted-foreground" />
                </div>
              </motion.div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="fixed bottom-16 left-0 right-0 bg-background border-t-2 border-border p-3">
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
