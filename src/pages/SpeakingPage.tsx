import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, RotateCcw, ArrowLeft, Square, Phone, PhoneOff, User } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import SpeakingFeedback from "@/components/speaking/SpeakingFeedback";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Persona, ChatScenario } from "@/components/chat/ChatSetup";

type Correction = { wrong: string; correct: string; explanation: string };
type Message = { role: "user" | "assistant"; content: string; corrections?: Correction[] };

type Phase = "setup" | "incoming" | "call" | "feedback";

const OCCUPATIONS = [
  "학생", "회사원", "프리랜서", "의사", "엔지니어", "교사",
  "예술가", "요리사", "변호사", "기자", "디자이너", "CEO",
];

const PERSONALITIES = [
  "유머러스한 😄", "차분한 😌", "에너지 넘치는 ⚡", "다정한 💕",
  "지적인 🧠", "솔직한 💬", "낙천적인 🌞", "신비로운 🔮",
];

const SCENARIOS: ChatScenario[] = [
  { id: "cafe", emoji: "☕", label: "카페 주문", description: "커피숍에서 음료 주문하기" },
  { id: "restaurant", emoji: "🍽️", label: "레스토랑", description: "레스토랑에서 식사 주문하기" },
  { id: "business_meeting", emoji: "💼", label: "비즈니스 미팅", description: "회의에서 프레젠테이션 및 토론" },
  { id: "job_interview", emoji: "🤝", label: "취업 면접", description: "면접관과 질의응답" },
  { id: "blind_date", emoji: "💕", label: "소개팅", description: "처음 만난 사람과 자연스럽게 대화" },
  { id: "airport", emoji: "✈️", label: "공항 / 여행", description: "체크인, 탑승, 길 묻기" },
  { id: "hotel", emoji: "🏨", label: "호텔 체크인", description: "예약 확인 및 체크인/아웃" },
  { id: "shopping", emoji: "🛍️", label: "쇼핑", description: "옷 가게에서 사이즈, 가격 묻기" },
  { id: "phone_call", emoji: "📞", label: "전화 통화", description: "전화로 예약하거나 문의하기" },
  { id: "free", emoji: "✨", label: "자유 대화", description: "주제 제한 없이 자유롭게 대화" },
];

const LANG_MAP: Record<string, string> = {
  en: "en-US", ja: "ja-JP", zh: "zh-CN", ko: "ko-KR",
  es: "es-ES", fr: "fr-FR", de: "de-DE",
};

const RANDOM_NAMES: Record<string, { male: string[]; female: string[] }> = {
  en: { male: ["James", "Oliver", "Ethan", "Liam", "Noah", "Lucas", "Mason", "Logan"], female: ["Emma", "Sophia", "Olivia", "Ava", "Mia", "Isabella", "Charlotte", "Amelia"] },
  ja: { male: ["太郎", "健太", "翔太", "大輝", "蓮", "悠真", "陽斗", "颯太"], female: ["花子", "美咲", "さくら", "結衣", "陽菜", "凛", "楓", "芽依"] },
  zh: { male: ["伟明", "浩然", "子轩", "明辉", "志强", "建国", "天宇", "俊杰"], female: ["美玲", "小红", "雨萱", "紫涵", "欣怡", "思琪", "语嫣", "梦洁"] },
  ko: { male: ["민준", "서준", "예준", "도윤", "시우", "주원", "하준", "지호"], female: ["서연", "서윤", "지우", "하은", "하윤", "민서", "지유", "채원"] },
  es: { male: ["Carlos", "Miguel", "Diego", "Alejandro", "Pablo", "Javier", "Luis", "Mateo"], female: ["María", "Sofía", "Valentina", "Lucía", "Isabella", "Camila", "Elena", "Paula"] },
  fr: { male: ["Lucas", "Hugo", "Louis", "Gabriel", "Raphaël", "Arthur", "Léo", "Jules"], female: ["Emma", "Jade", "Louise", "Alice", "Chloé", "Léa", "Manon", "Inès"] },
  de: { male: ["Felix", "Leon", "Paul", "Lukas", "Maximilian", "Elias", "Noah", "Ben"], female: ["Emma", "Mia", "Hannah", "Sophia", "Lina", "Emilia", "Ella", "Marie"] },
};

const getRandomName = (lang: string, gender: "male" | "female") => {
  const names = RANDOM_NAMES[lang] || RANDOM_NAMES.en;
  const list = names[gender];
  return list[Math.floor(Math.random() * list.length)];
};

const SpeakingPage = () => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [profile, setProfile] = useState<{ target_language: string; native_language: string; current_level: string } | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [speakingSessionId] = useState(() => `speaking_${crypto.randomUUID()}`);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persona & scenario
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);
  const [callerName, setCallerName] = useState<string>("");

  // Setup step
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [occupation, setOccupation] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);

  const targetLang = LANG_MAP[profile?.target_language || "en"] || "en-US";
  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition(targetLang);
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechSynthesis(targetLang);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("target_language, native_language, current_level").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiLoading]);

  useEffect(() => {
    if (transcript && !isListening) {
      sendMessage(transcript);
      resetTranscript();
    }
  }, [transcript, isListening]);

  // Call duration timer
  useEffect(() => {
    if (phase === "call") {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [phase]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const saveMessageToDB = useCallback(async (role: string, content: string) => {
    if (!user) return;
    try {
      await supabase.from("chat_messages").insert({
        user_id: user.id, role, content, session_id: speakingSessionId,
      });
    } catch { /* silent */ }
  }, [user, speakingSessionId]);

  const saveCorrectionCards = useCallback(async (corrections: Correction[]) => {
    if (!user || corrections.length === 0) return;
    const cardsToInsert = corrections.map((c) => ({
      user_id: user.id,
      native_text: `${c.wrong} → ${c.correct}`,
      target_text: c.correct,
      context: `📞 스피킹 교정: ${c.explanation || ""}\n원문: ${c.wrong}`,
      difficulty: 1,
      ease_factor: 2.5,
      interval_days: 1,
      review_count: 0,
      next_review_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("srs_cards").insert(cardsToInsert);
    if (!error) {
      toast(`📝 교정 ${corrections.length}건이 복습 카드에 저장됨`, { icon: "✅" });
    }
  }, [user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isAiLoading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsAiLoading(true);

    // Save user message to DB
    saveMessageToDB("user", text);

    try {
      const { data, error } = await supabase.functions.invoke("speaking", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          targetLanguage: profile?.target_language || "en",
          nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner",
          scenario: scenario?.id || "free",
          persona: persona ? { gender: persona.gender, occupation: persona.occupation, personality: persona.personality } : undefined,
          callerName: callerName || undefined,
        },
      });
      if (error) throw error;
      const corrections: Correction[] = data.corrections || [];
      const aiMsg: Message = { role: "assistant", content: data.content, corrections };
      setMessages((prev) => [...prev, aiMsg]);

      // Save assistant message to DB
      saveMessageToDB("assistant", data.content);

      // Auto-save corrections as SRS cards
      if (corrections.length > 0) {
        saveCorrectionCards(corrections);
      }

      if (autoSpeak && data.content) {
        setTimeout(() => speak(data.content), 300);
      }
    } catch (e: any) {
      console.error("Speaking error:", e);
      toast.error(e?.message || "AI 응답에 실패했어요");
    } finally {
      setIsAiLoading(false);
    }
  }, [messages, profile, scenario, persona, autoSpeak, speak, isAiLoading, saveMessageToDB, saveCorrectionCards, callerName]);

  const startCall = useCallback(async () => {
    setPhase("call");
    setMessages([]);
    setFeedback(null);
    setIsAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("speaking", {
        body: {
          messages: [{ role: "user", content: "The phone is ringing and I just answered. Start the conversation as the caller." }],
          targetLanguage: profile?.target_language || "en",
          nativeLanguage: profile?.native_language || "ko",
          level: profile?.current_level || "beginner",
          scenario: scenario?.id || "free",
          persona: persona ? { gender: persona.gender, occupation: persona.occupation, personality: persona.personality } : undefined,
          callerName: callerName || undefined,
        },
      });
      if (error) throw error;
      const aiMsg: Message = { role: "assistant", content: data.content, corrections: [] };
      setMessages([aiMsg]);
      saveMessageToDB("assistant", data.content);
      if (autoSpeak && data.content) {
        setTimeout(() => speak(data.content), 300);
      }
    } catch (e: any) {
      toast.error("통화를 시작할 수 없어요");
    } finally {
      setIsAiLoading(false);
    }
  }, [profile, autoSpeak, speak, scenario, persona]);

  const showIncomingCall = () => {
    if (!gender || !occupation || !personality) return;
    const p: Persona = { gender: gender!, occupation: occupation!, personality: personality! };
    setPersona(p);
    const name = getRandomName(profile?.target_language || "en", gender);
    setCallerName(name);
    setPhase("incoming");
    // Auto-timeout: if user doesn't answer in 15s, go back
    setTimeout(() => {
      setPhase((current) => current === "incoming" ? "setup" : current);
    }, 15000);
  };

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
        if (user) {
          const userMsgCount = messages.filter((m) => m.role === "user").length;
          const score = data.feedback.overallScore || 50;
          const pointsEarned = Math.max(5, Math.round(userMsgCount * 3 * (score / 100)));
          const petXpEarned = Math.max(3, Math.round(userMsgCount * 2 * (score / 100)));

          const { data: pointsData } = await supabase.from("user_points").select("*").eq("user_id", user.id).maybeSingle();
          if (pointsData) {
            await supabase.from("user_points").update({ balance: (pointsData as any).balance + pointsEarned }).eq("id", (pointsData as any).id);
          } else {
            await supabase.from("user_points").insert({ user_id: user.id, balance: pointsEarned });
          }
          await supabase.from("point_transactions").insert({ user_id: user.id, amount: pointsEarned, type: "speaking", description: `스피킹 연습 완료 (점수: ${score})` });

          const { data: petData } = await supabase.from("user_pets").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle();
          if (petData) {
            const LEVEL_THRESHOLDS = Array.from({ length: 30 }, (_, i) => Math.round(100 * Math.pow(1.2, i)));
            let newExp = (petData as any).experience + petXpEarned;
            let newLevel = (petData as any).level;
            let newExpToNext = (petData as any).exp_to_next_level;
            while (newExp >= newExpToNext && newLevel < 30) {
              newExp -= newExpToNext;
              newLevel++;
              newExpToNext = LEVEL_THRESHOLDS[newLevel - 1] || 99999;
            }
            await supabase.from("user_pets").update({ experience: newExp, level: newLevel, exp_to_next_level: newExpToNext }).eq("id", (petData as any).id);
          }
          toast.success(`🎉 ${pointsEarned}P 획득! 펫 경험치 +${petXpEarned}`);
        }
      } else {
        toast.error("피드백을 생성할 수 없어요");
      }
    } catch (e: any) {
      console.error("Feedback error:", e);
      toast.error(e?.message || "피드백 생성에 실패했어요");
    } finally {
      setIsFeedbackLoading(false);
      setPhase("feedback");
    }
  }, [messages, profile, stopSpeaking, user]);

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

  const resetToSetup = () => {
    setPhase("setup");
    setMessages([]);
    setFeedback(null);
    setPersona(null);
    setScenario(null);
    setCallerName("");
    stopSpeaking();
  };

  const canProceedStep1 = gender && occupation && personality;

  // ──── Setup Phase ────
  if (phase === "setup") {
    return (
      <AppLayout>
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">스피킹 연습 📞</h1>
          <p className="text-sm text-muted-foreground font-semibold mb-5">
            페르소나를 설정하면 전화가 걸려와요!
          </p>
        </motion.div>

        {!isSupported && (
          <div className="duo-card bg-destructive/10 border-destructive/30 mb-4">
            <p className="text-sm font-bold text-destructive">⚠️ 이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요.</p>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2].map((s) => (
            <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${setupStep >= s ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {setupStep === 1 && (
            <motion.div key="s1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
              <div className="text-center mb-2">
                <User size={28} className="mx-auto text-primary mb-1" />
                <h2 className="text-lg font-extrabold text-foreground">통화 상대 설정</h2>
                <p className="text-xs text-muted-foreground font-semibold">전화를 걸어올 AI 상대를 설정하세요</p>
              </div>

              {/* Gender */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">성별</p>
                <div className="grid grid-cols-2 gap-2">
                  {([["male", "👨 남성"], ["female", "👩 여성"]] as const).map(([g, label]) => (
                    <button key={g} onClick={() => setGender(g)} className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${gender === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Occupation */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">직업</p>
                <div className="flex flex-wrap gap-2">
                  {OCCUPATIONS.map((o) => (
                    <button key={o} onClick={() => setOccupation(o)} className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${occupation === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">성격</p>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITIES.map((p) => (
                    <button key={p} onClick={() => setPersonality(p)} className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${personality === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setSetupStep(2)} disabled={!canProceedStep1} className="duo-btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40">
                다음 →
              </button>
            </motion.div>
          )}

          {setupStep === 2 && (
            <motion.div key="s2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="space-y-4">
              <div className="text-center mb-2">
                <Phone size={28} className="mx-auto text-primary mb-1" />
                <h2 className="text-lg font-extrabold text-foreground">통화 상황 선택</h2>
                <p className="text-xs text-muted-foreground font-semibold">어떤 상황으로 전화가 올까요?</p>
              </div>

              <button onClick={() => setSetupStep(1)} className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                ← 페르소나 수정
              </button>

              {/* Persona summary */}
              <div className="duo-card py-2 px-3 flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground">{gender === "male" ? "👨" : "👩"} {occupation}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-muted-foreground">{personality}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto pb-2">
                {SCENARIOS.map((s) => (
                  <button key={s.id} onClick={() => setScenario(s)} className={`p-3 rounded-xl border-2 text-left transition-all ${scenario?.id === s.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
                    <div className="text-xl mb-1">{s.emoji}</div>
                    <div className="text-xs font-bold text-foreground">{s.label}</div>
                    <div className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5">{s.description}</div>
                  </button>
                ))}
              </div>

              <button onClick={showIncomingCall} disabled={!scenario} className="duo-btn-primary w-full py-3 font-bold disabled:opacity-40">
                📞 전화 받기 준비
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </AppLayout>
    );
  }

  // ──── Incoming Call Phase ────
  if (phase === "incoming") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] relative">
          {/* Pulse rings */}
          <div className="relative mb-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                style={{ width: 120 + i * 40, height: 120 + i * 40, left: -(10 + i * 20), top: -(10 + i * 20) }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
              />
            ))}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-24 h-24 rounded-full bg-primary/10 border-4 border-primary flex items-center justify-center"
            >
              <span className="text-4xl">{persona?.gender === "male" ? "👨" : "👩"}</span>
            </motion.div>
          </div>

          {/* Contact Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="duo-card w-full max-w-[280px] p-4 mb-4"
          >
            <div className="text-center">
              <p className="text-xl font-extrabold text-foreground mb-0.5">{callerName}</p>
              <p className="text-sm font-bold text-primary">{persona?.occupation}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-bold text-muted-foreground">
                  {persona?.personality}
                </span>
              </div>
            </div>
            <div className="border-t border-border mt-3 pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">상황</span>
                <span className="font-bold text-foreground">{scenario?.emoji} {scenario?.label}</span>
              </div>
            </div>
          </motion.div>

          <motion.p
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-sm font-bold text-primary mb-6"
          >
            📞 전화가 오고 있어요...
          </motion.p>

          <div className="flex items-center gap-6">
            {/* Decline */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={resetToSetup}
              className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg"
            >
              <PhoneOff size={28} className="text-destructive-foreground" />
            </motion.button>

            {/* Accept */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              onClick={startCall}
              className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg"
            >
              <Phone size={32} className="text-primary-foreground" />
            </motion.button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ──── Feedback Phase ────
  if (phase === "feedback" && feedback) {
    return (
      <AppLayout>
        <SpeakingFeedback
          feedback={feedback}
          onClose={resetToSetup}
          callInfo={persona && scenario ? {
            callerName,
            gender: persona.gender,
            occupation: persona.occupation,
            personality: persona.personality,
            scenarioLabel: scenario.label,
            scenarioEmoji: scenario.emoji,
            durationSeconds: callDuration,
          } : undefined}
        />
      </AppLayout>
    );
  }

  // ──── Call Phase ────
  return (
    <AppLayout>
      {/* Call Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { resetToSetup(); }} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
              <span className="text-lg">{persona?.gender === "male" ? "👨" : "👩"}</span>
            </div>
            <div>
              <h2 className="font-extrabold text-foreground text-sm">{callerName}</h2>
              <p className="text-[11px] text-muted-foreground font-semibold">
                {persona?.occupation} · {scenario?.emoji} {scenario?.label}
              </p>
              <div className="flex items-center gap-1.5">
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-primary">{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoSpeak(!autoSpeak)} className={`p-2 rounded-xl transition-colors ${autoSpeak ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={endConversation} disabled={isFeedbackLoading || messages.length < 2} className="p-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-40">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>

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
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border-2 border-border text-foreground rounded-bl-md"}`}>
                <p className="text-sm font-semibold whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && (
                  <button onClick={() => replayMessage(msg.content)} className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors">
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
              onClick={handleMicClick}
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
    </AppLayout>
  );
};

export default SpeakingPage;
