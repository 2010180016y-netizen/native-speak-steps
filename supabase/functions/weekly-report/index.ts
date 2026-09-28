import { aiHandler, callModel, json, toolArguments, z } from "../_shared/ai.ts";

const LANG_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語", zh: "中文",
  es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
};

const weeklyReportTool = {
  type: "function",
  function: {
    name: "weekly_report",
    description: "Return a structured weekly learning report",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "Short motivational headline (under 50 chars)" },
        summary: { type: "string", description: "2-3 sentence overall summary" },
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              emoji: { type: "string" },
              text: { type: "string" },
            },
            required: ["emoji", "text"],
            additionalProperties: false,
          },
        },
        tip: { type: "string", description: "One actionable tip for next week" },
        grade: { type: "string", enum: ["S", "A", "B", "C", "D"], description: "Overall week grade" },
      },
      required: ["headline", "summary", "insights", "tip", "grade"],
      additionalProperties: false,
    },
  },
};

Deno.serve(aiHandler("weekly-report", z.object({}), async (_body, ctx) => {
  const { supabase, userId } = ctx;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const [statsRes, cardsRes, sessionsRes, lessonsRes, profileRes, feedbackRes] = await Promise.all([
    supabase.from("learning_stats").select("*").eq("user_id", userId).gte("date", weekAgoStr.split("T")[0]),
    supabase.from("srs_cards").select("id, review_count, ease_factor, difficulty").eq("user_id", userId),
    supabase.from("user_sessions").select("activity_type, duration_seconds, started_at").eq("user_id", userId).gte("started_at", weekAgoStr),
    supabase.from("lesson_completions").select("lesson_type, score, duration_seconds, completed_at").eq("user_id", userId).gte("completed_at", weekAgoStr),
    supabase.from("profiles").select("streak_days, total_xp, current_level, native_language, target_language, display_name").eq("user_id", userId).single(),
    supabase.from("ai_feedback").select("rating, response_time_ms, feature").eq("user_id", userId).gte("created_at", weekAgoStr),
  ]);

  const stats = statsRes.data || [];
  const cards = cardsRes.data || [];
  const sessions = sessionsRes.data || [];
  const lessons = lessonsRes.data || [];
  const profile = profileRes.data;
  const feedback = feedbackRes.data || [];

  const sum = <T>(rows: T[], pick: (row: T) => number | null) => rows.reduce((s, r) => s + (pick(r) || 0), 0);
  const activeDays = stats.length;

  const sessionsByType: Record<string, number> = {};
  sessions.forEach((s) => {
    sessionsByType[s.activity_type] = (sessionsByType[s.activity_type] || 0) + (s.duration_seconds || 0);
  });

  const lessonCount = lessons.length;
  const positiveRatings = feedback.filter((f) => f.rating === 1).length;
  const totalRatings = feedback.filter((f) => f.rating !== null).length;

  const week = {
    activeDays,
    xpEarned: sum(stats, (r) => r.xp_earned),
    wordsAnalyzed: sum(stats, (r) => r.native_words_analyzed),
    wordsLearned: sum(stats, (r) => r.target_words_learned),
    cardsReviewed: sum(stats, (r) => r.cards_reviewed),
    chatMessages: sum(stats, (r) => r.chat_messages_sent),
    studyMinutes: Math.round(sum(sessions, (r) => r.duration_seconds) / 60),
    sessionsByType,
    lessonCount,
    avgScore: lessonCount > 0 ? Math.round(sum(lessons, (l) => l.score) / lessonCount) : 0,
    totalCards: cards.length,
    masteredCards: cards.filter((c) => c.ease_factor >= 2.5 && c.review_count >= 3).length,
    satisfactionRate: totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null,
  };

  const nativeLang = profile?.native_language || "ko";
  const targetLang = profile?.target_language || "en";

  const systemPrompt = `You are a friendly language learning coach. Generate a concise weekly learning report summary in Korean.
The user is learning ${LANG_NAMES[targetLang] || targetLang} from ${LANG_NAMES[nativeLang] || nativeLang}.

Rules:
- Write in Korean, warm and encouraging tone
- Use emojis sparingly (2-3 max)
- Keep under 200 characters for the headline
- Provide 3-4 specific insights based on the data
- Include one actionable tip for next week
- If data is sparse, still be encouraging about any progress`;

  const userPrompt = `Generate a weekly report summary for this data:
${JSON.stringify(week, null, 2)}
User: ${profile?.display_name || "학습자"}, Level: ${profile?.current_level || "beginner"}, Streak: ${profile?.streak_days || 0} days`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [weeklyReportTool],
    tool_choice: { type: "function", function: { name: "weekly_report" } },
  });

  const report = toolArguments(data, "weekly_report") ?? {
    headline: "이번 주도 수고했어요! 💪",
    summary: "학습 데이터를 기반으로 리포트를 생성하는 중 문제가 발생했습니다.",
    insights: [{ emoji: "📊", text: `이번 주 ${activeDays}일 활동했습니다.` }],
    tip: "꾸준히 학습을 이어가 보세요!",
    grade: "B",
  };

  return json({ report, stats: week, generatedAt: new Date().toISOString() });
}));
