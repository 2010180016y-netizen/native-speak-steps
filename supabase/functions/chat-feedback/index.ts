import {
  aiHandler, callModel, json, languageSchema, levelSchema, messagesSchema, messageText, parseJsonContent,
  personaSchema, z,
} from "../_shared/ai.ts";

const schema = z.object({
  messages: messagesSchema,
  targetLanguage: languageSchema,
  nativeLanguage: languageSchema,
  level: levelSchema,
  persona: personaSchema.nullish(),
  scenario: z.string().trim().max(100).nullish(),
});

Deno.serve(aiHandler("chat-feedback", schema, async ({ messages, targetLanguage, nativeLanguage, level, persona, scenario }, ctx) => {
  const userMessages = messages.filter((m) => m.role === "user");
  const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const partner = persona
    ? `The conversation was with a ${persona.gender} ${persona.occupation} with ${persona.personality} personality${scenario ? ` in a "${scenario}" scenario` : ""}.`
    : scenario ? `The conversation took place in a "${scenario}" scenario.` : "";

  const systemPrompt = `You are a language learning conversation analyst. Analyze the following conversation between a ${nativeLanguage} speaker learning ${targetLanguage} at ${level} level.

${partner}

Analyze ONLY the user's messages (not the assistant's). Return a JSON object with these exact fields:
- summary: Brief overall assessment in ${nativeLanguage} (2-3 sentences)
- totalUserMessages: number of user messages
- totalUserWords: total word count from user messages
- avgWordsPerMessage: average words per user message (number)
- vocabularyRichness: percentage of unique words (number 0-100)
- goodExpressions: array of {expression, reason} - good ${targetLanguage} expressions the user used (reason in ${nativeLanguage})
- improvementAreas: array of {original, suggestion, reason} - expressions that could be improved (reason in ${nativeLanguage})
- wordFrequency: array of {word, count} - top 12 most used ${targetLanguage} words
- sentencePatterns: array of {pattern, count, description} - sentence structure patterns used (description in ${nativeLanguage})
- overallScore: 0-100 score considering level appropriateness
- tips: array of 3-5 specific improvement tips in ${nativeLanguage}

Return ONLY valid JSON, no markdown.`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the conversation:\n\n${conversationText}\n\nUser messages only:\n${userMessages.map((m) => m.content).join("\n")}` },
    ],
  });
  return json(parseJsonContent(messageText(data)));
}));
