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

    // The points row is created server-side at signup.
    setPoints((pointsRes.data as UserPoints) ?? null);

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

    const { data: newPetId, error } = await supabase.rpc("adopt_pet", { p_pet_type_id: petTypeId, p_name: name });
    if (error || !newPetId) {
      toast.error("입양에 실패했어요");
      return false;
    }

    toast.success(`${name}이(가) 가족이 되었어요! 🎉`);
    
    // Generate initial pet image
    generatePetImage(newPetId, 1);
    
    await fetchAll();
    return true;
  };

  const generatePetImage = async (petId: string, level: number) => {
    // Only generate at milestone levels; the server picks the stage from the pet's stored level.
    if (!IMAGE_MILESTONES.includes(level)) return;

    try {
      toast.info("🎨 펫 이미지를 생성하고 있어요...");
      const { data, error } = await supabase.functions.invoke("generate-pet-image", {
        body: { petId },
      });

      if (error) {
        console.error("Image generation error:", error);
        return;
      }

      if (data?.image_url) {
        toast.success("✨ 새로운 펫 이미지가 생성되었어요!");
        await fetchAll();
      }
    } catch (e) {
      console.error("Failed to generate pet image:", e);
    }
  };

  const feedPet = async (itemId: string) => {
    if (!user || !points || !activePet) return false;
    const item = items.find((i) => i.id === itemId);
    if (!item) return false;

    if (item.price > points.balance) {
      toast.error("포인트가 부족해요! 😢");
      return false;
    }

    const { data, error } = await supabase.rpc("feed_pet", { p_pet_id: activePet.id, p_item_id: itemId });
    if (error || !data) {
      toast.error("먹이 주기에 실패했어요");
      return false;
    }
    const { level: newLevel, leveled_up: leveledUp } = data as { level: number; leveled_up: boolean };

    if (leveledUp) {
      toast.success(`🎉 레벨 업! Lv.${newLevel}!`);
      generatePetImage(activePet.id, newLevel);
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
