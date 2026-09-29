import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import SpeakingFeedback from "@/components/speaking/SpeakingFeedback";
import SpeakingSetup from "@/components/speaking/SpeakingSetup";
import SpeakingIncoming from "@/components/speaking/SpeakingIncoming";
import SpeakingCall from "@/components/speaking/SpeakingCall";
import { supabase } from "@/integrations/supabase/client";
import { invokeAi } from "@/lib/ai";
import { useAuth } from "@/hooks/useAuth";
import { useRecordActivity } from "@/hooks/useRecordActivity";
import { track } from "@/lib/analytics";
import { usePhrasePractice } from "@/hooks/usePhrasePractice";
import { usesPhrase } from "@/lib/phrasePractice";
import { toast } from "sonner";
import type { Persona, ChatScenario } from "@/components/chat/ChatSetup";
import { SPEAKING_MISSIONS, SPEAKING_HINTS, type SpeakingMission } from "@/lib/speakingScenarioData";
import { SPEECH_LANG_MAP, getRandomName } from "@/lib/constants";
import type { SpeakingMessage, Correction, SpeakingPhase, SpeakingFeedbackData } from "@/lib/speakingTypes";

const SpeakingPage = () => {
  const { user } = useAuth();
  const recordActivity = useRecordActivity();
  const [phase, setPhase] = useState<SpeakingPhase>("setup");
  const [messages, setMessages] = useState<SpeakingMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [profile, setProfile] = useState<{ target_language: string; native_language: string; current_level: string } | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [feedback, setFeedback] = useState<SpeakingFeedbackData | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [speakingSessionId] = useState(() => `speaking_${crypto.randomUUID()}`);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [persona, setPersona] = useState<Persona | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);
  const [callerName, setCallerName] = useState("");
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  const targetLang = SPEECH_LANG_MAP[profile?.target_language || "en"] || "en-US";
  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition(targetLang);
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechSynthesis(targetLang);

  const { practiceCards, loadPracticeCards, markPhraseUsed } = usePhrasePractice();
  const missions: SpeakingMission[] = scenario
    ? [
        ...practiceCards.map((card) => ({
          id: `phrase_${card.id}`,
          title: `"${card.target_text}" 말해 보기`,
          xpReward: 10,
          checkType: "phrase" as const,
          threshold: 1,
          phrase: card.target_text,
          cardId: card.id,
        })),
        ...(SPEAKING_MISSIONS[scenario.id] || SPEAKING_MISSIONS.free),
      ]
    : [];
  const practicePhrases = practiceCards.map((c) => c.target_text);
  const levelHints = SPEAKING_HINTS[profile?.target_language || "en"]?.[profile?.current_level || "beginner"] || [];

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("target_language, native_language, current_level").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isAiLoading]);

  useEffect(() => {
    if (transcript && !isListening) {
      sendMessage(transcript);
      resetTranscript();
    }
  }, [transcript, isListening]);

  useEffect(() => {
    if (phase === "call") {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [phase]);

  const saveMessageToDB = useCallback(async (role: string, content: string) => {
    if (!user) return;
    try { await supabase.from("chat_messages").insert({ user_id: user.id, role, content, session_id: speakingSessionId }); } catch { /* silent */ }
  }, [user, speakingSessionId]);

  const saveCorrectionCards = useCallback(async (corrections: Correction[]) => {
    if (!user || corrections.length === 0) return;
    const cardsToInsert = corrections.map((c) => ({
      user_id: user.id, native_text: `${c.wrong} → ${c.correct}`, target_text: c.correct,
      context: `📞 스피킹 교정: ${c.explanation || ""}\n원문: ${c.wrong}`,
      difficulty: 1, ease_factor: 2.5, interval_days: 1, review_count: 0, next_review_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("srs_cards").upsert(cardsToInsert, { onConflict: "user_id,native_text", ignoreDuplicates: true });
    if (!error) toast(`📝 교정 ${corrections.length}건이 복습 카드에 저장됨`, { icon: "✅" });
  }, [user]);

  const checkMissions = useCallback((allMessages: SpeakingMessage[]) => {
    if (!scenario) return;
    const userMessages = allMessages.filter((m) => m.role === "user");
    const questionCount = userMessages.filter((m) => m.content.includes("?")).length;
    const newCompleted = new Set(completedMissions);
    for (const mission of missions) {
      if (newCompleted.has(mission.id)) continue;
      let done = false;
      if (mission.checkType === "message_count" && userMessages.length >= mission.threshold) done = true;
      if (mission.checkType === "question_count" && questionCount >= mission.threshold) done = true;
      if (mission.checkType === "duration" && callDuration >= mission.threshold) done = true;
      if (mission.checkType === "phrase" && userMessages.some((m) => usesPhrase(m.content, mission.phrase!))) done = true;
      if (done) newCompleted.add(mission.id);
    }
    if (newCompleted.size > completedMissions.size) {
      setCompletedMissions(newCompleted);
      const newlyDone = [...newCompleted].filter((id) => !completedMissions.has(id));
      for (const id of newlyDone) {
        const m = missions.find((mi) => mi.id === id);
        if (!m) continue;
        toast.success(`🎯 미션 완료! "${m.title}" +${m.xpReward}XP`);
        void recordActivity("speaking_mission", `speaking_mission:${speakingSessionId}:${m.id}`, m.xpReward);
        const card = practiceCards.find((c) => c.id === m.cardId);
        if (card) void markPhraseUsed(card);
      }
    }
  }, [scenario, missions, completedMissions, callDuration, recordActivity, speakingSessionId, practiceCards, markPhraseUsed]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isAiLoading) return;
    setLastFailedText(null);
    const userMsg: SpeakingMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsAiLoading(true);
    saveMessageToDB("user", text);
    try {
      const { data, error } = await invokeAi("speaking", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          targetLanguage: profile?.target_language || "en", nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner", scenario: scenario?.id || "free",
          persona: persona ? { gender: persona.gender, occupation: persona.occupation, personality: persona.personality } : undefined,
          callerName: callerName || undefined, practicePhrases,
        },
      });
      if (error) throw error;
      const corrections: Correction[] = data.corrections || [];
      const aiMsg: SpeakingMessage = { role: "assistant", content: data.content, corrections };
      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      saveMessageToDB("assistant", data.content);
      if (corrections.length > 0) saveCorrectionCards(corrections);
      void recordActivity("chat_message", `speaking_message:${speakingSessionId}:${newMessages.filter((m) => m.role === "user").length}`);
      checkMissions(finalMessages);
      if (autoSpeak && data.content) setTimeout(() => speak(data.content), 300);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "AI 응답에 실패했어요. 다시 시도해 주세요.";
      console.error("Speaking error:", e);
      setLastFailedText(text);
      setMessages(messages);
      toast.error(errMsg, { action: { label: "재시도", onClick: () => sendMessage(text) } });
    } finally {
      setIsAiLoading(false);
    }
  }, [messages, profile, scenario, persona, autoSpeak, speak, isAiLoading, saveMessageToDB, saveCorrectionCards, callerName, checkMissions, recordActivity, speakingSessionId, practicePhrases]);

  const startCall = useCallback(async () => {
    setPhase("call");
    setMessages([]);
    setFeedback(null);
    setIsAiLoading(true);
    try {
      const { data, error } = await invokeAi("speaking", {
        body: {
          messages: [{ role: "user", content: "The phone is ringing and I just answered. Start the conversation as the caller." }],
          targetLanguage: profile?.target_language || "en", nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner", scenario: scenario?.id || "free",
          persona: persona ? { gender: persona.gender, occupation: persona.occupation, personality: persona.personality } : undefined,
          callerName: callerName || undefined, practicePhrases,
        },
      });
      if (error) throw error;
      const aiMsg: SpeakingMessage = { role: "assistant", content: data.content, corrections: [] };
      setMessages([aiMsg]);
      saveMessageToDB("assistant", data.content);
      if (autoSpeak && data.content) setTimeout(() => speak(data.content), 300);
    } catch {
      toast.error("통화를 시작할 수 없어요");
    } finally {
      setIsAiLoading(false);
    }
  }, [profile, autoSpeak, speak, scenario, persona, callerName, saveMessageToDB, practicePhrases]);

  const endConversation = useCallback(async () => {
    if (messages.length < 2) { toast.error("대화를 좀 더 진행한 후 피드백을 받아보세요"); return; }
    stopSpeaking();
    setIsFeedbackLoading(true);
    try {
      const { data, error } = await invokeAi("speaking-feedback", {
        body: { messages, targetLanguage: profile?.target_language || "en", nativeLanguage: profile?.native_language || "ko", level: profile?.current_level || "beginner" },
      });
      if (error) throw error;
      if (data.feedback) {
        setFeedback(data.feedback as SpeakingFeedbackData);
        if (user) {
          const score = data.feedback.overallScore || 50;
          const reward = await recordActivity("speaking_session", `speaking_session:${speakingSessionId}`, score);

          await supabase.from("lesson_completions").insert({
            user_id: user.id, lesson_type: "speaking", score, duration_seconds: callDuration,
            metadata: {
              session_id: speakingSessionId, scenario: scenario?.id, scenario_label: scenario?.label,
              persona_name: callerName, persona_occupation: persona?.occupation, feedback: data.feedback,
            },
          });

          const grammarErrors: Array<{ original: string; corrected: string; explanation?: string }> = data.feedback.grammar?.errors || [];
          if (grammarErrors.length > 0) {
            const feedbackCards = grammarErrors.map((err) => ({
              user_id: user.id, native_text: `${err.original} → ${err.corrected}`, target_text: err.corrected,
              context: `📞 스피킹 피드백 교정: ${err.explanation || ""}`,
              difficulty: 1, ease_factor: 2.5, interval_days: 1, review_count: 0, next_review_at: new Date().toISOString(),
            }));
            await supabase.from("srs_cards").upsert(feedbackCards, { onConflict: "user_id,native_text", ignoreDuplicates: true });
          }
          if (reward?.applied) toast.success(`🎉 스피킹 완료! +${reward.xp} XP`);
          track("speaking_completed");
        }
      } else {
        toast.error("피드백을 생성할 수 없어요");
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "피드백 생성에 실패했어요";
      console.error("Feedback error:", e);
      toast.error(errMsg);
    } finally {
      setIsFeedbackLoading(false);
      setPhase("feedback");
    }
  }, [messages, profile, stopSpeaking, user, callDuration, speakingSessionId, scenario, persona, callerName]);

  const handleMicClick = () => {
    if (isSpeaking) stopSpeaking();
    if (isListening) stopListening();
    else { resetTranscript(); startListening(); }
  };

  const replayMessage = (text: string) => { if (isSpeaking) stopSpeaking(); else speak(text); };

  const resetToSetup = () => {
    setPhase("setup"); setMessages([]); setFeedback(null); setPersona(null);
    setScenario(null); setCallerName(""); setCompletedMissions(new Set()); setLastFailedText(null); stopSpeaking();
  };

  const handleSetupComplete = (p: Persona, s: ChatScenario) => {
    setPersona(p);
    setScenario(s);
    const name = getRandomName(profile?.target_language || "en", p.gender as "male" | "female");
    setCallerName(name);
    void loadPracticeCards();
    setPhase("incoming");
    setTimeout(() => { setPhase((current) => current === "incoming" ? "setup" : current); }, 15000);
  };

  return (
    <AppLayout>
      {phase === "setup" && (
        <SpeakingSetup isSupported={isSupported} onStartCall={handleSetupComplete} />
      )}

      {phase === "incoming" && persona && scenario && (
        <SpeakingIncoming
          persona={persona} callerName={callerName} scenario={scenario}
          onAccept={startCall} onDecline={resetToSetup}
        />
      )}

      {phase === "feedback" && feedback && (
        <SpeakingFeedback
          feedback={feedback}
          onClose={resetToSetup}
          callInfo={persona && scenario ? {
            callerName, gender: persona.gender, occupation: persona.occupation,
            personality: persona.personality, scenarioLabel: scenario.label,
            scenarioEmoji: scenario.emoji, durationSeconds: callDuration,
          } : undefined}
        />
      )}

      {phase === "call" && persona && scenario && (
        <SpeakingCall
          persona={persona} callerName={callerName} scenario={scenario}
          messages={messages} isAiLoading={isAiLoading} isFeedbackLoading={isFeedbackLoading}
          isListening={isListening} isSupported={isSupported} interimTranscript={interimTranscript}
          isSpeaking={isSpeaking} autoSpeak={autoSpeak} callDuration={callDuration}
          missions={missions} completedMissions={completedMissions} levelHints={levelHints}
          onMicClick={handleMicClick} onEndCall={endConversation} onReset={resetToSetup}
          onToggleAutoSpeak={() => setAutoSpeak(!autoSpeak)} onReplayMessage={replayMessage}
          messagesEndRef={messagesEndRef}
        />
      )}
    </AppLayout>
  );
};

export default SpeakingPage;
