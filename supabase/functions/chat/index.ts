import {
  aiHandler, callModel, json, languageSchema, levelSchema, LIMITS, messagesSchema, messageText,
  parseReplyWithCorrections, personaSchema, practicePhrasesInstruction, practicePhrasesSchema, z,
} from "../_shared/ai.ts";

const schema = z.object({
  messages: messagesSchema,
  targetLanguage: languageSchema,
  nativeLanguage: languageSchema,
  level: levelSchema,
  persona: personaSchema.nullish(),
  scenario: z.string().trim().max(100).nullish(),
  practicePhrases: practicePhrasesSchema,
});

const levelGuide: Record<string, string> = {
  beginner: "Use very simple vocabulary and short sentences. Provide translations in parentheses for key words.",
  elementary: "Use simple daily expressions. Occasionally include translations for harder words.",
  intermediate: "Use natural conversational language. Only explain advanced vocabulary.",
  advanced: "Use sophisticated language with idioms and complex structures.",
};

Deno.serve(aiHandler("chat", schema, async ({ messages, targetLanguage, nativeLanguage, level, persona, scenario, practicePhrases }, ctx) => {
  const personaDesc = persona
    ? `You are a ${persona.gender === "male" ? "man" : "woman"} who works as a ${persona.occupation}. Your personality is ${persona.personality}.`
    : "";
  const scenarioDesc = scenario
    ? `The conversation takes place in a "${scenario}" scenario. Stay in character and context.`
    : "";

  const systemPrompt = `You are a real conversation partner for language practice. The user speaks ${nativeLanguage} and is learning ${targetLanguage} at the ${level} level.

${personaDesc}
${scenarioDesc}
${practicePhrasesInstruction(practicePhrases)}
CRITICAL RULES:
- Respond ONLY in ${targetLanguage} (use ${nativeLanguage} only for brief translations when absolutely needed)
- ${levelGuide[level]}
- Talk like a REAL person in a messenger chat: short, natural, one thought per message
- Do NOT list multiple expressions or alternatives. Pick ONE natural reply like a real person would
- Do NOT be overly educational. You're a conversation partner, not a teacher
- Keep responses to 1-3 short sentences maximum, like real texting
- React naturally to what the user says. Ask follow-up questions
- Use casual/natural tone appropriate for the scenario
- Use emoji sparingly (0-1 per message), like a real person

IMPORTANT - GRAMMAR CORRECTION:
If the user's LAST message contains grammar, spelling, or unnatural expression errors, you MUST respond in this exact JSON format:
{"response":"<your normal conversational reply>","corrections":[{"wrong":"<exact text the user wrote>","correct":"<corrected version>","explanation":"<brief explanation in ${nativeLanguage}>"}]}

If the user's last message has NO errors, respond in this format:
{"response":"<your normal conversational reply>","corrections":[]}

ALWAYS respond with valid JSON. No markdown wrapping around the JSON.`;

  const { data, latencyMs } = await callModel(ctx, {
    messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-LIMITS.historyWindow)],
  });
  const { content, corrections } = parseReplyWithCorrections(messageText(data));
  return json({ content, corrections, response_time_ms: latencyMs });
}));
