import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRecordActivity } from "@/hooks/useRecordActivity";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { invokeAi, toastAiError } from "@/lib/ai";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, BookOpen, Check, MessageSquare, Shield, Plus, History } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import DialogueRolePlay, { type DialogueLine } from "@/components/dialogue/DialogueRolePlay";
import AnalysisDashboard, { type TextAnalysis } from "@/components/analysis/AnalysisDashboard";
import ImportLearningFlow from "@/components/import/ImportLearningFlow";
import { analyzeTextContent, maskSensitiveData } from "@/lib/textProcessor";

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
  const { user, profile, updateProfile } = useAuth();
  const recordActivity = useRecordActivity();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [cardsSaved, setCardsSaved] = useState(false);
  const [result, setResult] = useState<{ wordCount: number; uniqueWords: number; speakers: string[] } | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [detailedAnalysis, setDetailedAnalysis] = useState<TextAnalysis | null>(null);
  const [analyzingDetail, setAnalyzingDetail] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(true);

  // Dialogue state
  const [splittingDialogue, setSplittingDialogue] = useState(false);
  const [dialogueSpeakers, setDialogueSpeakers] = useState<string[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [showRolePlay, setShowRolePlay] = useState(false);
  const [rolePlayId, setRolePlayId] = useState("");

  // Load previous analysis on mount
  useEffect(() => {
    if (!user) return;
    const loadPreviousAnalysis = async () => {
      setLoadingPrevious(true);
      try {
        const { data } = await supabase
          .from("language_imports")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && data.analysis_result) {
          setDetailedAnalysis(data.analysis_result as unknown as TextAnalysis);
          setResult({
            wordCount: data.word_count,
            uniqueWords: data.unique_words,
            speakers: [],
          });
        }
      } catch (e) {
        console.error("Failed to load previous analysis:", e);
      } finally {
        setLoadingPrevious(false);
      }
    };
    loadPreviousAnalysis();
  }, [user]);

  const hasAiConsent = Boolean(profile?.ai_processing_consent_at);

  const handleAiConsent = async () => {
    try {
      await updateProfile({ ai_processing_consent_at: new Date().toISOString() });
    } catch {
      toast.error("동의 저장에 실패했어요. 다시 시도해주세요.");
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim() || !user || !profile) return;
    setAnalyzing(true);
    setGeneratedCards([]);
    setCardsSaved(false);
    setDialogueSpeakers([]);
    setDialogueLines([]);

    try {
      const analysis = analyzeTextContent(text, profile.native_language);
      setResult({
        wordCount: analysis.wordCount,
        uniqueWords: analysis.uniqueWords,
        speakers: analysis.speakers,
      });

      // Save import with masked text for privacy
      const { data: savedImport, error } = await supabase.from("language_imports").insert({
        user_id: user.id,
        source_type: "text",
        word_count: analysis.wordCount,
        unique_words: analysis.uniqueWords,
      }).select("id").single();
      if (error) throw error;
      void recordActivity("import_analyzed", `import:${savedImport.id}`, analysis.wordCount);
      track("import_analyzed");

      toast.success(`${analysis.wordCount}개 단어 분석 완료! 🎉`);

      // Send full text for analysis
      const textToAnalyze = analysis.maskedText.slice(0, 60000);

      // Start detailed AI analysis
      setAnalyzingDetail(true);
      setDetailedAnalysis(null);
      
      const { data: aiData, error: aiErr } = await invokeAi<Partial<TextAnalysis>>("analyze-text", {
        body: {
          text: textToAnalyze,
          nativeLanguage: LANG_NAMES[profile.native_language] || profile.native_language,
          targetLanguage: LANG_NAMES[profile.target_language] || profile.target_language,
          speakerNames: analysis.speakers,
        },
      });

      // Counts come from the local analysis; the model only adds structures, summary and expressions.
      if (aiErr) toastAiError(aiErr, "AI 상세 분석에 실패해 단어 빈도만 표시해요");
      const merged = {
        sentenceStructures: [],
        complexityScore: 0,
        summary: "",
        ...(aiErr ? {} : aiData),
        ...analysis.stats,
      } as TextAnalysis;
      setDetailedAnalysis(merged);
      supabase.from("language_imports")
        .update({ analysis_result: merged })
        .eq("id", savedImport.id)
        .then(() => {});
      setAnalyzingDetail(false);
    } catch (err) {
      console.error(err);
      toast.error("분석에 실패했습니다");
      setAnalyzingDetail(false);
    } finally {
      setAnalyzing(false);
    }
  };

  // Generate cards only for unknown items after pre-test
  const handleGenerateCardsForUnknown = async (unknownWords: string[]) => {
    if (!user || !profile || unknownWords.length === 0) return;
    setGeneratingCards(true);
    try {
      const { data, error: fnError } = await invokeAi<{ cards?: GeneratedCard[] }>("generate-cards", {
        body: {
          text: unknownWords.join(", "),
          nativeLanguage: LANG_NAMES[profile.native_language] || profile.native_language,
          targetLanguage: LANG_NAMES[profile.target_language] || profile.target_language,
          level: profile.current_level,
          wordList: unknownWords,
        },
      });

      if (fnError) throw fnError;

      const cards: GeneratedCard[] = data?.cards || [];
      if (cards.length > 0) {
        setGeneratedCards(prev => [...prev, ...cards]);
        toast.success(`모르는 단어 기반으로 ${cards.length}개 카드 생성! 📚`);
      }
    } catch (err) {
      console.error(err);
      toastAiError(err, "카드 생성에 실패했습니다");
    } finally {
      setGeneratingCards(false);
    }
  };

  const handleSplitDialogue = async () => {
    if (!text.trim() || !profile) return;
    setSplittingDialogue(true);

    try {
      const maskedText = maskSensitiveData(text);
      
      const { data, error } = await invokeAi<{ is_dialogue: boolean; speakers: string[]; lines: DialogueLine[] }>("split-dialogue", {
        body: {
          text: maskedText.slice(0, 8000),
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
      setRolePlayId(crypto.randomUUID());
      setShowRolePlay(true);
      toast.success(`${data.speakers.length}명의 화자, ${data.lines.length}개 대사를 분리했어요! 🎭`);
    } catch (e) {
      console.error(e);
      toastAiError(e, "대화 분리에 실패했어요");
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

      const { error } = await supabase
        .from("srs_cards")
        .upsert(cardsToInsert, { onConflict: "user_id,native_text", ignoreDuplicates: true });
      if (error) throw error;

      setCardsSaved(true);
      toast.success("카드가 저장되었어요! 복습 탭에서 확인하세요 ✅");
      void recordActivity("cards_saved", `cards_saved:${crypto.randomUUID()}`, cardsToInsert.length);
      track("cards_saved");
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

  const handleRolePlayComplete = async (completedCount: number) => {
    const reward = await recordActivity("roleplay_complete", `roleplay:${rolePlayId}`, completedCount);
    if (reward?.applied) toast.success(`🎉 역할극 완료! +${reward.xp} XP`);
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
          <span>전화번호, 이메일 등은 자동으로 가려지고, 입력한 원문은 저장되지 않아요</span>
        </div>

        {!hasAiConsent && (
          <div className="duo-card mt-4 text-sm">
            <p className="font-bold text-foreground mb-1">AI 분석 동의가 필요해요</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              입력한 텍스트는 분석을 위해 AI 처리업체(Google Gemini, Lovable AI 게이트웨이 경유 가능)로 전송되며 국외(미국 등)에서 처리될 수 있어요. 무료 등급으로 처리하면 Google이 이 내용을 서비스 개선에 사용하고 검토자가 읽을 수 있어요.
              원문은 저장하지 않고 분석 결과만 저장해요. 다른 사람의 대화가 포함되어 있다면 그 사람의 동의를 받은 내용만 입력해 주세요.{" "}
              <Link to="/privacy" className="text-primary underline">개인정보처리방침</Link>
            </p>
            <button onClick={handleAiConsent} className="duo-btn-primary w-full text-sm">
              동의하고 계속하기
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <label className="flex-1 duo-card flex items-center justify-center gap-2 p-3 cursor-pointer hover:scale-[1.01] transition-transform">
            <FileText size={18} className="text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">파일 업로드</span>
            <input type="file" accept=".txt,.csv,.json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <div className="mt-4">
          <button
            onClick={handleAnalyze}
            disabled={!hasAiConsent || !text.trim() || analyzing}
            className="duo-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {analyzing ? (
              <><Loader2 size={18} className="animate-spin" /> 분석 중...</>
            ) : detailedAnalysis ? (
              <><Plus size={18} /> 새 텍스트 분석 추가</>
            ) : (
              <><Upload size={18} /> 분석 시작</>
            )}
          </button>
          
          <button
            onClick={handleSplitDialogue}
            disabled={!hasAiConsent || !text.trim() || splittingDialogue}
            className="duo-btn-secondary w-full mt-3 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
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

      {/* Loading previous analysis */}
      {loadingPrevious && !detailedAnalysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="duo-card mt-6 flex items-center justify-center gap-3 py-6">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="font-semibold text-muted-foreground text-sm">이전 분석 결과 불러오는 중...</span>
        </motion.div>
      )}

      {/* Previous analysis indicator */}
      {detailedAnalysis && !analyzing && !analyzingDetail && result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <History size={14} />
          <span className="font-semibold">이전 분석 결과가 표시됩니다. 새 텍스트를 입력하면 업데이트됩니다.</span>
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
        <>
          <AnalysisDashboard
            analysis={detailedAnalysis}
            wordCount={result.wordCount}
            uniqueWords={result.uniqueWords}
          />
          
          {/* Learning Flow with Tabs */}
          {(detailedAnalysis.wordFrequency?.length > 0 || detailedAnalysis.sentenceStructures?.length > 0) && (
            <ImportLearningFlow
              wordFrequency={detailedAnalysis.wordFrequency || []}
              sentenceStructures={detailedAnalysis.sentenceStructures || []}
              onComplete={(type, count) => {
                toast.success(`${type === "word" ? "단어" : "문장구조"} ${count}개 사전 테스트 완료!`);
              }}
              onUnknownWordsReady={(unknownWords) => {
                if (unknownWords.length > 0) {
                  handleGenerateCardsForUnknown(unknownWords);
                }
              }}
              onAllLearningComplete={() => {
                toast.success("🎉 오늘의 학습 완료! 카드를 저장하세요.", { duration: 5000 });
              }}
              generatingCards={generatingCards}
            />
          )}
        </>
      )}

      {/* Basic result (shown only if no detailed analysis yet) */}
      {result && !detailedAnalysis && !analyzingDetail && !loadingPrevious && (
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
