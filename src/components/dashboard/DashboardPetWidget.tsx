import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MILESTONE_LIST } from "@/lib/milestones";
import { getEffectiveStreak } from "@/lib/streak";

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
  const [needsFeeding, setNeedsFeeding] = useState(false);
  const [lastFedHoursAgo, setLastFedHoursAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [petRes, pointsRes, feedingRes] = await Promise.all([
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
        supabase
          .from("pet_feeding_log")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (petRes.data) {
        const { data: typeData } = await supabase
          .from("pet_types")
          .select("species")
          .eq("id", (petRes.data as any).pet_type_id)
          .single();
        setPet({
          ...(petRes.data as any),
          species: (typeData as any)?.species || "dog",
        });

        // Check feeding status
        if (feedingRes.data) {
          const lastFed = new Date((feedingRes.data as any).created_at);
          const hoursAgo = (Date.now() - lastFed.getTime()) / (1000 * 60 * 60);
          setLastFedHoursAgo(Math.round(hoursAgo));
          setNeedsFeeding(hoursAgo >= 4); // 4시간 이상 안 먹었으면 알림
        } else {
          setNeedsFeeding(true);
          setLastFedHoursAgo(null);
        }
      }
      setPoints((pointsRes.data as any)?.balance || 0);
    };
    fetchData();
  }, [user]);

  const streak = profile ? getEffectiveStreak(profile) : 0;
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
              <div>
                <p className="font-bold text-foreground text-sm mb-1">펫을 입양해 보세요! 🐾</p>
              </div>
            )}

            {/* Feeding reminder */}
            {pet && needsFeeding && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-destructive/10 rounded-lg px-2 py-1 mb-1.5"
              >
                <p className="text-[10px] font-bold text-destructive">
                  🍽️ {pet.name}이(가) 배고파해요! {lastFedHoursAgo != null ? `(${lastFedHoursAgo}시간 전 마지막 식사)` : "아직 밥을 못 먹었어요"}
                </p>
              </motion.div>
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
