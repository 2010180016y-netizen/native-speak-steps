import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, BookOpen, Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import DialogueRolePlay, { type DialogueLine } from "@/components/dialogue/DialogueRolePlay";

const LANG_NAMES: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
  es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
};

type GeneratedCard = {
  native_text: string;
  target_text: string;
  context: string;
};

const ImportPage = () => {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [cardsSaved, setCardsSaved] = useState(false);
  const [result, setResult] = useState<{ wordCount: number; uniqueWords: number } | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);

  // Dialogue state
  const [splittingDialogue, setSplittingDialogue] = useState(false);
  const [dialogueSpeakers, setDialogueSpeakers] = useState<string[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [showRolePlay, setShowRolePlay] = useState(false);

  const analyzeText = (content: string) => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    const unique = new Set(words);
    return { wordCount: words.length, uniqueWords: unique.size };
  };

  const handleAnalyze = async () => {
    if (!text.trim() || !user || !profile) return;
    setAnalyzing(true);
    setGeneratedCards([]);
    setCardsSaved(false);
    setDialogueSpeakers([]);
    setDialogueLines([]);

    try {
      const analysis = analyzeText(text);
      setResult(analysis);

      // Save import
      const { error } = await supabase.from("language_imports").insert({
        user_id: user.id,
        source_type: "text",
        content: text.slice(0, 5000),
        word_count: analysis.wordCount,
        unique_words: analysis.uniqueWords,
      });
      if (error) throw error;

      toast.success(`${analysis.wordCount}개 단어 분석 완료! 🎉`);

      // Generate SRS cards via AI
      setGeneratingCards(true);
      const { data, error: fnError } = await supabase.functions.invoke("generate-cards", {
        body: {
          text: text.slice(0, 3000),
          nativeLanguage: LANG_NAMES[profile.native_language] || profile.native_language,
          targetLanguage: LANG_NAMES[profile.target_language] || profile.target_language,
          level: profile.current_level,
        },
      });

      if (fnError) throw fnError;

      const cards: GeneratedCard[] = data?.cards || [];
      if (cards.length > 0) {
        setGeneratedCards(cards);
        toast.success(`${cards.length}개 학습 카드가 생성되었어요! 📚`);
      }
    } catch (err) {
      console.error(err);
      toast.error("분석에 실패했습니다");
    } finally {
      setAnalyzing(false);
      setGeneratingCards(false);
    }
  };

  const handleSplitDialogue = async () => {
    if (!text.trim() || !profile) return;
    setSplittingDialogue(true);

    try {
      const { data, error } = await supabase.functions.invoke("split-dialogue", {
        body: {
          text: text.slice(0, 5000),
          nativeLanguage: profile.native_language,
          targetLanguage: profile.target_language,
        },
      });

      if (error) throw error;

      if (!data.is_dialogue || data.lines.length < 2) {
        toast.error("대화문이 감지되지 않았어요. 대화 형식의 텍스트를 입력해주세요.");
        return;
      }

      setDialogueSpeakers(data.speakers);
      setDialogueLines(data.lines);
      setShowRolePlay(true);
      toast.success(`${data.speakers.length}명의 화자, ${data.lines.length}개 대사를 분리했어요! 🎭`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "대화 분리에 실패했어요");
    } finally {
      setSplittingDialogue(false);
    }
  };

  const handleSaveCards = async () => {
    if (!user || generatedCards.length === 0) return;

    try {
      const cardsToInsert = generatedCards.map((card) => ({
        user_id: user.id,
        native_text: card.native_text,
        target_text: card.target_text,
        context: card.context,
      }));

      const { error } = await supabase.from("srs_cards").insert(cardsToInsert);
      if (error) throw error;

      setCardsSaved(true);
      toast.success("카드가 저장되었어요! 복습 탭에서 확인하세요 ✅");
    } catch {
      toast.error("카드 저장에 실패했습니다");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target?.result as string);
    reader.readAsText(file);
  };

  // Role play view
  if (showRolePlay && dialogueLines.length > 0) {
    return (
      <AppLayout>
        <DialogueRolePlay
          speakers={dialogueSpeakers}
          lines={dialogueLines}
          targetLang={profile?.target_language || "en"}
          onClose={() => setShowRolePlay(false)}
          onLinesUpdate={(updated) => setDialogueLines(updated)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">모국어 분석</h1>
        <p className="text-sm text-muted-foreground font-semibold mb-6">
          대화를 입력하면 학습 카드를 자동으로 만들어 드려요
        </p>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"카카오톡 대화, 드라마 대본, 일기 등을 붙여넣어 보세요...\n\n예시:\nA: Hello, can I get a coffee?\nB: Sure! What size would you like?\nA: A large latte, please."}
          className="w-full h-48 px-4 py-3 rounded-2xl border-2 border-border bg-card text-foreground font-semibold resize-none focus:border-primary focus:outline-none transition-colors"
        />

        <div className="flex gap-3 mt-4">
          <label className="flex-1 duo-card flex items-center justify-center gap-2 p-3 cursor-pointer hover:scale-[1.01] transition-transform">
            <FileText size={18} className="text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">파일 업로드</span>
            <input type="file" accept=".txt,.csv,.json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={handleAnalyze}
            disabled={!text.trim() || analyzing || generatingCards}
            className="duo-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {analyzing || generatingCards ? (
              <><Loader2 size={18} className="animate-spin" /> {generatingCards ? "카드 생성..." : "분석..."}</>
            ) : (
              <><Upload size={18} /> 분석 + 카드</>
            )}
          </button>

          <button
            onClick={handleSplitDialogue}
            disabled={!text.trim() || splittingDialogue}
            className="duo-btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {splittingDialogue ? (
              <><Loader2 size={18} className="animate-spin" /> 분리 중...</>
            ) : (
              <><MessageSquare size={18} /> 역할 분리 연습</>
            )}
          </button>
        </div>
      </motion.div>

      {/* Analysis Result */}
      {result && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="duo-card mt-6">
          <h3 className="font-bold text-foreground mb-4">📊 분석 결과</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-primary">{result.wordCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-semibold mt-1">총 단어 수</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-duo-blue">{result.uniqueWords.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-semibold mt-1">고유 단어 수</div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-primary/10">
            <p className="text-sm font-semibold text-foreground">
              💡 약 <strong>{result.uniqueWords}</strong>개의 고유 단어를 사용해요.
              같은 수준으로 외국어를 배우면 일상 대화가 가능합니다!
            </p>
          </div>
        </motion.div>
      )}

      {/* Generated Cards */}
      <AnimatePresence>
        {generatedCards.length > 0 && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <BookOpen size={18} className="text-duo-blue" />
                생성된 학습 카드 ({generatedCards.length})
              </h3>
            </div>

            <div className="space-y-3">
              {generatedCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="duo-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{card.native_text}</p>
                      <p className="text-sm font-extrabold text-primary mt-1">{card.target_text}</p>
                      {card.context && (
                        <p className="text-xs text-muted-foreground font-semibold mt-2">💬 {card.context}</p>
                      )}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-2 py-1">
                      #{i + 1}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {!cardsSaved ? (
              <button
                onClick={handleSaveCards}
                className="duo-btn-secondary w-full mt-4 flex items-center justify-center gap-2"
              >
                <BookOpen size={20} /> 모든 카드 저장하기
              </button>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-4 p-4 rounded-2xl bg-primary/10 flex items-center justify-center gap-2"
              >
                <Check size={20} className="text-primary" />
                <span className="font-bold text-primary">저장 완료! 복습 탭에서 학습하세요</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default ImportPage;
