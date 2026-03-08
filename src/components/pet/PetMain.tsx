import { motion } from "framer-motion";
import type { UserPet, PetItem, UserPoints } from "@/hooks/usePet";

type Props = {
  activePet: UserPet | null;
  items: PetItem[];
  points: UserPoints | null;
  feedPet: (itemId: string) => Promise<boolean>;
  loading: boolean;
};

const SPECIES_EMOJI: Record<string, string[]> = {
  dog: ["🐶", "🐕", "🦮", "🐕‍🦺", "🐩"],
  cat: ["🐱", "🐈", "🐈‍⬛", "😺", "😸"],
};

const getLevelEmoji = (species: string, level: number) => {
  const emojis = SPECIES_EMOJI[species] || SPECIES_EMOJI.dog;
  if (level < 5) return emojis[0];
  if (level < 10) return emojis[1];
  if (level < 15) return emojis[2];
  if (level < 20) return emojis[3];
  return emojis[4];
};

const PetMain = ({ activePet, items, points, feedPet, loading }: Props) => {
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

  const species = activePet.pet_type?.species || "dog";
  const expPercent = Math.min((activePet.experience / activePet.exp_to_next_level) * 100, 100);
  const quickSnacks = items.filter((i) => i.category === "snack").slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {/* Pet display */}
      <div className="duo-card text-center mb-4">
        <motion.div
          className="text-8xl mb-3"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {activePet.image_url ? (
            <img src={activePet.image_url} alt={activePet.name} className="w-32 h-32 mx-auto rounded-3xl object-cover" />
          ) : (
            getLevelEmoji(species, activePet.level)
          )}
        </motion.div>
        <h2 className="text-xl font-extrabold text-foreground">{activePet.name}</h2>
        <p className="text-sm text-muted-foreground font-semibold mb-1">
          {activePet.pet_type?.name} · Lv.{activePet.level}
        </p>

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
              onClick={() => feedPet(item.id)}
              disabled={!points || points.balance < item.price}
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
