import { supabase } from "@/integrations/supabase/client";

const MILESTONES = [
  { days: 1, points: 10, badge: "🌱", name: "첫 걸음" },
  { days: 3, points: 30, badge: "🔥", name: "불꽃 시작" },
  { days: 7, points: 100, badge: "⭐", name: "일주일 챔피언" },
  { days: 14, points: 250, badge: "💎", name: "2주 마스터" },
  { days: 30, points: 500, badge: "🏆", name: "한 달 전설" },
  { days: 60, points: 500, badge: "🌟", name: "두 달 영웅" },
  { days: 90, points: 500, badge: "👑", name: "세 달 왕" },
];

export const MILESTONE_LIST = MILESTONES;

export const checkAndAwardMilestone = async (userId: string, streakDays: number) => {
  // Find applicable milestones
  const applicable = MILESTONES.filter((m) => m.days === streakDays);
  if (applicable.length === 0) return null;

  const milestone = applicable[0];

  // Check if already awarded
  const { data: existing } = await supabase
    .from("point_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "milestone")
    .eq("description", `${milestone.days}일 연속 학습: ${milestone.name}`)
    .maybeSingle();

  if (existing) return null;

  // Award points
  const { data: pointsData } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (pointsData) {
    await supabase
      .from("user_points")
      .update({ balance: (pointsData as any).balance + milestone.points })
      .eq("id", (pointsData as any).id);
  } else {
    await supabase
      .from("user_points")
      .insert({ user_id: userId, balance: milestone.points });
  }

  await supabase.from("point_transactions").insert({
    user_id: userId,
    amount: milestone.points,
    type: "milestone",
    description: `${milestone.days}일 연속 학습: ${milestone.name}`,
  });

  return milestone;
};
