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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get dates for last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    // Fetch all weekly data in parallel
    const [statsRes, cardsRes, sessionsRes, lessonsRes, profileRes, feedbackRes] = await Promise.all([
      supabase.from("learning_stats").select("*").eq("user_id", user.id).gte("date", weekAgo.toISOString().split("T")[0]),
      supabase.from("srs_cards").select("id, review_count, ease_factor, difficulty").eq("user_id", user.id),
      supabase.from("user_sessions").select("activity_type, duration_seconds, started_at").eq("user_id", user.id).gte("started_at", weekAgoStr),
      supabase.from("lesson_completions").select("lesson_type, score, duration_seconds, completed_at").eq("user_id", user.id).gte("completed_at", weekAgoStr),
      supabase.from("profiles").select("streak_days, total_xp, current_level, native_language, target_language, display_name").eq("user_id", user.id).single(),
      supabase.from("ai_feedback").select("rating, response_time_ms, feature").eq("user_id", user.id).gte("created_at", weekAgoStr),
    ]);

    const stats = statsRes.data || [];
    const cards = cardsRes.data || [];
    const sessions = sessionsRes.data || [];
    const lessons = lessonsRes.data || [];
    const profile = profileRes.data;
    const feedback = feedbackRes.data || [];

    // Aggregate stats
    const totalXpEarned = stats.reduce((s, r) => s + (r.xp_earned || 0), 0);
    const totalWordsAnalyzed = stats.reduce((s, r) => s + (r.native_words_analyzed || 0), 0);
    const totalWordsLearned = stats.reduce((s, r) => s + (r.target_words_learned || 0), 0);
    const totalCardsReviewed = stats.reduce((s, r) => s + (r.cards_reviewed || 0), 0);
    const totalChatMessages = stats.reduce((s, r) => s + (r.chat_messages_sent || 0), 0);
    const activeDays = stats.length;

    const totalSessionMinutes = Math.round(sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60);
    const sessionsByType: Record<string, number> = {};
    sessions.forEach(s => {
      sessionsByType[s.activity_type] = (sessionsByType[s.activity_type] || 0) + (s.duration_seconds || 0);
    });

    const lessonCount = lessons.length;
    const avgScore = lessonCount > 0 ? Math.round(lessons.reduce((s, l) => s + (l.score || 0), 0) / lessonCount) : 0;

    const totalCards = cards.length;
    const masteredCards = cards.filter(c => c.ease_factor >= 2.5 && c.review_count >= 3).length;

    const positiveRatings = feedback.filter(f => f.rating === 1).length;
    const totalRatings = feedback.filter(f => f.rating !== null).length;
    const satisfactionRate = totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null;

    // Build summary data for AI
    const summaryData = {
      userName: profile?.display_name || "학습자",
      nativeLang: profile?.native_language || "ko",
      targetLang: profile?.target_language || "en",
      level: profile?.current_level || "beginner",
      streak: profile?.streak_days || 0,
      totalXp: profile?.total_xp || 0,
      week: {
        activeDays,
        xpEarned: totalXpEarned,
        wordsAnalyzed: totalWordsAnalyzed,
        wordsLearned: totalWordsLearned,
        cardsReviewed: totalCardsReviewed,
        chatMessages: totalChatMessages,
        studyMinutes: totalSessionMinutes,
        sessionsByType,
        lessonCount,
        avgScore,
        totalCards,
        masteredCards,
        satisfactionRate,
      },
    };

    // Generate AI summary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langNames: Record<string, string> = {
      ko: "한국어", en: "English", ja: "日本語", zh: "中文",
      es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
    };

    const systemPrompt = `You are a friendly language learning coach. Generate a concise weekly learning report summary in Korean.
The user is learning ${langNames[summaryData.targetLang] || summaryData.targetLang} from ${langNames[summaryData.nativeLang] || summaryData.nativeLang}.

Rules:
- Write in Korean, warm and encouraging tone
- Use emojis sparingly (2-3 max)
- Keep under 200 characters for the headline
- Provide 3-4 specific insights based on the data
- Include one actionable tip for next week
- If data is sparse, still be encouraging about any progress`;

    const userPrompt = `Generate a weekly report summary for this data:
${JSON.stringify(summaryData.week, null, 2)}
User: ${summaryData.userName}, Level: ${summaryData.level}, Streak: ${summaryData.streak} days`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
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
          },
        ],
        tool_choice: { type: "function", function: { name: "weekly_report" } },
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
    let report;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      report = JSON.parse(toolCall.function.arguments);
    } catch {
      report = {
        headline: "이번 주도 수고했어요! 💪",
        summary: "학습 데이터를 기반으로 리포트를 생성하는 중 문제가 발생했습니다.",
        insights: [{ emoji: "📊", text: `이번 주 ${activeDays}일 활동했습니다.` }],
        tip: "꾸준히 학습을 이어가 보세요!",
        grade: "B",
      };
    }

    return new Response(JSON.stringify({
      report,
      stats: summaryData.week,
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
