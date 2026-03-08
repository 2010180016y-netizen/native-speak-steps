import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
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

const CardsPage = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleReview = async (quality: number) => {
    if (!currentCard || !user) return;

    // SM-2 algorithm
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

    setFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.success("모든 카드를 복습했어요! 🎉");
      setCards([]);
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
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
          >
            {/* Progress */}
            <div className="duo-progress-bar mb-6">
              <div className="duo-progress-fill" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
            </div>

            {/* Card */}
            <div
              onClick={() => setFlipped(!flipped)}
              className="duo-card min-h-[250px] flex flex-col items-center justify-center cursor-pointer hover:scale-[1.01] transition-transform"
            >
              {!flipped ? (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-bold mb-3 uppercase">모국어</p>
                  <p className="text-2xl font-extrabold text-foreground">{currentCard.native_text}</p>
                  <p className="text-xs text-muted-foreground font-semibold mt-4">탭하여 정답 보기</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-primary font-bold mb-3 uppercase">번역</p>
                  <p className="text-2xl font-extrabold text-primary">{currentCard.target_text}</p>
                  {currentCard.context && (
                    <p className="text-sm text-muted-foreground font-semibold mt-3">📝 {currentCard.context}</p>
                  )}
                </div>
              )}
            </div>

            {/* Review buttons */}
            {flipped && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-3 mt-4">
                <button
                  onClick={() => handleReview(1)}
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
                  onClick={() => handleReview(5)}
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
