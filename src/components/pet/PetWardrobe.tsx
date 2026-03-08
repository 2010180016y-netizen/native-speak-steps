import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { UserPet } from "@/hooks/usePet";
import PetModel from "./PetModel";
import Pet3DAccessory from "./Pet3DAccessory";

type Accessory = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string | null;
  unlock_level: number;
  position: string;
};

type UserAccessory = {
  id: string;
  accessory_id: string;
  is_equipped: boolean;
};

type Props = {
  activePet: UserPet | null;
  loading: boolean;
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  hat: { label: "모자", emoji: "🎩" },
  glasses: { label: "안경", emoji: "👓" },
  ribbon: { label: "리본/목걸이", emoji: "🎀" },
  special: { label: "스페셜", emoji: "✨" },
};

const PetWardrobe = ({ activePet, loading }: Props) => {
  const { user } = useAuth();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [userAccessories, setUserAccessories] = useState<UserAccessory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("hat");
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !activePet) return;
    setLoadingData(true);
    const [accRes, userAccRes] = await Promise.all([
      supabase.from("pet_accessories").select("*").order("unlock_level"),
      supabase.from("user_pet_accessories").select("id, accessory_id, is_equipped").eq("pet_id", activePet.id),
    ]);
    setAccessories((accRes.data as Accessory[]) || []);
    setUserAccessories((userAccRes.data as UserAccessory[]) || []);
    setLoadingData(false);
  }, [user, activePet]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-unlock accessories when pet reaches required level
  useEffect(() => {
    if (!activePet || !user || accessories.length === 0) return;
    const unlocked = new Set(userAccessories.map((ua) => ua.accessory_id));
    const toUnlock = accessories.filter(
      (a) => a.unlock_level <= activePet.level && !unlocked.has(a.id)
    );
    if (toUnlock.length > 0) {
      Promise.all(
        toUnlock.map((a) =>
          supabase.from("user_pet_accessories").insert({
            user_id: user.id,
            pet_id: activePet.id,
            accessory_id: a.id,
          })
        )
      ).then(() => {
        toUnlock.forEach((a) =>
          toast.success(`🎁 "${a.emoji} ${a.name}" 해금!`)
        );
        fetchData();
      });
    }
  }, [activePet?.level, accessories, userAccessories.length]);

  const toggleEquip = async (accessoryId: string, currentlyEquipped: boolean) => {
    if (!activePet || !user) return;
    const accessory = accessories.find((a) => a.id === accessoryId);
    if (!accessory) return;

    // If equipping, unequip other items in same position
    if (!currentlyEquipped) {
      const samePositionIds = accessories
        .filter((a) => a.position === accessory.position && a.id !== accessoryId)
        .map((a) => a.id);

      const toUnequip = userAccessories.filter(
        (ua) => samePositionIds.includes(ua.accessory_id) && ua.is_equipped
      );

      if (toUnequip.length > 0) {
        await Promise.all(
          toUnequip.map((ua) =>
            supabase.from("user_pet_accessories").update({ is_equipped: false }).eq("id", ua.id)
          )
        );
      }
    }

    const ua = userAccessories.find((u) => u.accessory_id === accessoryId);
    if (!ua) return;

    await supabase.from("user_pet_accessories").update({ is_equipped: !currentlyEquipped }).eq("id", ua.id);
    toast.success(currentlyEquipped ? `${accessory.emoji} ${accessory.name} 해제!` : `${accessory.emoji} ${accessory.name} 착용!`);
    fetchData();
  };

  if (loading || loadingData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-16">
        <div className="animate-bounce text-5xl">👗</div>
      </motion.div>
    );
  }

  if (!activePet) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <div className="text-5xl mb-4">👗</div>
        <p className="font-bold text-foreground mb-1">먼저 펫을 입양해주세요!</p>
      </motion.div>
    );
  }

  const unlockedIds = new Set(userAccessories.map((ua) => ua.accessory_id));
  const equippedIds = new Set(userAccessories.filter((ua) => ua.is_equipped).map((ua) => ua.accessory_id));
  const categories = Object.keys(CATEGORY_LABELS);
  const filtered = accessories.filter((a) => a.category === selectedCategory);

  // Equipped accessories for preview
  const equippedAccessories = accessories.filter((a) => equippedIds.has(a.id));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {/* 3D Preview */}
      <div className="duo-card mb-4 overflow-hidden" style={{ height: 220 }}>
        <Canvas
          shadows
          camera={{ position: [0, 3, 5], fov: 40 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: "linear-gradient(180deg, #87CEEB 0%, #E0F0FF 100%)", borderRadius: "0.75rem" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 3]} intensity={1} castShadow />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#c4956a" roughness={0.8} />
          </mesh>
          <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={6} blur={2} />
          <Suspense fallback={null}>
            <PetModel
              action="idle"
              position={[0, 0, 0]}
              targetPosition={[0, 0, 0]}
              scale={0.012}
              species={activePet.pet_type?.species || "dog"}
              petTypeName={activePet.pet_type?.name}
              feeding={false}
            />
          </Suspense>
          {equippedAccessories.map((a, i) => (
            <Pet3DAccessory
              key={i}
              position={a.position}
              category={a.category}
              name={a.name}
              petPosition={[0, 0, 0]}
              petScale={0.012}
            />
          ))}
          <OrbitControls enablePan={false} enableZoom={false} />
        </Canvas>
        <div className="text-center -mt-8 relative z-10">
          <p className="text-sm font-extrabold text-foreground">{activePet.name}</p>
          <p className="text-[10px] text-muted-foreground font-bold">
            착용 중: {equippedAccessories.length > 0 ? equippedAccessories.map((a) => a.name).join(", ") : "없음"}
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 bg-muted rounded-xl p-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {CATEGORY_LABELS[cat].emoji} {CATEGORY_LABELS[cat].label}
          </button>
        ))}
      </div>

      {/* Accessories grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <AnimatePresence mode="popLayout">
          {filtered.map((acc) => {
            const isUnlocked = unlockedIds.has(acc.id);
            const isEquipped = equippedIds.has(acc.id);
            const isLocked = acc.unlock_level > activePet.level;

            return (
              <motion.div
                key={acc.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`duo-card p-3 relative transition-all ${
                  isEquipped
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : isLocked
                    ? "opacity-50"
                    : "hover:border-primary/50"
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-1.5">
                    {isLocked ? "🔒" : acc.emoji}
                  </div>
                  <p className="text-xs font-bold text-foreground truncate">{acc.name}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mb-2">
                    {isLocked ? `Lv.${acc.unlock_level} 해금` : acc.description}
                  </p>

                  {isUnlocked && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleEquip(acc.id, isEquipped)}
                      className={`w-full py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                        isEquipped
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {isEquipped ? "해제" : "착용"}
                    </motion.button>
                  )}

                  {isLocked && (
                    <div className="w-full py-1.5 rounded-lg bg-muted text-muted-foreground font-bold text-[10px]">
                      🔒 Lv.{acc.unlock_level}
                    </div>
                  )}

                  {!isUnlocked && !isLocked && (
                    <div className="w-full py-1.5 rounded-lg bg-secondary/20 text-secondary font-bold text-[10px]">
                      해금 가능!
                    </div>
                  )}
                </div>

                {isEquipped && (
                  <div className="absolute top-1.5 right-1.5 text-xs">✅</div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PetWardrobe;
