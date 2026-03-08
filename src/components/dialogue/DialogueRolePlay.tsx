import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, SkipForward, Volume2, Mic, MicOff, Check, RotateCcw, Edit3 } from "lucide-react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { toast } from "sonner";

export type DialogueLine = {
  speaker: string;
  text: string;
};

type Props = {
  speakers: string[];
  lines: DialogueLine[];
  targetLang: string;
  onClose: () => void;
  onLinesUpdate?: (lines: DialogueLine[]) => void;
  onComplete?: (completedCount: number, totalCount: number) => void;
};

const LANG_MAP: Record<string, string> = {
  en: "en-US", ja: "ja-JP", zh: "zh-CN", ko: "ko-KR",
  es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR",
};

const SPEAKER_COLORS = [
  "bg-primary/15 border-primary/30 text-primary",
  "bg-blue-500/15 border-blue-500/30 text-blue-600",
  "bg-amber-500/15 border-amber-500/30 text-amber-600",
  "bg-emerald-500/15 border-emerald-500/30 text-emerald-600",
];

const DialogueRolePlay = ({ speakers, lines, targetLang, onClose, onLinesUpdate, onComplete }: Props) => {
  const [myRole, setMyRole] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedLines, setCompletedLines] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editLines, setEditLines] = useState<DialogueLine[]>(lines);
  const scrollRef = useRef<HTMLDivElement>(null);

  const langCode = LANG_MAP[targetLang] || "en-US";
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechSynthesis(langCode);
  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition(langCode);

  // Auto-scroll to current line
  useEffect(() => {
    const el = document.getElementById(`line-${currentLine}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentLine]);

  // When transcript finalizes for my role
  useEffect(() => {
    if (transcript && !isListening && myRole && lines[currentLine]?.speaker === myRole) {
      setCompletedLines((prev) => new Set(prev).add(currentLine));
      resetTranscript();
      // Auto advance
      if (currentLine < lines.length - 1) {
        setTimeout(() => {
          setCurrentLine((c) => c + 1);
          // If next line is not my role, auto-speak it
          const nextLine = lines[currentLine + 1];
          if (nextLine && nextLine.speaker !== myRole) {
            setTimeout(() => speak(nextLine.text), 400);
          }
        }, 500);
      } else {
        toast.success("대화 연습 완료! 🎉");
      }
    }
  }, [transcript, isListening]);

  const handleSelectRole = (speaker: string) => {
    setMyRole(speaker);
    setCurrentLine(0);
    setCompletedLines(new Set());
    // If first line is not my role, speak it
    if (lines[0]?.speaker !== speaker) {
      setTimeout(() => speak(lines[0].text), 500);
    }
  };

  const handleLineAction = () => {
    if (!myRole) return;
    const line = lines[currentLine];
    if (!line) return;

    if (line.speaker === myRole) {
      // My turn: toggle mic
      if (isListening) {
        stopListening();
      } else {
        if (isSpeaking) stopSpeaking();
        resetTranscript();
        startListening();
      }
    } else {
      // Other's turn: speak it
      if (isSpeaking) {
        stopSpeaking();
      } else {
        speak(line.text);
        setCompletedLines((prev) => new Set(prev).add(currentLine));
        // Auto advance after speaking
        const onEnd = () => {
          if (currentLine < lines.length - 1) {
            setCurrentLine((c) => c + 1);
          }
        };
        setTimeout(onEnd, line.text.length * 80 + 500);
      }
    }
  };

  const handleSkip = () => {
    setCompletedLines((prev) => new Set(prev).add(currentLine));
    if (currentLine < lines.length - 1) {
      const next = currentLine + 1;
      setCurrentLine(next);
      if (myRole && lines[next]?.speaker !== myRole) {
        setTimeout(() => speak(lines[next].text), 300);
      }
    }
  };

  const handlePlayAll = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    setCurrentLine(0);
    playSequence(0);
  };

  const playSequence = (idx: number) => {
    if (idx >= lines.length) {
      setIsPlaying(false);
      return;
    }
    setCurrentLine(idx);
    speak(lines[idx].text);
    setTimeout(() => {
      setCompletedLines((prev) => new Set(prev).add(idx));
      playSequence(idx + 1);
    }, lines[idx].text.length * 80 + 600);
  };

  const handleSaveEdits = () => {
    onLinesUpdate?.(editLines);
    setIsEditing(false);
    toast.success("대화 수정이 저장되었어요 ✅");
  };

  const handleEditSpeaker = (idx: number, newSpeaker: string) => {
    setEditLines((prev) => prev.map((l, i) => i === idx ? { ...l, speaker: newSpeaker } : l));
  };

  const handleEditText = (idx: number, newText: string) => {
    setEditLines((prev) => prev.map((l, i) => i === idx ? { ...l, text: newText } : l));
  };

  const speakerColor = (speaker: string) => {
    const idx = speakers.indexOf(speaker);
    return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
  };

  // Role selection screen
  if (!myRole) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <h2 className="font-extrabold text-foreground text-lg">역할 선택 🎭</h2>
        </div>

        <p className="text-sm text-muted-foreground font-semibold">
          대화에서 연습할 역할을 선택하세요. 상대방 대사는 AI가 읽어줘요!
        </p>

        {/* Preview all lines */}
        <div className="duo-card p-4 max-h-48 overflow-y-auto space-y-2">
          {lines.slice(0, 8).map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${speakerColor(line.speaker)}`}>
                {line.speaker}
              </span>
              <p className="text-xs text-foreground font-semibold">{line.text}</p>
            </div>
          ))}
          {lines.length > 8 && (
            <p className="text-[10px] text-muted-foreground font-semibold text-center">... 외 {lines.length - 8}줄</p>
          )}
        </div>

        {/* Edit toggle */}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <Edit3 size={14} /> 화자/대사 수정하기
        </button>

        {/* Edit mode */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="duo-card p-3 space-y-2 max-h-64 overflow-y-auto">
                {editLines.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={line.speaker}
                      onChange={(e) => handleEditSpeaker(i, e.target.value)}
                      className="text-xs font-bold rounded-lg border border-border bg-card px-2 py-1 w-20 shrink-0"
                    >
                      {speakers.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      value={line.text}
                      onChange={(e) => handleEditText(i, e.target.value)}
                      className="flex-1 text-xs font-semibold rounded-lg border border-border bg-card px-2 py-1"
                    />
                  </div>
                ))}
              </div>
              <button onClick={handleSaveEdits} className="duo-btn-secondary w-full mt-2 text-sm">
                수정 저장
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role buttons */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {speakers.map((speaker) => (
            <motion.button
              key={speaker}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSelectRole(speaker)}
              className={`duo-card p-4 text-center cursor-pointer hover:border-primary transition-colors`}
            >
              <div className="text-3xl mb-2">🎭</div>
              <div className="font-bold text-foreground text-sm">{speaker}</div>
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                {lines.filter((l) => l.speaker === speaker).length}개 대사
              </div>
            </motion.button>
          ))}
        </div>

        {/* Listen all */}
        <button
          onClick={handlePlayAll}
          className="w-full duo-card p-3 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? "멈추기" : "전체 듣기"}
        </button>
      </div>
    );
  }

  // Practice screen
  const isMyTurn = lines[currentLine]?.speaker === myRole;
  const progress = completedLines.size / lines.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMyRole(null)} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div>
            <h2 className="font-extrabold text-foreground text-sm">역할 연습</h2>
            <p className="text-[10px] text-muted-foreground font-semibold">나: {myRole}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setCurrentLine(0); setCompletedLines(new Set()); }} className="p-2 rounded-xl bg-muted text-muted-foreground">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground font-bold text-right">
        {completedLines.size}/{lines.length} 완료
      </p>

      {/* Dialogue lines */}
      <div ref={scrollRef} className="space-y-2 max-h-[45vh] overflow-y-auto pb-4">
        {lines.map((line, i) => {
          const isMine = line.speaker === myRole;
          const isCurrent = i === currentLine;
          const isCompleted = completedLines.has(i);

          return (
            <motion.div
              key={i}
              id={`line-${i}`}
              animate={isCurrent ? { scale: 1.02 } : { scale: 1 }}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 border-2 transition-all ${
                  isCurrent
                    ? isMine
                      ? "border-primary bg-primary/10"
                      : "border-blue-500 bg-blue-500/10"
                    : isCompleted
                    ? "border-border/50 bg-muted/50 opacity-60"
                    : "border-border bg-card opacity-40"
                } ${isMine ? "rounded-br-md" : "rounded-bl-md"}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${speakerColor(line.speaker)}`}>
                    {line.speaker}
                  </span>
                  {isCompleted && <Check size={10} className="text-primary" />}
                </div>
                <p className={`text-sm font-semibold ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                  {isMine && isCurrent && !isCompleted ? "🎤 내 차례! 말해보세요" : line.text}
                </p>
                {isMine && isCompleted && (
                  <p className="text-xs text-foreground font-semibold mt-1">{line.text}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Interim transcript */}
      <AnimatePresence>
        {(isListening || interimTranscript) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-card border-2 border-primary/30 rounded-2xl px-4 py-2.5 text-center"
          >
            <p className="text-sm font-semibold text-foreground">
              {interimTranscript || <span className="text-muted-foreground">듣고 있어요... 🎧</span>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={handleSkip}
          disabled={currentLine >= lines.length}
          className="p-3 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        >
          <SkipForward size={20} />
        </button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLineAction}
          disabled={currentLine >= lines.length || (!isSupported && isMyTurn)}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40 ${
            isMyTurn
              ? isListening
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
              : isSpeaking
              ? "bg-blue-500 text-white"
              : "bg-blue-500 text-white"
          }`}
        >
          {isMyTurn ? (
            isListening ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <MicOff size={28} />
              </motion.div>
            ) : (
              <Mic size={28} />
            )
          ) : isSpeaking ? (
            <Pause size={28} />
          ) : (
            <Volume2 size={28} />
          )}
        </motion.button>

        <div className="w-11" /> {/* Spacer for symmetry */}
      </div>

      <p className="text-center text-[11px] font-semibold text-muted-foreground">
        {isMyTurn ? "마이크를 눌러 말해보세요" : "재생 버튼을 눌러 들어보세요"}
      </p>
    </div>
  );
};

export default DialogueRolePlay;
