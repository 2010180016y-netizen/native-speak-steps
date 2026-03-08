import { motion } from "framer-motion";
import type { PetItem, UserPoints } from "@/hooks/usePet";

type Props = {
  items: PetItem[];
  points: UserPoints | null;
  feedPet: (itemId: string) => Promise<boolean>;
  activePet: any;
};

const CATEGORY_LABELS: Record<string, string> = {
  snack: "🦴 간식",
  toy: "⚽ 장난감",
  accessory: "👑 악세서리",
};

const PetShop = ({ items, points, feedPet, activePet }: Props) => {
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {!activePet && (
        <div className="duo-card mb-4 text-center py-4">
          <p className="text-sm font-bold text-muted-foreground">먼저 펫을 입양해야 아이템을 사용할 수 있어요!</p>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <h3 className="font-bold text-foreground mb-2 text-sm">{CATEGORY_LABELS[cat] || cat}</h3>
          <div className="space-y-2">
            {items
              .filter((i) => i.category === cat)
              .map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="duo-card flex items-center gap-3 p-3"
                >
                  <div className="text-3xl">{item.emoji}</div>
                  <div className="flex-1">
                    <div className="font-bold text-foreground text-sm">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">{item.description}</div>
                    <div className="text-[10px] font-semibold text-primary">+{item.exp_reward} EXP</div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => feedPet(item.id)}
                    disabled={!activePet || !points || points.balance < item.price}
                    className="bg-primary text-primary-foreground font-bold text-xs rounded-xl px-3 py-1.5 disabled:opacity-40"
                  >
                    {item.price}P
                  </motion.button>
                </motion.div>
              ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default PetShop;
