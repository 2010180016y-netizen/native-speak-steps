import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";

type Card = {
  id: string;
  native_text: string;
  target_text: string;
  context: string | null;
  difficulty: number;
  interval_days: number;
  ease_factor: number;
  review_count: number;
};

const SWIPE_THRESHOLD = 100;

const CardsPage = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const leftOpacity = useTransform(x, [-150, -50], [1, 0]);
  const rightOpacity = useTransform(x, [50, 150], [0, 1]);

  useEffect(() => {
    if (!user) return;
    const fetchCards = async () => {
      const { data } = await supabase
        .from("srs_cards")
        .select("*")
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString())
        .order("next_review_at")
        .limit(20);
      setCards(data || []);
      setLoading(false);
    };
    fetchCards();
  }, [user]);

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

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground">복습 카드 📚</h1>
        <p className="text-sm text-muted-foreground font-semibold">
          {cards.length > 0 ? `${cards.length - currentIndex}개 남음` : "복습할 카드가 없어요"}
        </p>
      </motion.div>

      {cards.length === 0 ? (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="duo-card text-center py-12">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="font-bold text-foreground text-lg mb-2">모두 완료!</h3>
          <p className="text-sm text-muted-foreground font-semibold">
            모국어를 분석하면 새 카드가 생성됩니다
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
            {/* Progress */}
            <div className="duo-progress-bar mb-6">
              <div className="duo-progress-fill" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
            </div>

            {/* Swipe hint labels */}
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

            {/* Card with flip & swipe */}
            <motion.div
              style={flipped ? { x, rotate } : {}}
              drag={flipped ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={handleDragEnd}
              onClick={() => !flipped && setFlipped(true)}
              className="cursor-pointer select-none"
            >
              <div
                className="relative w-full"
                style={{ perspective: "1000px" }}
              >
                <motion.div
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 25 }}
                  style={{ transformStyle: "preserve-3d" }}
                  className="relative w-full min-h-[250px]"
                >
                  {/* Front */}
                  <div
                    className="duo-card absolute inset-0 flex flex-col items-center justify-center backface-hidden"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <p className="text-xs text-muted-foreground font-bold mb-3 uppercase">모국어</p>
                    <p className="text-2xl font-extrabold text-foreground">{currentCard.native_text}</p>
                    <p className="text-xs text-muted-foreground font-semibold mt-4">탭하여 정답 보기 👆</p>
                  </div>

                  {/* Back */}
                  <div
                    className="duo-card absolute inset-0 flex flex-col items-center justify-center"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <p className="text-xs text-primary font-bold mb-3 uppercase">번역</p>
                    <p className="text-2xl font-extrabold text-primary">{currentCard.target_text}</p>
                    {currentCard.context && (
                      <p className="text-sm text-muted-foreground font-semibold mt-3">📝 {currentCard.context}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">← 스와이프하여 평가 →</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Review buttons */}
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
    </AppLayout>
  );
};

export default CardsPage;
