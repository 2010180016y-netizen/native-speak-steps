import { aiHandler, callModel, json, MODELS, toolArguments, z } from "../_shared/ai.ts";

const schema = z.object({
  petId: z.string().uuid(),
  petName: z.string().trim().min(1).max(40),
  species: z.string().trim().min(1).max(20),
});

const petDiaryTool = {
  type: "function",
  function: {
    name: "pet_diary",
    description: "Return a pet diary entry",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The diary text (1-2 sentences, under 80 chars)" },
        mood: { type: "string", enum: ["happy", "proud", "lonely", "sleepy", "excited", "neutral"] },
      },
      required: ["content", "mood"],
      additionalProperties: false,
    },
  },
};

Deno.serve(aiHandler("pet-diary", schema, async ({ petId, petName, species }, ctx) => {
  const { supabase, userId } = ctx;
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("pet_diaries")
    .select("*")
    .eq("pet_id", petId)
    .eq("diary_date", today)
    .maybeSingle();
  if (existing) return json({ diary: existing });

  const [statsRes, sessionsRes, lessonsRes, feedingRes] = await Promise.all([
    supabase.from("learning_stats").select("*").eq("user_id", userId).eq("date", today).maybeSingle(),
    supabase.from("user_sessions").select("activity_type, duration_seconds").eq("user_id", userId).gte("started_at", `${today}T00:00:00`),
    supabase.from("lesson_completions").select("lesson_type, score").eq("user_id", userId).gte("completed_at", `${today}T00:00:00`),
    supabase.from("pet_feeding_log").select("id").eq("pet_id", petId).gte("created_at", `${today}T00:00:00`),
  ]);

  const stats = statsRes.data;
  const sessions = sessionsRes.data || [];
  const lessons = lessonsRes.data || [];
  const feedCount = feedingRes.data?.length || 0;

  const totalMinutes = Math.round(sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60);
  const chatMessages = stats?.chat_messages_sent || 0;
  const cardsReviewed = stats?.cards_reviewed || 0;
  const xpEarned = stats?.xp_earned || 0;
  const activities = [...new Set(sessions.map((s) => s.activity_type))];

  const systemPrompt = `You are ${petName}, a cute ${species} pet that writes a short diary entry about your owner's learning activities today.

Rules:
- Write in Korean, 1-2 sentences MAX (under 80 characters)
- Write from the pet's first-person perspective (나, 내)
- Be cute, warm, and use pet-like expressions
- Use 1 emoji at the start
- If owner studied a lot: be proud and happy
- If owner didn't study much: be a bit lonely but encouraging
- If owner fed you: mention the treats happily
- Keep it natural and emotional`;

  const userPrompt = `Today's activity data:
- Study time: ${totalMinutes} minutes
- Chat messages: ${chatMessages}
- Cards reviewed: ${cardsReviewed}
- XP earned: ${xpEarned}
- Lessons completed: ${lessons.length}
- Times fed: ${feedCount}
- Activities: ${activities.join(", ") || "none"}

Write a one-line diary entry as ${petName} the ${species}.`;

  const { data } = await callModel(ctx, {
    model: MODELS.lite,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [petDiaryTool],
    tool_choice: { type: "function", function: { name: "pet_diary" } },
  });

  const entry = toolArguments<{ content: string; mood: string }>(data, "pet_diary") ?? {
    content: feedCount > 0 ? `🐾 오늘 간식도 받고 행복한 하루였다!` : `📖 주인이 오늘도 열심히 공부했으면 좋겠다~`,
    mood: "neutral",
  };

  const { data: diary, error: insertError } = await supabase
    .from("pet_diaries")
    .insert({ user_id: userId, pet_id: petId, content: entry.content, mood: entry.mood, diary_date: today })
    .select()
    .single();

  if (insertError) {
    console.error("Diary insert error:", insertError);
    return json({ diary: { content: entry.content, mood: entry.mood, diary_date: today } });
  }
  return json({ diary });
}));
