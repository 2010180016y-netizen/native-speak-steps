import { aiHandler, callModel, json, languageSchema, messageText, parseJsonContent, z } from "../_shared/ai.ts";

const schema = z.object({
  text: z.string().trim().min(1).max(60_000),
  nativeLanguage: languageSchema,
  targetLanguage: languageSchema,
  speakerNames: z.array(z.string().trim().max(50)).max(50).default([]),
});

// Word counts, frequencies and sentence stats are computed in the client (src/lib/textProcessor.ts);
// the model only does what needs judgement: sentence patterns, expressions, tone and a summary.
Deno.serve(aiHandler("analyze-text", schema, async ({ text, nativeLanguage, targetLanguage, speakerNames }, ctx) => {
  const speakerInstruction = speakerNames.length > 0
    ? `\n\nIMPORTANT: These are chat usernames, not content. Ignore them: ${speakerNames.join(", ")}`
    : "";

  const systemPrompt = `You are a linguistic analysis expert. Analyze the given text and return structured data.
The text is in ${nativeLanguage}. The user is learning ${targetLanguage}.
${speakerInstruction}

Analyze the ENTIRE text from start to end and return JSON with these fields:
- sentenceStructures: array of {pattern, description, count, example} sorted by count desc (e.g. "SVO", "Question", "Conditional", "Imperative", etc.)
- complexityScore: number (1-10, overall text complexity)
- summary: detailed analysis summary in Korean (3-4 sentences)
- keyExpressions: array of {expression, translation, context} top 10 useful expressions for language learning, with translation in ${targetLanguage}
- emotionalTone: object {positive: number, negative: number, neutral: number} as percentages

Return ONLY valid JSON, no markdown.`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  });

  return json(parseJsonContent<Record<string, unknown>>(messageText(data) || "{}"));
}));
