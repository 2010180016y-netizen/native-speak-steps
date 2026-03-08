import { useState } from "react";
import { motion } from "framer-motion";
import type { PetType, UserPoints, UserPet } from "@/hooks/usePet";
import { Input } from "@/components/ui/input";

type Props = {
  petTypes: PetType[];
  points: UserPoints | null;
  pets: UserPet[];
  adoptPet: (petTypeId: string, name: string) => Promise<boolean>;
  onAdopted: () => void;
};

const SPECIES_EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱" };

const PetAdopt = ({ petTypes, points, pets, adoptPet, onAdopted }: Props) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [adopting, setAdopting] = useState(false);

  const ownedTypeIds = new Set(pets.map((p) => p.pet_type_id));

  const handleAdopt = async () => {
    if (!selectedType || !petName.trim()) return;
    setAdopting(true);
    const success = await adoptPet(selectedType, petName.trim());
    setAdopting(false);
    if (success) {
      setPetName("");
      setSelectedType(null);
      onAdopted();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {selectedType ? (
        <div className="duo-card text-center">
          <div className="text-6xl mb-3">
            {SPECIES_EMOJI[petTypes.find((t) => t.id === selectedType)?.species || "dog"]}
          </div>
          <h3 className="font-bold text-foreground mb-1">
            {petTypes.find((t) => t.id === selectedType)?.name}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">이름을 지어주세요!</p>
          <Input
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
            placeholder="펫 이름 입력..."
            className="mb-3 text-center font-bold"
            maxLength={10}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedType(null)}
              className="flex-1 py-2 rounded-xl font-bold text-sm bg-muted text-muted-foreground"
            >
              뒤로
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAdopt}
              disabled={!petName.trim() || adopting}
              className="flex-1 duo-btn-primary py-2 text-sm disabled:opacity-50"
            >
              {adopting ? "입양 중..." : "입양하기 🎉"}
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {petTypes.map((type, idx) => {
            const owned = ownedTypeIds.has(type.id);
            const canAfford = points && points.balance >= type.unlock_cost;
            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`duo-card flex items-center gap-3 p-4 ${owned ? "opacity-60" : "cursor-pointer hover:border-primary"} transition-colors`}
                onClick={() => !owned && setSelectedType(type.id)}
              >
                <div className="text-4xl">{SPECIES_EMOJI[type.species]}</div>
                <div className="flex-1">
                  <div className="font-bold text-foreground">{type.name}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
                {owned ? (
                  <span className="text-xs font-bold text-primary">보유중 ✓</span>
                ) : (
                  <span className={`font-bold text-sm ${canAfford ? "text-secondary" : "text-muted-foreground"}`}>
                    {type.unlock_cost === 0 ? "무료" : `${type.unlock_cost}P`}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default PetAdopt;
