import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Type, AlignLeft, Check, X, RotateCcw, ChevronRight, Award, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WordItem = { word: string; count: number; percentage: number };
type StructureItem = { pattern: string; description: string; count: number; example: string };

type Props = {
  wordFrequency: WordItem[];
  sentenceStructures: StructureItem[];
  onComplete?: (type: "word" | "structure", completedCount: number) => void;
  onUnknownWordsReady?: (unknownWords: string[]) => void;
  onAllLearningComplete?: () => void;
  generatingCards?: boolean;
};

type LearnedItem = {
  id: string;
  type: "word" | "structure";
  content: string;
  learned: boolean;
  reviewDate?: string;
};

const QUANTITY_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

const ImportLearningFlow = ({ wordFrequency, sentenceStructures, onComplete, onUnknownWordsReady, generatingCards }: Props) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"words" | "structures">("words");
  
  // Word learning state
  const [wordQuantity, setWordQuantity] = useState(10);
  const [wordBatchIndex, setWordBatchIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [learnedWords, setLearnedWords] = useState<Map<string, boolean>>(new Map());
  const [showWordAnswer, setShowWordAnswer] = useState(false);
  
  // Structure learning state
  const [structureQuantity, setStructureQuantity] = useState(5);
  const [structureBatchIndex, setStructureBatchIndex] = useState(0);
  const [currentStructureIndex, setCurrentStructureIndex] = useState(0);
  const [learnedStructures, setLearnedStructures] = useState<Map<string, boolean>>(new Map());
  const [showStructureAnswer, setShowStructureAnswer] = useState(false);
  
  // Review state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewItems, setReviewItems] = useState<LearnedItem[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // Current batch of words
  const currentWordBatch = wordFrequency.slice(
    wordBatchIndex * wordQuantity,
    (wordBatchIndex + 1) * wordQuantity
  );
  
  // Current batch of structures
  const currentStructureBatch = sentenceStructures.slice(
    structureBatchIndex * structureQuantity,
    (structureBatchIndex + 1) * structureQuantity
  );

  const totalWordBatches = Math.ceil(wordFrequency.length / wordQuantity);
  const totalStructureBatches = Math.ceil(sentenceStructures.length / structureQuantity);

  // Calculate progress
  const wordProgress = currentWordBatch.length > 0 
    ? ((currentWordIndex + 1) / currentWordBatch.length) * 100 
    : 0;
  const structureProgress = currentStructureBatch.length > 0 
    ? ((currentStructureIndex + 1) / currentStructureBatch.length) * 100 
    : 0;

  const currentWord = currentWordBatch[currentWordIndex];
  const currentStructure = currentStructureBatch[currentStructureIndex];

  // Save progress to database
  const saveProgress = useCallback(async (type: "word" | "structure", item: string, known: boolean) => {
    if (!user) return;
    
    try {
      // Save to SRS cards for review
      if (!known) {
        const existingCard = await supabase
          .from("srs_cards")
          .select("id")
          .eq("user_id", user.id)
          .eq("native_text", item)
          .maybeSingle();
        
        if (!existingCard.data) {
          await supabase.from("srs_cards").insert({
            user_id: user.id,
            native_text: item,
            target_text: type === "word" ? `[${item}]` : item,
            context: type === "word" ? "빈도 기반 단어 학습" : "문장 구조 학습",
            difficulty: 3,
          });
        }
      }
    } catch (e) {
      console.error("Failed to save progress:", e);
    }
  }, [user]);

  // Handle word response
  const handleWordResponse = async (known: boolean) => {
    if (!currentWord) return;
    
    setLearnedWords(prev => new Map(prev).set(currentWord.word, known));
    await saveProgress("word", currentWord.word, known);
    
    if (currentWordIndex < currentWordBatch.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
      setShowWordAnswer(false);
    } else {
      // Batch complete
      const allLearned = new Map(learnedWords).set(currentWord.word, known);
      const knownCount = Array.from(allLearned.values()).filter(v => v).length;
      const unknownItems = Array.from(allLearned.entries()).filter(([_, v]) => !v).map(([k]) => k);
      
      toast.success(`사전 테스트 완료! ${knownCount}/${currentWordBatch.length}개 알고 있음`);
      onComplete?.("word", currentWordBatch.length);
      
      // Trigger card generation for unknown words
      if (unknownItems.length > 0 && onUnknownWordsReady) {
        onUnknownWordsReady(unknownItems);
      }
      
      // Auto advance to next batch
      if (wordBatchIndex < totalWordBatches - 1) {
        setTimeout(() => {
          setWordBatchIndex(prev => prev + 1);
          setCurrentWordIndex(0);
          setLearnedWords(new Map());
          setShowWordAnswer(false);
          toast.info(`다음 단어 배치 시작! (${wordBatchIndex + 2}/${totalWordBatches})`);
        }, 2000);
      } else {
        toast.success("🎉 모든 단어 사전 테스트 완료!");
      }
    }
  };

  // Handle structure response
  const handleStructureResponse = async (known: boolean) => {
    if (!currentStructure) return;
    
    setLearnedStructures(prev => new Map(prev).set(currentStructure.pattern, known));
    await saveProgress("structure", currentStructure.pattern, known);
    
    if (currentStructureIndex < currentStructureBatch.length - 1) {
      setCurrentStructureIndex(prev => prev + 1);
      setShowStructureAnswer(false);
    } else {
      // Batch complete
      const knownCount = Array.from(learnedStructures.values()).filter(v => v).length + (known ? 1 : 0);
      toast.success(`문장구조 학습 완료! ${knownCount}/${currentStructureBatch.length}개 알고 있음`);
      onComplete?.("structure", currentStructureBatch.length);
      
      // Auto advance to next batch
      if (structureBatchIndex < totalStructureBatches - 1) {
        setTimeout(() => {
          setStructureBatchIndex(prev => prev + 1);
          setCurrentStructureIndex(0);
          setLearnedStructures(new Map());
          setShowStructureAnswer(false);
          toast.info(`다음 문장구조 배치 시작! (${structureBatchIndex + 2}/${totalStructureBatches})`);
        }, 1500);
      } else {
        toast.success("🎉 모든 문장구조 학습 완료!");
      }
    }
  };

  // Load weekly review items
  const loadReviewItems = useCallback(async () => {
    if (!user) return;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data } = await supabase
      .from("srs_cards")
      .select("*")
      .eq("user_id", user.id)
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(50);
    
    if (data && data.length > 0) {
      const items: LearnedItem[] = data.map(card => ({
        id: card.id,
        type: card.context?.includes("문장") ? "structure" : "word",
        content: card.native_text,
        learned: false,
      }));
      setReviewItems(items);
    }
  }, [user]);

  useEffect(() => {
    loadReviewItems();
  }, [loadReviewItems]);

  // Handle review response
  const handleReviewResponse = async (known: boolean) => {
    const currentItem = reviewItems[currentReviewIndex];
    if (!currentItem) return;
    
    // Update SRS card
    const { data: card } = await supabase
      .from("srs_cards")
      .select("*")
      .eq("id", currentItem.id)
      .single();
    
    if (card) {
      const newEaseFactor = known 
        ? Math.min(card.ease_factor + 0.1, 3.0) 
        : Math.max(card.ease_factor - 0.2, 1.3);
      const newInterval = known 
        ? card.interval_days * newEaseFactor 
        : 1;
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + Math.ceil(newInterval));
      
      await supabase.from("srs_cards").update({
        ease_factor: newEaseFactor,
        interval_days: newInterval,
        next_review_at: nextReview.toISOString(),
        review_count: card.review_count + 1,
      }).eq("id", currentItem.id);
    }
    
    if (currentReviewIndex < reviewItems.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    } else {
      toast.success("🎉 주간 복습 완료!");
      setReviewMode(false);
      setReviewItems([]);
      setCurrentReviewIndex(0);
    }
  };

  // Reset batch
  const resetBatch = (type: "word" | "structure") => {
    if (type === "word") {
      setCurrentWordIndex(0);
      setLearnedWords(new Map());
      setShowWordAnswer(false);
    } else {
      setCurrentStructureIndex(0);
      setLearnedStructures(new Map());
      setShowStructureAnswer(false);
    }
  };

  // Review mode UI
  if (reviewMode && reviewItems.length > 0) {
    const currentReview = reviewItems[currentReviewIndex];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="duo-card mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-duo-purple" />
            <h3 className="font-bold text-foreground">주간 복습</h3>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {currentReviewIndex + 1} / {reviewItems.length}
          </span>
        </div>
        
        <Progress value={((currentReviewIndex + 1) / reviewItems.length) * 100} className="h-2 mb-4" />
        
        <div className="text-center py-8">
          <span className="text-xs font-bold text-muted-foreground mb-2 block">
            {currentReview.type === "word" ? "단어" : "문장구조"}
          </span>
          <p className="text-2xl font-extrabold text-foreground">{currentReview.content}</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => handleReviewResponse(false)}
            className="flex-1 duo-btn-secondary flex items-center justify-center gap-2 text-duo-red"
          >
            <X size={18} /> 모르겠어요
          </button>
          <button
            onClick={() => handleReviewResponse(true)}
            className="flex-1 duo-btn-primary flex items-center justify-center gap-2"
          >
            <Check size={18} /> 알고 있어요
          </button>
        </div>
        
        <button
          onClick={() => setReviewMode(false)}
          className="w-full mt-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          복습 나중에 하기
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
      {/* Review reminder */}
      {reviewItems.length > 0 && !reviewMode && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="duo-card mb-4 bg-duo-purple/10 border-duo-purple/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-duo-purple" />
              <span className="font-bold text-foreground">복습할 항목이 {reviewItems.length}개 있어요!</span>
            </div>
            <button
              onClick={() => setReviewMode(true)}
              className="text-xs font-bold text-duo-purple hover:underline flex items-center gap-1"
            >
              복습 시작 <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="words" className="flex items-center gap-2">
            <Type size={16} /> 단어 학습
          </TabsTrigger>
          <TabsTrigger value="structures" className="flex items-center gap-2">
            <AlignLeft size={16} /> 문장구조
          </TabsTrigger>
        </TabsList>

        {/* Words Tab */}
        <TabsContent value="words">
          <div className="duo-card">
            {/* Settings */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">학습 단어 수:</span>
                <Select 
                  value={wordQuantity.toString()} 
                  onValueChange={(v) => {
                    setWordQuantity(Number(v));
                    setWordBatchIndex(0);
                    resetBatch("word");
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITY_OPTIONS.map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}개</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  배치 {wordBatchIndex + 1}/{totalWordBatches}
                </span>
                <button onClick={() => resetBatch("word")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <RotateCcw size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Progress */}
            <Progress value={wordProgress} className="h-2 mb-4" />
            <p className="text-xs text-center font-bold text-muted-foreground mb-4">
              {currentWordIndex + 1} / {currentWordBatch.length}
            </p>

            {/* Generating cards indicator */}
            {generatingCards && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 rounded-xl bg-primary/10 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-primary">모르는 단어로 학습 카드 생성 중...</span>
              </motion.div>
            )}

            {/* Current word card */}
            {currentWord ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentWord.word}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -50, opacity: 0 }}
                  className="text-center py-8"
                >
                  <span className="text-xs font-bold text-duo-orange mb-2 block">
                    🧪 사전 테스트
                  </span>
                  <span className="text-xs font-bold text-primary mb-2 block">
                    #{wordBatchIndex * wordQuantity + currentWordIndex + 1} 빈도 단어
                  </span>
                  <p className="text-3xl font-extrabold text-foreground mb-2">{currentWord.word}</p>
                  <p className="text-sm text-muted-foreground font-semibold">
                    사용 횟수: {currentWord.count}회 ({currentWord.percentage}%)
                  </p>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center py-8">
                <Award size={48} className="text-primary mx-auto mb-3" />
                <p className="font-bold text-foreground">모든 단어 학습 완료!</p>
              </div>
            )}

            {/* Response buttons */}
            {currentWord && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleWordResponse(false)}
                  className="flex-1 duo-btn-secondary flex items-center justify-center gap-2 text-duo-red"
                >
                  <X size={18} /> 모르겠어요
                </button>
                <button
                  onClick={() => handleWordResponse(true)}
                  className="flex-1 duo-btn-primary flex items-center justify-center gap-2"
                >
                  <Check size={18} /> 알고 있어요
                </button>
              </div>
            )}

            {/* Next batch button */}
            {!currentWord && wordBatchIndex < totalWordBatches - 1 && (
              <button
                onClick={() => {
                  setWordBatchIndex(prev => prev + 1);
                  resetBatch("word");
                }}
                className="duo-btn-primary w-full flex items-center justify-center gap-2 mt-4"
              >
                다음 배치 시작 <ChevronRight size={18} />
              </button>
            )}
          </div>
        </TabsContent>

        {/* Structures Tab */}
        <TabsContent value="structures">
          <div className="duo-card">
            {/* Settings */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">학습 구조 수:</span>
                <Select 
                  value={structureQuantity.toString()} 
                  onValueChange={(v) => {
                    setStructureQuantity(Number(v));
                    setStructureBatchIndex(0);
                    resetBatch("structure");
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITY_OPTIONS.map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}개</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  배치 {structureBatchIndex + 1}/{totalStructureBatches}
                </span>
                <button onClick={() => resetBatch("structure")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <RotateCcw size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Progress */}
            <Progress value={structureProgress} className="h-2 mb-4" />
            <p className="text-xs text-center font-bold text-muted-foreground mb-4">
              {currentStructureIndex + 1} / {currentStructureBatch.length}
            </p>

            {/* Current structure card */}
            {currentStructure ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStructure.pattern}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -50, opacity: 0 }}
                  className="text-center py-6"
                >
                  <span className="text-xs font-bold text-duo-orange mb-2 block">
                    #{structureBatchIndex * structureQuantity + currentStructureIndex + 1} 문장 구조
                  </span>
                  <p className="text-2xl font-extrabold text-foreground mb-2">{currentStructure.pattern}</p>
                  <p className="text-sm text-muted-foreground font-semibold mb-3">{currentStructure.description}</p>
                  {currentStructure.example && (
                    <div className="p-3 rounded-xl bg-muted/50 text-sm text-foreground font-semibold italic">
                      "{currentStructure.example}"
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground font-semibold mt-2">
                    사용 횟수: {currentStructure.count}회
                  </p>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center py-8">
                <Award size={48} className="text-duo-orange mx-auto mb-3" />
                <p className="font-bold text-foreground">모든 문장구조 학습 완료!</p>
              </div>
            )}

            {/* Response buttons */}
            {currentStructure && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleStructureResponse(false)}
                  className="flex-1 duo-btn-secondary flex items-center justify-center gap-2 text-duo-red"
                >
                  <X size={18} /> 모르겠어요
                </button>
                <button
                  onClick={() => handleStructureResponse(true)}
                  className="flex-1 duo-btn-primary flex items-center justify-center gap-2"
                >
                  <Check size={18} /> 알고 있어요
                </button>
              </div>
            )}

            {/* Next batch button */}
            {!currentStructure && structureBatchIndex < totalStructureBatches - 1 && (
              <button
                onClick={() => {
                  setStructureBatchIndex(prev => prev + 1);
                  resetBatch("structure");
                }}
                className="duo-btn-primary w-full flex items-center justify-center gap-2 mt-4"
              >
                다음 배치 시작 <ChevronRight size={18} />
              </button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default ImportLearningFlow;
