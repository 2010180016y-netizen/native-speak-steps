import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user data in parallel
    const [profileRes, statsRes, cardsRes, sessionsRes, completionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("learning_stats").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(14),
      supabase.from("srs_cards").select("ease_factor, review_count, difficulty, interval_days").eq("user_id", user.id),
      supabase.from("user_sessions").select("activity_type, duration_seconds, started_at").eq("user_id", user.id).order("started_at", { ascending: false }).limit(30),
      supabase.from("lesson_completions").select("lesson_type, score, duration_seconds, completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(20),
    ]);

    const profile = profileRes.data;
    const recentStats = statsRes.data || [];
    const cards = cardsRes.data || [];
    const sessions = sessionsRes.data || [];
    const completions = completionsRes.data || [];

    // Calculate summary metrics
    const totalCards = cards.length;
    const masteredCards = cards.filter((c: any) => c.ease_factor >= 2.5 && c.review_count >= 3).length;
    const weakCards = cards.filter((c: any) => c.ease_factor < 2.0 || c.difficulty >= 3).length;
    const avgScore = completions.length > 0
      ? Math.round(completions.reduce((s: number, c: any) => s + (c.score || 0), 0) / completions.length)
      : 0;
    const totalStudyMinutes = sessions.reduce((s: number, sess: any) => s + (sess.duration_seconds || 0), 0) / 60;
    const activityTypes = sessions.reduce((acc: Record<string, number>, s: any) => {
      acc[s.activity_type] = (acc[s.activity_type] || 0) + 1;
      return acc;
    }, {});
    const mostUsedActivity = Object.entries(activityTypes).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || "none";
    const leastUsedActivity = Object.entries(activityTypes).sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0] || "none";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langNames: Record<string, string> = {
      ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
      es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
    };

    const prompt = `You are a language learning advisor for the LangSync app. Generate exactly 4 personalized learning recommendations in JSON format.

User profile:
- Native language: ${langNames[profile?.native_language] || profile?.native_language}
- Target language: ${langNames[profile?.target_language] || profile?.target_language}
- Level: ${profile?.current_level}
- Streak: ${profile?.streak_days} days
- Total XP: ${profile?.total_xp}

Learning metrics (last 14 days):
- Total study time: ${Math.round(totalStudyMinutes)} minutes
- Total vocabulary cards: ${totalCards} (mastered: ${masteredCards}, weak: ${weakCards})
- Average lesson score: ${avgScore}%
- Most used activity: ${mostUsedActivity}
- Least used activity: ${leastUsedActivity}
- Recent completions: ${completions.length}

Generate recommendations that are specific to their level, language pair, and learning patterns. Each recommendation should have an actionable suggestion.

Respond in Korean (한국어).`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a language learning advisor." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_recommendations",
            description: "Return personalized learning recommendations",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Short title in Korean" },
                      description: { type: "string", description: "Detailed recommendation in Korean, 1-2 sentences" },
                      category: { type: "string", enum: ["vocabulary", "speaking", "review", "habit", "challenge"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      action_path: { type: "string", description: "App route: /cards, /chat, /speaking, /import, /stats" },
                    },
                    required: ["title", "description", "category", "priority", "action_path"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_recommendations" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let recommendations;

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      recommendations = parsed.recommendations;
    } else {
      // Fallback defaults
      recommendations = [
        { title: "복습 카드 확인", description: "오늘 복습할 카드가 있습니다.", category: "review", priority: "high", action_path: "/cards" },
        { title: "회화 연습", description: "AI와 대화하며 실력을 키워보세요.", category: "speaking", priority: "medium", action_path: "/chat" },
        { title: "새 단어 학습", description: "모국어 텍스트를 분석해 새 단어를 추가하세요.", category: "vocabulary", priority: "medium", action_path: "/import" },
        { title: "스피킹 도전", description: "발음 연습으로 말하기 실력을 높여보세요.", category: "challenge", priority: "low", action_path: "/speaking" },
      ];
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
