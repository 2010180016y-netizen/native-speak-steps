import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { petId, petName, species } = await req.json();
    const today = new Date().toISOString().split("T")[0];

    // Check if diary already exists for today
    const { data: existing } = await supabase
      .from("pet_diaries")
      .select("*")
      .eq("pet_id", petId)
      .eq("diary_date", today)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ diary: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch today's learning stats
    const [statsRes, sessionsRes, lessonsRes, feedingRes] = await Promise.all([
      supabase.from("learning_stats").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("user_sessions").select("activity_type, duration_seconds").eq("user_id", user.id).gte("started_at", `${today}T00:00:00`),
      supabase.from("lesson_completions").select("lesson_type, score").eq("user_id", user.id).gte("completed_at", `${today}T00:00:00`),
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

    const activitySummary = {
      totalMinutes,
      chatMessages,
      cardsReviewed,
      xpEarned,
      lessonCount: lessons.length,
      feedCount,
      activities: sessions.map(s => s.activity_type).filter((v, i, a) => a.indexOf(v) === i),
    };

    // Generate diary via AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
- Study time: ${activitySummary.totalMinutes} minutes
- Chat messages: ${chatMessages}
- Cards reviewed: ${cardsReviewed}
- XP earned: ${xpEarned}
- Lessons completed: ${activitySummary.lessonCount}
- Times fed: ${feedCount}
- Activities: ${activitySummary.activities.join(", ") || "none"}

Write a one-line diary entry as ${petName} the ${species}.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
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
        }],
        tool_choice: { type: "function", function: { name: "pet_diary" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let diaryContent: string;
    let mood: string;

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      const parsed = JSON.parse(toolCall.function.arguments);
      diaryContent = parsed.content;
      mood = parsed.mood;
    } catch {
      diaryContent = feedCount > 0
        ? `🐾 오늘 간식도 받고 행복한 하루였다!`
        : `📖 주인이 오늘도 열심히 공부했으면 좋겠다~`;
      mood = "neutral";
    }

    // Save diary
    const { data: diary, error: insertError } = await supabase
      .from("pet_diaries")
      .insert({
        user_id: user.id,
        pet_id: petId,
        content: diaryContent,
        mood,
        diary_date: today,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Diary insert error:", insertError);
      return new Response(JSON.stringify({ diary: { content: diaryContent, mood, diary_date: today } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ diary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pet-diary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
