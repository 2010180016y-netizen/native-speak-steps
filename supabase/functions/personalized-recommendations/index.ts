import { aiHandler, callModel, json, toolArguments, z } from "../_shared/ai.ts";

type Recommendation = { title: string; description: string; category: string; priority: string; action_path: string };

const FALLBACK_RECOMMENDATIONS: Recommendation[] = [
  { title: "복습 카드 확인", description: "오늘 복습할 카드가 있습니다. 잊기 전에 확인하세요.", category: "review", priority: "high", action_path: "/cards" },
  { title: "내 텍스트로 단어 추가", description: "모국어 텍스트를 가져와 새로운 표현을 추출하세요.", category: "vocabulary", priority: "medium", action_path: "/import" },
  { title: "배운 표현으로 대화하기", description: "학습한 단어를 실제 대화에서 활용해보세요.", category: "speaking", priority: "medium", action_path: "/chat" },
  { title: "약한 카드 집중 복습", description: "어려운 카드를 집중적으로 복습해 실력을 다지세요.", category: "review", priority: "low", action_path: "/cards" },
];

const LANG_NAMES: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
  es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
};

const recommendationsTool = {
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
};

Deno.serve(aiHandler("personalized-recommendations", z.object({}), async (_body, ctx) => {
  const { supabase, userId } = ctx;
  const [profileRes, cardsRes, sessionsRes, completionsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("srs_cards").select("ease_factor, review_count, difficulty, interval_days").eq("user_id", userId),
    supabase.from("user_sessions").select("activity_type, duration_seconds, started_at").eq("user_id", userId).order("started_at", { ascending: false }).limit(30),
    supabase.from("lesson_completions").select("lesson_type, score, duration_seconds, completed_at").eq("user_id", userId).order("completed_at", { ascending: false }).limit(20),
  ]);

  const profile = profileRes.data;
  const cards = cardsRes.data || [];
  const sessions = sessionsRes.data || [];
  const completions = completionsRes.data || [];

  const totalCards = cards.length;
  const masteredCards = cards.filter((c) => c.ease_factor >= 2.5 && c.review_count >= 3).length;
  const weakCards = cards.filter((c) => c.ease_factor < 2.0 || c.difficulty >= 3).length;
  const avgScore = completions.length > 0
    ? Math.round(completions.reduce((s, c) => s + (c.score || 0), 0) / completions.length)
    : 0;
  const totalStudyMinutes = sessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0) / 60;
  const activityCounts: Record<string, number> = {};
  sessions.forEach((s) => { activityCounts[s.activity_type] = (activityCounts[s.activity_type] || 0) + 1; });
  const byUsage = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]);
  const mostUsedActivity = byUsage[0]?.[0] || "none";
  const leastUsedActivity = byUsage[byUsage.length - 1]?.[0] || "none";

  const prompt = `You are a language learning advisor for the LangSync app. LangSync's core concept is: "You only need to learn what you actually use in your native language." Users import their real native language content (texts, articles, conversations) and the app extracts vocabulary and sentence patterns from that content for efficient learning.

Generate exactly 4 personalized learning recommendations in JSON format.

IMPORTANT RULES:
- NEVER suggest generic language tips like "basic pronunciation practice", "start a streak", "daily challenge", or "grammar drills"
- Every recommendation MUST relate to the user's actual imported content, SRS review cards, or conversation practice using their real vocabulary
- Focus on: reviewing weak cards, importing more native content, practicing learned words in conversation, analyzing usage patterns

User profile:
- Native language: ${LANG_NAMES[profile?.native_language] || profile?.native_language}
- Target language: ${LANG_NAMES[profile?.target_language] || profile?.target_language}
- Level: ${profile?.current_level}
- Total XP: ${profile?.total_xp}

Learning metrics (last 14 days):
- Total study time: ${Math.round(totalStudyMinutes)} minutes
- Total vocabulary cards: ${totalCards} (mastered: ${masteredCards}, weak: ${weakCards})
- Average lesson score: ${avgScore}%
- Most used activity: ${mostUsedActivity}
- Least used activity: ${leastUsedActivity}
- Recent completions: ${completions.length}

Respond in Korean (한국어).`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: "You are a language learning advisor." },
      { role: "user", content: prompt },
    ],
    tools: [recommendationsTool],
    tool_choice: { type: "function", function: { name: "provide_recommendations" } },
  });

  const result = toolArguments<{ recommendations: Recommendation[] }>(data, "provide_recommendations");
  return json({ recommendations: result?.recommendations ?? FALLBACK_RECOMMENDATIONS });
}));
