import { aiHandler, callModel, json, languageSchema, messageText, parseJsonContent, z } from "../_shared/ai.ts";

const schema = z.object({
  text: z.string().trim().min(1).max(60_000),
  nativeLanguage: languageSchema,
  targetLanguage: languageSchema,
  totalWordCount: z.number().int().nonnegative().optional(),
  totalUniqueWords: z.number().int().nonnegative().optional(),
  speakerNames: z.array(z.string().trim().max(50)).max(50).default([]),
});

Deno.serve(aiHandler("analyze-text", schema, async ({ text, nativeLanguage, targetLanguage, totalWordCount, totalUniqueWords, speakerNames }, ctx) => {
  const speakerInstruction = speakerNames.length > 0
    ? `\n\nIMPORTANT: Exclude these speaker names/IDs from word frequency analysis (they are chat usernames, not content): ${speakerNames.join(", ")}`
    : "";

  const systemPrompt = `You are a linguistic analysis expert. Analyze the given text and return structured data.
The text is in ${nativeLanguage}. The user is learning ${targetLanguage}.
${speakerInstruction}

Analyze the ENTIRE text from start to end thoroughly and return JSON with these fields:
- wordFrequency: array of {word, count, percentage} sorted by count desc, top 50 (MUST EXCLUDE: speaker names/usernames, timestamps, masked placeholders like [전화번호], single characters, common particles/connectors. In messenger conversations, words that appear very frequently at the start of lines are usually usernames - exclude them.)
- sentenceStructures: array of {pattern, description, count, example} sorted by count desc (e.g. "SVO", "Question", "Conditional", "Imperative", etc.)
- totalSentences: number
- avgSentenceLength: number (words per sentence)
- vocabularyRichness: number (0-100, ratio of unique words to total)
- complexityScore: number (1-10, overall text complexity)
- topBigrams: array of {phrase, count} top 15 two-word combinations (exclude combinations with speaker names)
- topTrigrams: array of {phrase, count} top 10 three-word combinations
- summary: detailed analysis summary in Korean (3-4 sentences)
- keyExpressions: array of {expression, translation, context} top 10 useful expressions for language learning
- emotionalTone: object {positive: number, negative: number, neutral: number} as percentages
${totalWordCount ? `\nNote: The full text has ${totalWordCount} total words and ${totalUniqueWords ?? 0} unique words. Use these for overall statistics even if analyzing a sample.` : ""}

Return ONLY valid JSON, no markdown.`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  });

  const analysis = parseJsonContent<Record<string, unknown>>(messageText(data) || "{}");
  if (totalWordCount) {
    analysis.totalWordCount = totalWordCount;
    analysis.totalUniqueWords = totalUniqueWords;
  }
  return json(analysis);
}));
