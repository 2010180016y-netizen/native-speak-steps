import { aiHandler, callModel, json, toolArguments, z } from "../_shared/ai.ts";

type Category = { name: string; emoji: string; totalWords: number; learnedWords: number; masteredWords: number; sampleWords: string[] };
type UncoveredWord = { word: string; frequency: number; reason: string };

const LANG_NAMES: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
  es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
};

const gapAnalysisTool = {
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
};

Deno.serve(aiHandler("sync-gap-analysis", z.object({}), async (_body, ctx) => {
  const { supabase, userId } = ctx;
  const [importsRes, cardsRes, profileRes] = await Promise.all([
    supabase.from("language_imports").select("analysis_result").eq("user_id", userId),
    supabase.from("srs_cards").select("native_text, ease_factor, review_count").eq("user_id", userId),
    supabase.from("profiles").select("native_language, target_language").eq("user_id", userId).single(),
  ]);

  const cards = cardsRes.data || [];
  const profile = profileRes.data;

  const nativeWordMap: Record<string, number> = {};
  for (const imp of importsRes.data || []) {
    const frequency = (imp.analysis_result as { wordFrequency?: Array<{ word: string; count: number }> } | null)?.wordFrequency;
    frequency?.forEach((wf) => { nativeWordMap[wf.word] = (nativeWordMap[wf.word] || 0) + wf.count; });
  }
  const nativeWords = Object.entries(nativeWordMap).sort((a, b) => b[1] - a[1]).slice(0, 150);

  const normalize = (s: string) => s.toLowerCase().trim();
  const learnedNativeTexts = new Set(cards.map((c) => normalize(c.native_text)));
  const masteredTexts = new Set(
    cards.filter((c) => c.ease_factor >= 2.5 && c.review_count >= 3).map((c) => normalize(c.native_text)),
  );

  if (nativeWords.length === 0) {
    return json({ categories: [], overallCoverage: 0, totalNativeWords: 0, totalLearnedWords: cards.length, uncoveredWords: [] });
  }

  const nativeLang = LANG_NAMES[profile?.native_language] || profile?.native_language || "Korean";
  const wordList = nativeWords.map(([word, count]) => ({
    word,
    count,
    learned: learnedNativeTexts.has(normalize(word)),
    mastered: masteredTexts.has(normalize(word)),
  }));

  const prompt = `You are a language learning data analyst. Analyze these ${nativeLang} words from a user's native language usage and categorize them into 6-8 meaningful topic categories.

Words (with usage frequency and learning status):
${wordList.map((w) => `${w.word} (${w.count}회, ${w.mastered ? "숙달" : w.learned ? "학습중" : "미학습"})`).join(", ")}

For each category:
1. Give it a clear Korean name and an emoji
2. List which words belong to it
3. Count how many are learned vs total in that category

Also identify the top 10 most important uncovered words (high frequency but not learned) with a brief reason why they're important.

Respond in Korean.`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: "You are a language learning data analyst." },
      { role: "user", content: prompt },
    ],
    tools: [gapAnalysisTool],
    tool_choice: { type: "function", function: { name: "provide_gap_analysis" } },
  });

  const result = toolArguments<{ categories: Category[]; uncoveredWords: UncoveredWord[] }>(data, "provide_gap_analysis");
  const categories = result?.categories ?? [];
  const totalCategorized = categories.reduce((s, c) => s + c.totalWords, 0);
  const totalLearned = categories.reduce((s, c) => s + c.learnedWords, 0);

  return json({
    categories,
    overallCoverage: totalCategorized > 0 ? Math.round((totalLearned / totalCategorized) * 100) : 0,
    totalNativeWords: Object.keys(nativeWordMap).length,
    totalLearnedWords: cards.length,
    totalMasteredWords: masteredTexts.size,
    uncoveredWords: result?.uncoveredWords ?? [],
  });
}));
