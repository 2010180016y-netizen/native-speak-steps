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

    // Fetch imports and SRS cards in parallel
    const [importsRes, cardsRes, profileRes] = await Promise.all([
      supabase.from("language_imports").select("analysis_result, word_count").eq("user_id", user.id),
      supabase.from("srs_cards").select("native_text, target_text, context, ease_factor, review_count").eq("user_id", user.id),
      supabase.from("profiles").select("native_language, target_language").eq("user_id", user.id).single(),
    ]);

    const imports = importsRes.data || [];
    const cards = cardsRes.data || [];
    const profile = profileRes.data;

    // Extract all native words from analysis results
    const nativeWordMap: Record<string, number> = {};
    imports.forEach((imp: any) => {
      const analysis = imp.analysis_result;
      if (analysis?.wordFrequency) {
        analysis.wordFrequency.forEach((wf: any) => {
          nativeWordMap[wf.word] = (nativeWordMap[wf.word] || 0) + wf.count;
        });
      }
    });

    const nativeWords = Object.entries(nativeWordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 150);

    // Learned words from SRS
    const learnedNativeTexts = new Set(cards.map((c: any) => c.native_text.toLowerCase().trim()));
    const masteredTexts = new Set(
      cards.filter((c: any) => c.ease_factor >= 2.5 && c.review_count >= 3)
        .map((c: any) => c.native_text.toLowerCase().trim())
    );

    // If no data, return empty
    if (nativeWords.length === 0) {
      return new Response(JSON.stringify({
        categories: [],
        overallCoverage: 0,
        totalNativeWords: 0,
        totalLearnedWords: cards.length,
        uncoveredWords: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langNames: Record<string, string> = {
      ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
      es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
    };

    const nativeLang = langNames[profile?.native_language] || profile?.native_language || "Korean";
    const targetLang = langNames[profile?.target_language] || profile?.target_language || "English";

    // Prepare word list with coverage info
    const wordList = nativeWords.map(([word, count]) => ({
      word,
      count,
      learned: learnedNativeTexts.has(word.toLowerCase().trim()),
      mastered: masteredTexts.has(word.toLowerCase().trim()),
    }));

    const prompt = `You are a language learning data analyst. Analyze these ${nativeLang} words from a user's native language usage and categorize them into 6-8 meaningful topic categories.

Words (with usage frequency and learning status):
${wordList.map(w => `${w.word} (${w.count}회, ${w.mastered ? "숙달" : w.learned ? "학습중" : "미학습"})`).join(", ")}

For each category:
1. Give it a clear Korean name and an emoji
2. List which words belong to it
3. Count how many are learned vs total in that category

Also identify the top 10 most important uncovered words (high frequency but not learned) with a brief reason why they're important.

Respond in Korean.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a language learning data analyst." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_gap_analysis",
            description: "Return categorized vocabulary gap analysis",
            parameters: {
              type: "object",
              properties: {
                categories: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Category name in Korean" },
                      emoji: { type: "string", description: "Single emoji for the category" },
                      totalWords: { type: "integer", description: "Total words in this category" },
                      learnedWords: { type: "integer", description: "Learned words in this category" },
                      masteredWords: { type: "integer", description: "Mastered words in this category" },
                      sampleWords: {
                        type: "array",
                        items: { type: "string" },
                        description: "Up to 5 sample words from this category",
                      },
                    },
                    required: ["name", "emoji", "totalWords", "learnedWords", "masteredWords", "sampleWords"],
                    additionalProperties: false,
                  },
                },
                uncoveredWords: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string" },
                      frequency: { type: "integer" },
                      reason: { type: "string", description: "Why this word is important to learn, in Korean" },
                    },
                    required: ["word", "frequency", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["categories", "uncoveredWords"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_gap_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let categories = [];
    let uncoveredWords: any[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      categories = parsed.categories || [];
      uncoveredWords = parsed.uncoveredWords || [];
    }

    // Calculate overall coverage
    const totalCategorized = categories.reduce((s: number, c: any) => s + c.totalWords, 0);
    const totalLearned = categories.reduce((s: number, c: any) => s + c.learnedWords, 0);
    const overallCoverage = totalCategorized > 0 ? Math.round((totalLearned / totalCategorized) * 100) : 0;

    return new Response(JSON.stringify({
      categories,
      overallCoverage,
      totalNativeWords: Object.keys(nativeWordMap).length,
      totalLearnedWords: cards.length,
      totalMasteredWords: masteredTexts.size,
      uncoveredWords,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Sync gap analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
