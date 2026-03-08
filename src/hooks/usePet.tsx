import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const IMAGE_MILESTONES = [1, 5, 10, 15, 20, 25, 30];

export type PetType = {
  id: string;
  name: string;
  species: string;
  unlock_cost: number;
  description: string | null;
  base_image_url: string | null;
};

export type UserPet = {
  id: string;
  user_id: string;
  pet_type_id: string;
  name: string;
  level: number;
  experience: number;
  exp_to_next_level: number;
  is_active: boolean;
  image_url: string | null;
  pet_type?: PetType;
};

export type PetItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  exp_reward: number;
  emoji: string;
  description: string | null;
};

export type UserPoints = {
  id: string;
  user_id: string;
  balance: number;
};

const LEVEL_THRESHOLDS = Array.from({ length: 30 }, (_, i) => Math.round(100 * Math.pow(1.2, i)));

export const usePet = () => {
  const { user } = useAuth();
  const [pets, setPets] = useState<UserPet[]>([]);
  const [activePet, setActivePet] = useState<UserPet | null>(null);
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [items, setItems] = useState<PetItem[]>([]);
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [typesRes, itemsRes, petsRes, pointsRes] = await Promise.all([
      supabase.from("pet_types").select("*"),
      supabase.from("pet_items").select("*"),
      supabase.from("user_pets").select("*").eq("user_id", user.id),
      supabase.from("user_points").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    setPetTypes((typesRes.data as PetType[]) || []);
    setItems((itemsRes.data as PetItem[]) || []);

    const userPets = (petsRes.data as UserPet[]) || [];
    // Attach pet_type info
    const typesMap = new Map((typesRes.data || []).map((t: any) => [t.id, t]));
    userPets.forEach((p) => {
      p.pet_type = typesMap.get(p.pet_type_id) as PetType;
    });
    setPets(userPets);
    setActivePet(userPets.find((p) => p.is_active) || userPets[0] || null);

    if (pointsRes.data) {
      setPoints(pointsRes.data as UserPoints);
    } else {
      // Create points record
      const { data } = await supabase
        .from("user_points")
        .insert({ user_id: user.id, balance: 50 })
        .select()
        .single();
      if (data) setPoints(data as UserPoints);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const adoptPet = async (petTypeId: string, name: string) => {
    if (!user || !points) return false;
    const petType = petTypes.find((t) => t.id === petTypeId);
    if (!petType) return false;

    if (petType.unlock_cost > points.balance) {
      toast.error("포인트가 부족해요! 😢");
      return false;
    }

    // Deduct points
    if (petType.unlock_cost > 0) {
      await supabase
        .from("user_points")
        .update({ balance: points.balance - petType.unlock_cost })
        .eq("id", points.id);

      await supabase.from("point_transactions").insert({
        user_id: user.id,
        amount: -petType.unlock_cost,
        type: "pet_unlock",
        description: `${petType.name} 입양`,
      });
    }

    // Deactivate other pets
    if (pets.length > 0) {
      await supabase
        .from("user_pets")
        .update({ is_active: false })
        .eq("user_id", user.id);
    }

    const { error } = await supabase.from("user_pets").insert({
      user_id: user.id,
      pet_type_id: petTypeId,
      name,
      is_active: true,
      exp_to_next_level: LEVEL_THRESHOLDS[0],
    });

    if (error) {
      toast.error("입양에 실패했어요");
      return false;
    }

    toast.success(`${name}이(가) 가족이 되었어요! 🎉`);
    await fetchAll();
    return true;
  };

  const feedPet = async (itemId: string) => {
    if (!user || !points || !activePet) return false;
    const item = items.find((i) => i.id === itemId);
    if (!item) return false;

    if (item.price > points.balance) {
      toast.error("포인트가 부족해요! 😢");
      return false;
    }

    // Deduct points
    await supabase
      .from("user_points")
      .update({ balance: points.balance - item.price })
      .eq("id", points.id);

    await supabase.from("point_transactions").insert({
      user_id: user.id,
      amount: -item.price,
      type: "feed",
      description: `${item.name} 구매`,
    });

    // Add experience
    let newExp = activePet.experience + item.exp_reward;
    let newLevel = activePet.level;
    let newExpToNext = activePet.exp_to_next_level;
    let leveledUp = false;

    while (newExp >= newExpToNext && newLevel < 30) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = LEVEL_THRESHOLDS[newLevel - 1] || 99999;
      leveledUp = true;
    }

    await supabase
      .from("user_pets")
      .update({
        experience: newExp,
        level: newLevel,
        exp_to_next_level: newExpToNext,
      })
      .eq("id", activePet.id);

    await supabase.from("pet_feeding_log").insert({
      user_id: user.id,
      pet_id: activePet.id,
      item_id: itemId,
    });

    if (leveledUp) {
      toast.success(`🎉 레벨 업! Lv.${newLevel}!`);
    } else {
      toast.success(`${item.emoji} ${item.name}을(를) 줬어요!`);
    }

    await fetchAll();
    return true;
  };

  const switchPet = async (petId: string) => {
    if (!user) return;
    await supabase.from("user_pets").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("user_pets").update({ is_active: true }).eq("id", petId);
    await fetchAll();
  };

  return {
    pets,
    activePet,
    petTypes,
    items,
    points,
    loading,
    adoptPet,
    feedPet,
    switchPet,
    refetch: fetchAll,
  };
};
