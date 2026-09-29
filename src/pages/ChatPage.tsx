import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRecordActivity } from "@/hooks/useRecordActivity";
import { track } from "@/lib/analytics";
import { usePhrasePractice } from "@/hooks/usePhrasePractice";
import { usesPhrase } from "@/lib/phrasePractice";
import { supabase } from "@/integrations/supabase/client";
import { AiError, invokeAi, isPaywallError } from "@/lib/ai";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import ChatSetup, { type Persona, type ChatScenario } from "@/components/chat/ChatSetup";
import ChatFeedback from "@/components/chat/ChatFeedback";
import ChatConversation from "@/components/chat/ChatConversation";
import { SCENARIO_STARTERS, SCENARIO_MISSIONS, DEFAULT_MISSIONS, type MiniMission } from "@/lib/chatScenarioData";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { LANG_NAMES, SPEECH_LANG_MAP } from "@/lib/constants";
import type { ChatMessage, ChatCorrection, ChatPhase, SavedChatSession } from "@/lib/chatTypes";
import { CHAT_SESSION_KEY } from "@/lib/chatTypes";

const ChatPage = () => {
  const { user, profile } = useAuth();
  const recordActivity = useRecordActivity();
  const [phase, setPhase] = useState<ChatPhase>("setup");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [restoringSession, setRestoringSession] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const speechLang = SPEECH_LANG_MAP[profile?.target_language || "en"] || "en-US";
  const { isListening, transcript, interimTranscript, isSupported: sttSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition(speechLang);
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechSynthesis(speechLang);

  const { practiceCards, loadPracticeCards, practiceCardsReady, markPhraseUsed } = usePhrasePractice();
  const missions = useMemo<MiniMission[]>(
    () =>
      scenario
        ? [
            ...practiceCards.map((card) => ({
              id: `phrase_${card.id}`,
              title: `"${card.target_text}" 써 보기`,
              description: "복습 카드 표현을 대화에서 사용해 보세요",
              checkKeywords: [],
              xpReward: 10,
              phrase: card.target_text,
              cardId: card.id,
            })),
            ...(SCENARIO_MISSIONS[scenario.id] || DEFAULT_MISSIONS),
          ]
        : [],
    [scenario, practiceCards],
  );

  const starters = scenario ? SCENARIO_STARTERS[scenario.id] || SCENARIO_STARTERS.free : [];

  // ── STT transcript → input ──
  useEffect(() => {
    if (transcript) {
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Reset playing index when speech ends
  useEffect(() => {
    if (!isSpeaking) setPlayingIndex(null);
  }, [isSpeaking]);

  // ── Session Restoration ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_SESSION_KEY);
      if (saved) {
        const parsed: SavedChatSession = JSON.parse(saved);
        if (parsed.sessionId && parsed.persona && parsed.scenario && parsed.messages?.length > 0) {
          setSessionId(parsed.sessionId);
          setPersona(parsed.persona);
          setScenario(parsed.scenario);
          setMessages(parsed.messages);
          setCompletedMissions(new Set(parsed.completedMissions ?? []));
          loadPracticeCards(parsed.practiceCards);
          setPhase("chat");
        }
      }
    } catch { /* ignore */ }
    setRestoringSession(false);
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist session ──
  useEffect(() => {
    if (phase === "chat" && persona && scenario && messages.length > 0) {
      const session: SavedChatSession = {
        sessionId, persona, scenario, messages, practiceCards, completedMissions: [...completedMissions],
      };
      localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
    }
  }, [phase, persona, scenario, messages, sessionId, practiceCards, completedMissions]);

  const clearSavedSession = () => localStorage.removeItem(CHAT_SESSION_KEY);

  // ── Mission checking ──
  const checkMissions = useCallback(
    (allMessages: ChatMessage[]) => {
      if (!scenario) return;
      const userMessages = allMessages.filter((m) => m.role === "user");
      const allUserText = userMessages.map((m) => m.content.toLowerCase()).join(" ");
      const questionCount = userMessages.filter((m) => m.content.includes("?")).length;

      const newCompleted = new Set(completedMissions);

      for (const mission of missions) {
        if (newCompleted.has(mission.id)) continue;
        let completed = false;
        if (mission.phrase) completed = userMessages.some((m) => usesPhrase(m.content, mission.phrase!));
        else if (mission.id.includes("5msg") && userMessages.length >= 5) completed = true;
        else if (mission.id.includes("question") && mission.checkKeywords.includes("?") && questionCount >= 2) completed = true;
        else if (mission.checkKeywords.length > 0 && !mission.checkKeywords.includes("?")) {
          const matchCount = mission.checkKeywords.filter((kw) => allUserText.includes(kw.toLowerCase())).length;
          if (matchCount >= 2) completed = true;
        }
        if (completed) newCompleted.add(mission.id);
      }

      if (newCompleted.size > completedMissions.size) {
        setCompletedMissions(newCompleted);
        const newlyCompleted = [...newCompleted].filter((id) => !completedMissions.has(id));
        for (const id of newlyCompleted) {
          const m = missions.find((mi) => mi.id === id);
          if (!m) continue;
          toast.success(`🎯 미션 완료! "${m.title}" +${m.xpReward}XP`);
          void recordActivity("chat_mission", `chat_mission:${sessionId}:${m.id}`, m.xpReward);
          const card = practiceCards.find((c) => c.id === m.cardId);
          if (card) void markPhraseUsed(card);
        }
      }
    },
    [scenario, missions, completedMissions, recordActivity, sessionId, practiceCards, markPhraseUsed]
  );

  // ── Handlers ──
  const handleStart = (p: Persona, s: ChatScenario) => {
    setSessionId(crypto.randomUUID());
    setPersona(p);
    setScenario(s);
    setMessages([]);
    setCompletedMissions(new Set());
    setPhase("chat");
    loadPracticeCards();
  };

  const handleEndChat = () => {
    if (messages.filter((m) => m.role === "user").length < 2) {
      toast.error("최소 2개 이상 메시지를 보낸 후 마무리할 수 있습니다");
      return;
    }
    clearSavedSession();
    setPhase("feedback");
    track("chat_completed");
  };

  const handleBackToSetup = () => {
    clearSavedSession();
    setPhase("setup");
    setMessages([]);
    setPersona(null);
    setScenario(null);
    setCompletedMissions(new Set());
  };

  const handleTTS = (text: string, index: number) => {
    if (isSpeaking && playingIndex === index) {
      stopSpeaking();
      setPlayingIndex(null);
    } else {
      const clean = text.replace(/[*_~`#>[\]()!]/g, "").replace(/\n+/g, " ").trim();
      speak(clean);
      setPlayingIndex(index);
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

  const sendMessage = async () => {
    if (!input.trim() || !user || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input };
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
      const windowedMessages = newMessages.slice(-20).map((m) => ({ role: m.role, content: m.content }));
      const cards = await practiceCardsReady();

      const { data, error } = await invokeAi<{ content?: string; response_time_ms?: number; corrections?: ChatCorrection[] }>("chat", {
        body: {
          messages: windowedMessages, targetLanguage: targetLang, nativeLanguage: nativeLang, level, persona,
          scenario: scenario?.label, practicePhrases: cards.map((c) => c.target_text),
        },
      });
      if (error) throw error;

      const assistantContent = data?.content || "죄송합니다, 다시 시도해주세요.";
      const responseTimeMs = data?.response_time_ms || 0;
      const corrections: ChatCorrection[] = data?.corrections || [];

      const { data: feedbackData } = await supabase.from("ai_feedback").insert({
        user_id: user.id, feature: "chat", response_time_ms: responseTimeMs,
        metadata: { session_id: sessionId },
      }).select("id").single();

      const assistantMsg: ChatMessage = {
        role: "assistant", content: assistantContent, responseTimeMs,
        feedbackId: feedbackData?.id, rating: null, corrections,
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      await supabase.from("chat_messages").insert({
        user_id: user.id, role: "assistant", content: assistantContent, session_id: sessionId,
      });

      if (corrections.length > 0) {
        const cardsToInsert = corrections.map((c) => ({
          user_id: user.id, native_text: `${c.wrong} → ${c.correct}`, target_text: c.correct,
          context: `💬 채팅 교정: ${c.explanation || ""}\n원문: ${c.wrong}`,
          difficulty: 1, ease_factor: 2.5, interval_days: 1, review_count: 0, next_review_at: new Date().toISOString(),
        }));
        const { error: srsError } = await supabase
          .from("srs_cards")
          .upsert(cardsToInsert, { onConflict: "user_id,native_text", ignoreDuplicates: true });
        if (!srsError) toast(`📝 교정 ${corrections.length}건이 복습 카드에 저장됨`, { icon: "✅" });
      }

      void recordActivity("chat_message", `chat_message:${sessionId}:${newMessages.filter((m) => m.role === "user").length}`);
      checkMissions(finalMessages);
    } catch (err) {
      await supabase.from("ai_feedback").insert({
        user_id: user.id, feature: "chat",
        error_type: err instanceof AiError ? err.type : "unknown",
        error_message: err instanceof Error ? err.message : String(err),
        response_time_ms: 0,
      });

      // The paywall toast already explains a used-up quota; other failures get the reason inline.
      if (!isPaywallError(err)) {
        const reason = err instanceof AiError ? err.message : "오류가 발생했습니다. 다시 시도해주세요.";
        setMessages([...newMessages, { role: "assistant", content: `⚠️ ${reason}` }]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (restoringSession) return null;

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
          <ChatFeedback messages={messages} persona={persona} scenario={scenario} onBack={handleBackToSetup} />
        </>
      )}

      {phase === "chat" && persona && scenario && (
        <ChatConversation
          persona={persona}
          scenario={scenario}
          messages={messages}
          loading={loading}
          input={input}
          missions={missions}
          completedMissions={completedMissions}
          starters={starters}
          isListening={isListening}
          interimTranscript={interimTranscript}
          isSpeaking={isSpeaking}
          sttSupported={sttSupported}
          playingIndex={playingIndex}
          onInputChange={setInput}
          onSend={sendMessage}
          onEndChat={handleEndChat}
          onStarterClick={(text) => setInput(text)}
          onMicToggle={isListening ? stopListening : startListening}
          onTTS={handleTTS}
          onRating={handleRating}
        />
      )}
    </AppLayout>
  );
};

export default ChatPage;
