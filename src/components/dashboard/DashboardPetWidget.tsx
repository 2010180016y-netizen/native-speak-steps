import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MILESTONE_LIST } from "@/lib/milestones";

type PetWidgetData = {
  name: string;
  level: number;
  experience: number;
  exp_to_next_level: number;
  image_url: string | null;
  species: string;
};

const SPECIES_EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱" };

const DashboardPetWidget = () => {
  const { user, profile } = useAuth();
  const [pet, setPet] = useState<PetWidgetData | null>(null);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [petRes, pointsRes] = await Promise.all([
        supabase
          .from("user_pets")
          .select("name, level, experience, exp_to_next_level, image_url, pet_type_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("user_points")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (petRes.data) {
        // Get species from pet_types
        const { data: typeData } = await supabase
          .from("pet_types")
          .select("species")
          .eq("id", (petRes.data as any).pet_type_id)
          .single();
        setPet({
          ...(petRes.data as any),
          species: (typeData as any)?.species || "dog",
        });
      }
      setPoints((pointsRes.data as any)?.balance || 0);
    };
    fetch();
  }, [user]);

  const streak = profile?.streak_days || 0;
  const nextMilestone = MILESTONE_LIST.find((m) => m.days > streak);
  const daysToNext = nextMilestone ? nextMilestone.days - streak : null;

  return (
    <Link to="/pet">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="duo-card mb-4 cursor-pointer hover:scale-[1.01] transition-transform"
      >
        <div className="flex items-center gap-4">
          {/* Pet avatar */}
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex-shrink-0"
          >
            {pet?.image_url ? (
              <img
                src={pet.image_url}
                alt={pet.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
                {pet ? SPECIES_EMOJI[pet.species] : "🐾"}
              </div>
            )}
          </motion.div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {pet ? (
              <>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-foreground text-sm truncate">{pet.name}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">Lv.{pet.level}</span>
                </div>
                <div className="duo-progress-bar h-2 mb-2">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${Math.min((pet.experience / pet.exp_to_next_level) * 100, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="font-bold text-foreground text-sm mb-1">펫을 입양해 보세요! 🐾</p>
            )}

            {/* Milestone info */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground">💰 {points}P</span>
              {nextMilestone && daysToNext !== null ? (
                <span className="text-[10px] font-bold text-primary">
                  {nextMilestone.badge} {daysToNext}일 후 +{nextMilestone.points}P
                </span>
              ) : (
                <span className="text-[10px] font-bold text-primary">🏆 모든 마일스톤 달성!</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default DashboardPetWidget;
