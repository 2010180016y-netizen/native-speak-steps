import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, BookOpen, Check, MessageSquare, Shield } from "lucide-react";
import { toast } from "sonner";
import DialogueRolePlay, { type DialogueLine } from "@/components/dialogue/DialogueRolePlay";
import AnalysisDashboard, { type TextAnalysis } from "@/components/analysis/AnalysisDashboard";
import { analyzeTextContent, maskSensitiveData, splitIntoChunks } from "@/lib/textProcessor";

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
  const [result, setResult] = useState<{ wordCount: number; uniqueWords: number; speakers: string[] } | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [detailedAnalysis, setDetailedAnalysis] = useState<TextAnalysis | null>(null);
  const [analyzingDetail, setAnalyzingDetail] = useState(false);

  // Dialogue state
  const [splittingDialogue, setSplittingDialogue] = useState(false);
  const [dialogueSpeakers, setDialogueSpeakers] = useState<string[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [showRolePlay, setShowRolePlay] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim() || !user || !profile) return;
    setAnalyzing(true);
    setGeneratedCards([]);
    setCardsSaved(false);
    setDialogueSpeakers([]);
    setDialogueLines([]);
    setDetailedAnalysis(null);

    try {
      // Use the new text processor for accurate analysis
      const analysis = analyzeTextContent(text);
      setResult({
        wordCount: analysis.wordCount,
        uniqueWords: analysis.uniqueWords,
        speakers: analysis.speakers,
      });

      // Save import with masked text for privacy
      const { error } = await supabase.from("language_imports").insert({
        user_id: user.id,
        source_type: "text",
        content: analysis.maskedText, // Store masked version
        word_count: analysis.wordCount,
        unique_words: analysis.uniqueWords,
      });
      if (error) throw error;

      toast.success(`${analysis.wordCount}개 단어 분석 완료! 🎉`);

      // For large texts, split into chunks and analyze
      const chunks = splitIntoChunks(analysis.maskedText, 10000);
      const textToAnalyze = chunks.length > 1 
        ? `[총 ${chunks.length}개 청크 중 대표 분석]\n${chunks[0]}`
        : analysis.maskedText;

      // Start detailed AI analysis
      setAnalyzingDetail(true);
      const detailPromise = supabase.functions.invoke("analyze-text", {
        body: {
          text: textToAnalyze,
          nativeLanguage: LANG_NAMES[profile.native_language] || profile.native_language,
          targetLanguage: LANG_NAMES[profile.target_language] || profile.target_language,
          totalWordCount: analysis.wordCount,
          totalUniqueWords: analysis.uniqueWords,
          speakerNames: analysis.speakers, // Pass speaker names to exclude
        },
      }).then(({ data, error: err }) => {
        if (!err && data) {
          setDetailedAnalysis(data as TextAnalysis);
          // Update the import with analysis result
          supabase.from("language_imports")
            .update({ analysis_result: data })
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);
        }
        setAnalyzingDetail(false);
      }).catch(() => setAnalyzingDetail(false));

      // Generate SRS cards via AI (use cleaned text)
      setGeneratingCards(true);
      const { data, error: fnError } = await supabase.functions.invoke("generate-cards", {
        body: {
          text: analysis.cleanedText.slice(0, 5000), // Use cleaned text
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

      await detailPromise;
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
      // Mask sensitive data before sending
      const maskedText = maskSensitiveData(text);
      
      const { data, error } = await supabase.functions.invoke("split-dialogue", {
        body: {
          text: maskedText.slice(0, 8000), // Increased limit
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

  const handleRolePlayComplete = async (completedCount: number, totalCount: number) => {
    if (!user) return;
    const ratio = completedCount / totalCount;
    const pointsEarned = Math.max(5, Math.round(completedCount * 2 * ratio));
    const petXpEarned = Math.max(3, Math.round(completedCount * 1.5 * ratio));

    try {
      const { data: pointsData } = await supabase
        .from("user_points")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pointsData) {
        await supabase
          .from("user_points")
          .update({ balance: (pointsData as any).balance + pointsEarned })
          .eq("id", (pointsData as any).id);
      } else {
        await supabase
          .from("user_points")
          .insert({ user_id: user.id, balance: pointsEarned });
      }

      await supabase.from("point_transactions").insert({
        user_id: user.id,
        amount: pointsEarned,
        type: "roleplay",
        description: `역할 분리 연습 완료 (${completedCount}/${totalCount})`,
      });

      const { data: petData } = await supabase
        .from("user_pets")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

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

        await supabase
          .from("user_pets")
          .update({ experience: newExp, level: newLevel, exp_to_next_level: newExpToNext })
          .eq("id", (petData as any).id);
      }

      toast.success(`🎉 ${pointsEarned}P 획득! 펫 경험치 +${petXpEarned}`);
    } catch (e) {
      console.error("Reward error:", e);
    }
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
          onComplete={handleRolePlayComplete}
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

        {/* Privacy notice */}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Shield size={14} className="text-primary" />
          <span>전화번호, 이메일 등 민감한 정보는 자동으로 마스킹됩니다</span>
        </div>

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

      {/* Detected speakers */}
      {result && result.speakers && result.speakers.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mt-4 p-3 rounded-xl bg-muted/50 border border-border"
        >
          <p className="text-xs font-bold text-muted-foreground mb-1">
            감지된 화자 (단어 수에서 제외됨)
          </p>
          <div className="flex flex-wrap gap-2">
            {result.speakers.map((speaker, i) => (
              <span key={i} className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                {speaker}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Detailed Analysis Dashboard */}
      {analyzingDetail && !detailedAnalysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="duo-card mt-6 flex items-center justify-center gap-3 py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="font-bold text-muted-foreground">AI가 텍스트를 심층 분석 중...</span>
        </motion.div>
      )}

      {detailedAnalysis && result && (
        <AnalysisDashboard
          analysis={detailedAnalysis}
          wordCount={result.wordCount}
          uniqueWords={result.uniqueWords}
        />
      )}

      {/* Basic result (shown only if no detailed analysis yet) */}
      {result && !detailedAnalysis && !analyzingDetail && (
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
