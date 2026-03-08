import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { usePet } from "@/hooks/usePet";
import PetMain from "@/components/pet/PetMain";
import PetShop from "@/components/pet/PetShop";
import PetAdopt from "@/components/pet/PetAdopt";
import PetCollection from "@/components/pet/PetCollection";

type Tab = "pet" | "shop" | "adopt" | "collection";

const PetPage = () => {
  const petData = usePet();
  const [tab, setTab] = useState<Tab>(petData.activePet ? "pet" : "adopt");

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: "pet", label: "내 펫", emoji: "🐾" },
    { key: "shop", label: "상점", emoji: "🛒" },
    { key: "collection", label: "도감", emoji: "📚" },
    { key: "adopt", label: "입양", emoji: "🏠" },
  ];

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-extrabold text-foreground">마이 펫 🐾</h1>
          {petData.points && (
            <div className="flex items-center gap-1.5 bg-secondary/20 rounded-full px-3 py-1.5">
              <span className="text-sm">💰</span>
              <span className="font-extrabold text-foreground text-sm">{petData.points.balance}P</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-semibold mb-4">
          학습하고 포인트를 모아 펫을 키워보세요!
        </p>
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-1.5 mb-5 bg-muted rounded-2xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "pet" && <PetMain key="pet" {...petData} />}
        {tab === "shop" && <PetShop key="shop" {...petData} />}
        {tab === "adopt" && <PetAdopt key="adopt" {...petData} onAdopted={() => setTab("pet")} />}
        {tab === "collection" && <PetCollection key="collection" {...petData} />}
      </AnimatePresence>
    </AppLayout>
  );
};

export default PetPage;
