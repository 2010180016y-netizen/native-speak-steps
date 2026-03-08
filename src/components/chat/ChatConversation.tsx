import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Send, Loader2, ThumbsUp, ThumbsDown, Clock, Flag,
  Target, CheckCircle2, Sparkles, Mic, MicOff, Volume2, VolumeX,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Persona, ChatScenario } from "@/components/chat/ChatSetup";
import type { ChatMessage } from "@/lib/chatTypes";
import type { MiniMission } from "@/lib/chatScenarioData";

interface ChatConversationProps {
  persona: Persona;
  scenario: ChatScenario;
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  missions: MiniMission[];
  completedMissions: Set<string>;
  starters: string[];
  // Speech
  isListening: boolean;
  interimTranscript: string;
  isSpeaking: boolean;
  sttSupported: boolean;
  playingIndex: number | null;
  // Callbacks
  onInputChange: (value: string) => void;
  onSend: () => void;
  onEndChat: () => void;
  onStarterClick: (text: string) => void;
  onMicToggle: () => void;
  onTTS: (text: string, index: number) => void;
  onRating: (msgIndex: number, rating: -1 | 1) => void;
}

const ChatConversation = ({
  persona, scenario, messages, loading, input,
  missions, completedMissions, starters,
  isListening, interimTranscript, isSpeaking, sttSupported, playingIndex,
  onInputChange, onSend, onEndChat, onStarterClick, onMicToggle, onTTS, onRating,
}: ChatConversationProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">
              {scenario.emoji} {scenario.label}
            </h1>
            <p className="text-xs text-muted-foreground font-semibold">
              {persona.gender === "male" ? "👨" : "👩"} {persona.occupation} · {persona.personality}
            </p>
          </div>
          <button
            onClick={onEndChat}
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

      {/* Messages area */}
      <div className="space-y-3 mb-4 min-h-[30vh]">
        {/* Empty state with starter prompts */}
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="bg-card rounded-2xl border border-border p-5 text-center shadow-sm">
              <div className="text-3xl mb-2">{scenario.emoji}</div>
              <p className="font-bold text-foreground text-sm mb-1">대화를 시작해 보세요!</p>
              <p className="text-xs text-muted-foreground font-semibold">{scenario.description}</p>
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
                      onClick={() => onStarterClick(text)}
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

            {/* Correction cards */}
            {msg.role === "assistant" && msg.corrections && msg.corrections.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[85%] mt-1.5 space-y-1.5"
              >
                {msg.corrections.map((c, ci) => (
                  <div
                    key={ci}
                    className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px]"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold mt-px">✏️</span>
                      <div className="flex-1 min-w-0">
                        <span className="line-through text-destructive/70 font-semibold">{c.wrong}</span>
                        <span className="mx-1.5 text-muted-foreground">→</span>
                        <span className="text-primary font-bold">{c.correct}</span>
                        {c.explanation && (
                          <p className="text-muted-foreground font-medium mt-0.5">{c.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 mt-1 px-1">
                <button
                  onClick={() => onTTS(msg.content, i)}
                  className={`p-1 rounded-md transition-colors ${
                    isSpeaking && playingIndex === i ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="음성으로 듣기"
                >
                  {isSpeaking && playingIndex === i ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
                {msg.responseTimeMs != null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-semibold">
                    <Clock size={10} />{(msg.responseTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
                {msg.feedbackId && (
                  <>
                    <button
                      onClick={() => onRating(i, 1)}
                      className={`p-1 rounded-md transition-colors ${
                        msg.rating === 1 ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    ><ThumbsUp size={12} /></button>
                    <button
                      onClick={() => onRating(i, -1)}
                      className={`p-1 rounded-md transition-colors ${
                        msg.rating === -1 ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:text-foreground"
                      }`}
                    ><ThumbsDown size={12} /></button>
                  </>
                )}
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
        {isListening && interimTranscript && (
          <div className="max-w-lg mx-auto mb-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-xs font-semibold text-primary truncate">
            🎤 {interimTranscript}
          </div>
        )}
        <div className="max-w-lg mx-auto flex gap-2">
          {sttSupported && (
            <button
              onClick={onMicToggle}
              className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                isListening
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-card border-2 border-border text-muted-foreground hover:text-foreground hover:border-primary"
              }`}
              title={isListening ? "음성 입력 중지" : "음성으로 입력"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
            placeholder={isListening ? "듣고 있어요..." : "메시지를 입력하세요..."}
            className="flex-1 px-4 py-3 rounded-2xl border-2 border-border bg-card text-foreground font-semibold focus:border-primary focus:outline-none transition-colors"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="duo-btn-primary px-4 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatConversation;
