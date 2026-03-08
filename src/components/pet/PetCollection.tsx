import { motion } from "framer-motion";
import type { UserPet } from "@/hooks/usePet";

type Props = {
  pets: UserPet[];
  activePet: UserPet | null;
  switchPet: (petId: string) => Promise<void>;
};

const SPECIES_EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱" };

const PetCollection = ({ pets, activePet, switchPet }: Props) => {
  if (pets.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-16">
        <div className="text-5xl mb-4">📚</div>
        <p className="font-bold text-foreground mb-1">아직 펫이 없어요</p>
        <p className="text-sm text-muted-foreground">"입양" 탭에서 첫 펫을 만나보세요!</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-3">
      {pets.map((pet, idx) => (
        <motion.div
          key={pet.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className={`duo-card flex items-center gap-3 p-4 ${
            activePet?.id === pet.id ? "border-primary" : ""
          }`}
        >
          <div>
            {pet.image_url ? (
              <img src={pet.image_url} alt={pet.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : pet.pet_type?.base_image_url ? (
              <img src={pet.pet_type.base_image_url} alt={pet.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <span className="text-4xl">{SPECIES_EMOJI[pet.pet_type?.species || "dog"]}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold text-foreground">{pet.name}</div>
            <div className="text-xs text-muted-foreground font-semibold">
              {pet.pet_type?.name} · Lv.{pet.level}
            </div>
            <div className="duo-progress-bar h-2 mt-1">
              <div
                className="h-full rounded-full bg-secondary"
                style={{ width: `${Math.min((pet.experience / pet.exp_to_next_level) * 100, 100)}%` }}
              />
            </div>
          </div>
          {activePet?.id === pet.id ? (
            <span className="text-xs font-bold text-primary">활성 ⭐</span>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => switchPet(pet.id)}
              className="text-xs font-bold text-muted-foreground bg-muted rounded-xl px-3 py-1.5"
            >
              선택
            </motion.button>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default PetCollection;
