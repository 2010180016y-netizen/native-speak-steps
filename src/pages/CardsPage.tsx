import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { RotateCcw, Check, X, Filter, Layers, List, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Card = {
  id: string;
  native_text: string;
  target_text: string;
  context: string | null;
  difficulty: number;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  next_review_at?: string;
  created_at?: string;
};

type SourceFilter = "all" | "chat" | "analysis";
type ViewMode = "card" | "list";

const SWIPE_THRESHOLD = 100;

const getCardSource = (context: string | null): "chat" | "analysis" => {
  if (!context) return "analysis";
  if (context.includes("좋은 표현") || context.includes("개선 표현")) return "chat";
  return "analysis";
};

const getSourceLabel = (source: "chat" | "analysis") =>
  source === "chat" ? "💬 회화" : "📖 분석";

const getSourceColor = (source: "chat" | "analysis") =>
  source === "chat" ? "bg-duo-blue/15 text-duo-blue border-duo-blue/30" : "bg-primary/15 text-primary border-primary/30";

const CardsPage = () => {
  const { user } = useAuth();
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [allCardsForList, setAllCardsForList] = useState<Card[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const leftOpacity = useTransform(x, [-150, -50], [1, 0]);
  const rightOpacity = useTransform(x, [50, 150], [0, 1]);

  useEffect(() => {
    if (!user) return;
    const fetchCards = async () => {
      // Due cards for review mode
      const { data: dueData } = await supabase
        .from("srs_cards")
        .select("*")
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString())
        .order("next_review_at")
        .limit(50);
      setAllCards(dueData || []);

      // All cards for list view
      const { data: allData } = await supabase
        .from("srs_cards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setAllCardsForList(allData || []);

      setLoading(false);
    };
    fetchCards();
  }, [user]);

  useEffect(() => {
    const filtered = sourceFilter === "all"
      ? allCards
      : allCards.filter((c) => getCardSource(c.context) === sourceFilter);
    setCards(filtered);
    setCurrentIndex(0);
    setFlipped(false);
  }, [allCards, sourceFilter]);

  const listCards = sourceFilter === "all"
    ? allCardsForList
    : allCardsForList.filter((c) => getCardSource(c.context) === sourceFilter);

  const chatCount = allCardsForList.filter((c) => getCardSource(c.context) === "chat").length;
  const analysisCount = allCardsForList.filter((c) => getCardSource(c.context) === "analysis").length;
  const dueCount = allCards.length;

  const currentCard = cards[currentIndex];

  const handleReview = async (quality: number, direction?: "left" | "right") => {
    if (!currentCard || !user) return;
    if (direction) setExitDirection(direction);

    let ef = currentCard.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ef = Math.max(1.3, ef);
    let interval = currentCard.interval_days;

    if (quality < 3) {
      interval = 1;
    } else if (currentCard.review_count === 0) {
      interval = 1;
    } else if (currentCard.review_count === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    await supabase
      .from("srs_cards")
      .update({
        ease_factor: ef,
        interval_days: interval,
        next_review_at: nextReview.toISOString(),
        review_count: currentCard.review_count + 1,
        difficulty: quality,
      })
      .eq("id", currentCard.id);

    setTimeout(() => {
      setFlipped(false);
      setExitDirection(null);
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        toast.success("모든 카드를 복습했어요! 🎉");
        setCards([]);
      }
    }, 200);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.from("srs_cards").delete().eq("id", id);
    setAllCardsForList((prev) => prev.filter((c) => c.id !== id));
    setAllCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("카드가 삭제되었습니다");
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (!flipped) return;
    if (info.offset.x < -SWIPE_THRESHOLD) {
      handleReview(1, "left");
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      handleReview(5, "right");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-bounce-in text-4xl">📚</div>
        </div>
      </AppLayout>
    );
  }

  const cardSource = currentCard ? getCardSource(currentCard.context) : null;

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">복습 카드 📚</h1>
            <p className="text-sm text-muted-foreground font-semibold">
              {viewMode === "card"
                ? cards.length > 0 ? `${cards.length - currentIndex}개 남음` : "복습할 카드가 없어요"
                : `전체 ${listCards.length}개`}
            </p>
          </div>
          {/* View Mode Toggle */}
          <div className="flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => setViewMode("card")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Layers size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Source Filter */}
      {allCardsForList.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-muted-foreground" />
          <button
            onClick={() => setSourceFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sourceFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            전체 ({viewMode === "card" ? allCards.length : allCardsForList.length})
          </button>
          {chatCount > 0 && (
            <button
              onClick={() => setSourceFilter("chat")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sourceFilter === "chat" ? "bg-duo-blue text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              💬 회화 ({chatCount})
            </button>
          )}
          {analysisCount > 0 && (
            <button
              onClick={() => setSourceFilter("analysis")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sourceFilter === "analysis" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              📖 분석 ({analysisCount})
            </button>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" ? (
        <div className="space-y-2">
          {listCards.length === 0 ? (
            <div className="duo-card text-center py-12">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-bold text-foreground">카드가 없습니다</p>
            </div>
          ) : (
            listCards.map((card, i) => {
              const source = getCardSource(card.context);
              const isExpanded = expandedId === card.id;
              const isDue = card.next_review_at && new Date(card.next_review_at) <= new Date();

              return (
                <motion.div
                  key={card.id}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="duo-card p-0 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : card.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getSourceColor(source)}`}>
                          {getSourceLabel(source)}
                        </span>
                        {isDue && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-duo-orange/15 text-duo-orange border border-duo-orange/30">
                            복습 필요
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate">{card.target_text}</p>
                      <p className="text-xs text-muted-foreground font-semibold truncate">{card.native_text}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
                          {card.context && (
                            <p className="text-xs text-muted-foreground font-semibold">📝 {card.context}</p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold">
                            <span>복습 {card.review_count}회</span>
                            <span>간격 {card.interval_days}일</span>
                            {card.created_at && (
                              <span>생성 {format(new Date(card.created_at), "M/d")}</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors"
                          >
                            <Trash2 size={10} /> 삭제
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        /* CARD VIEW */
        <>
          {cards.length === 0 ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="duo-card text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="font-bold text-foreground text-lg mb-2">모두 완료!</h3>
              <p className="text-sm text-muted-foreground font-semibold">
                {sourceFilter !== "all" ? "이 필터에 해당하는 카드가 없습니다" : "모국어를 분석하면 새 카드가 생성됩니다"}
              </p>
            </motion.div>
          ) : currentCard && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCard.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{
                  x: exitDirection === "left" ? -300 : exitDirection === "right" ? 300 : 0,
                  opacity: 0,
                  scale: 0.8,
                  transition: { duration: 0.3 },
                }}
              >
                <div className="duo-progress-bar mb-6">
                  <div className="duo-progress-fill" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
                </div>

                {flipped && (
                  <div className="relative mb-2">
                    <motion.div style={{ opacity: leftOpacity }} className="absolute left-0 top-0 px-3 py-1 rounded-lg bg-destructive/20 text-destructive text-xs font-bold">
                      ← 모르겠어요
                    </motion.div>
                    <motion.div style={{ opacity: rightOpacity }} className="absolute right-0 top-0 px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold">
                      알겠어요 →
                    </motion.div>
                    <div className="h-6" />
                  </div>
                )}

                <motion.div
                  style={flipped ? { x, rotate } : {}}
                  drag={flipped ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.8}
                  onDragEnd={handleDragEnd}
                  onClick={() => !flipped && setFlipped(true)}
                  className="cursor-pointer select-none"
                >
                  <div className="relative w-full" style={{ perspective: "1000px" }}>
                    <motion.div
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 25 }}
                      style={{ transformStyle: "preserve-3d" }}
                      className="relative w-full min-h-[250px]"
                    >
                      <div
                        className="duo-card absolute inset-0 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        {cardSource && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mb-3 ${getSourceColor(cardSource)}`}>
                            {getSourceLabel(cardSource)}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground font-bold mb-3 uppercase">모국어</p>
                        <p className="text-2xl font-extrabold text-foreground text-center px-4">{currentCard.native_text}</p>
                        <p className="text-xs text-muted-foreground font-semibold mt-4">탭하여 정답 보기 👆</p>
                      </div>

                      <div
                        className="duo-card absolute inset-0 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        {cardSource && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mb-3 ${getSourceColor(cardSource)}`}>
                            {getSourceLabel(cardSource)}
                          </span>
                        )}
                        <p className="text-xs text-primary font-bold mb-3 uppercase">번역</p>
                        <p className="text-2xl font-extrabold text-primary text-center px-4">{currentCard.target_text}</p>
                        {currentCard.context && (
                          <p className="text-sm text-muted-foreground font-semibold mt-3 text-center px-4">📝 {currentCard.context}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-4">← 스와이프하여 평가 →</p>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                {flipped && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleReview(1, "left")}
                      className="flex-1 duo-card flex flex-col items-center gap-1 p-3 border-destructive cursor-pointer hover:scale-[1.02] transition-transform"
                    >
                      <X className="text-destructive" size={24} />
                      <span className="text-xs font-bold text-destructive">모르겠어요</span>
                    </button>
                    <button
                      onClick={() => handleReview(3)}
                      className="flex-1 duo-card flex flex-col items-center gap-1 p-3 border-secondary cursor-pointer hover:scale-[1.02] transition-transform"
                    >
                      <RotateCcw className="text-secondary" size={24} />
                      <span className="text-xs font-bold text-muted-foreground">애매해요</span>
                    </button>
                    <button
                      onClick={() => handleReview(5, "right")}
                      className="flex-1 duo-card flex flex-col items-center gap-1 p-3 border-primary cursor-pointer hover:scale-[1.02] transition-transform"
                    >
                      <Check className="text-primary" size={24} />
                      <span className="text-xs font-bold text-primary">알겠어요</span>
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}
    </AppLayout>
  );
};

export default CardsPage;
