import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserPet, PetItem, UserPoints } from "@/hooks/usePet";

type Props = {
  activePet: UserPet | null;
  items: PetItem[];
  points: UserPoints | null;
  feedPet: (itemId: string) => Promise<boolean>;
  loading: boolean;
};

type FeedingState = {
  active: boolean;
  emoji: string;
  itemName: string;
};

const PetMain = ({ activePet, items, points, feedPet, loading }: Props) => {
  const [feeding, setFeeding] = useState<FeedingState>({ active: false, emoji: "", itemName: "" });

  const handleFeed = useCallback(async (item: PetItem) => {
    setFeeding({ active: true, emoji: item.emoji, itemName: item.name });
    const success = await feedPet(item.id);
    // Keep animation for a moment after feed completes
    if (success) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    setFeeding({ active: false, emoji: "", itemName: "" });
  }, [feedPet]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-16">
        <div className="animate-bounce text-5xl">🐾</div>
      </motion.div>
    );
  }

  if (!activePet) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-16">
        <div className="text-5xl mb-4">🏠</div>
        <p className="font-bold text-foreground mb-1">아직 펫이 없어요!</p>
        <p className="text-sm text-muted-foreground">"입양" 탭에서 첫 번째 친구를 만나보세요</p>
      </motion.div>
    );
  }

  const expPercent = Math.min((activePet.experience / activePet.exp_to_next_level) * 100, 100);
  const quickSnacks = items.filter((i) => i.category === "snack").slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {/* Pet display */}
      <div className="duo-card text-center mb-4 relative overflow-hidden">
        {/* Feeding animation overlay */}
        <AnimatePresence>
          {feeding.active && (
            <>
              {/* Food item flying to pet */}
              <motion.div
                className="absolute z-10 text-4xl"
                initial={{ bottom: 20, left: "50%", x: "-50%", opacity: 1, scale: 1.2 }}
                animate={{
                  bottom: [20, 100, 140],
                  scale: [1.2, 1.5, 0.3],
                  opacity: [1, 1, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeIn" }}
              >
                {feeding.emoji}
              </motion.div>

              {/* Happy particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute z-10 text-lg pointer-events-none"
                  initial={{
                    top: "40%",
                    left: "50%",
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    top: `${20 + Math.random() * 20}%`,
                    left: `${20 + Math.random() * 60}%`,
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                    rotate: [0, Math.random() * 360],
                  }}
                  transition={{
                    duration: 1.2,
                    delay: 0.5 + i * 0.1,
                    ease: "easeOut",
                  }}
                >
                  {["✨", "💕", "⭐", "🎉", "💖", "😋"][i]}
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Pet image with eating animation */}
        <motion.div
          className="mb-3 relative inline-block"
          animate={
            feeding.active
              ? {
                  scale: [1, 1.1, 0.95, 1.05, 1],
                  rotate: [0, -5, 5, -3, 0],
                  y: [0, -5, 0, -3, 0],
                }
              : { y: [0, -8, 0] }
          }
          transition={
            feeding.active
              ? { duration: 1, ease: "easeInOut", repeat: 1 }
              : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {(activePet.image_url || activePet.pet_type?.base_image_url) ? (
            <img
              src={activePet.image_url || activePet.pet_type?.base_image_url || ""}
              alt={activePet.name}
              className="w-40 h-40 mx-auto rounded-3xl object-cover shadow-lg border-2 border-border"
            />
          ) : (
            <div className="w-40 h-40 mx-auto rounded-3xl bg-muted flex items-center justify-center text-6xl">
              {activePet.pet_type?.species === "cat" ? "🐱" : "🐶"}
            </div>
          )}

          {/* Eating mouth animation */}
          <AnimatePresence>
            {feeding.active && (
              <motion.div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-2xl"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.3, 1, 0],
                }}
                transition={{ duration: 1.5, delay: 0.3 }}
              >
                😋
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <h2 className="text-xl font-extrabold text-foreground">{activePet.name}</h2>
        <p className="text-sm text-muted-foreground font-semibold mb-1">
          {activePet.pet_type?.name} · Lv.{activePet.level}
        </p>

        {/* Status message during feeding */}
        <AnimatePresence>
          {feeding.active && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs font-bold text-secondary mt-1"
            >
              냠냠~ {feeding.itemName} 맛있다! 😊
            </motion.p>
          )}
        </AnimatePresence>

        {/* EXP bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground font-bold mb-1">
            <span>EXP</span>
            <span>{activePet.experience}/{activePet.exp_to_next_level}</span>
          </div>
          <div className="duo-progress-bar h-3">
            <motion.div
              className="h-full rounded-full bg-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${expPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Quick feed */}
      <div className="duo-card">
        <h3 className="font-bold text-foreground mb-3">🍽️ 간식 주기</h3>
        <div className="grid grid-cols-3 gap-2">
          {quickSnacks.map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleFeed(item)}
              disabled={feeding.active || !points || points.balance < item.price}
              className="duo-card p-3 text-center cursor-pointer disabled:opacity-40 hover:border-primary transition-colors"
            >
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-[10px] font-bold text-foreground truncate">{item.name}</div>
              <div className="text-[10px] text-muted-foreground font-semibold">{item.price}P</div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default PetMain;
