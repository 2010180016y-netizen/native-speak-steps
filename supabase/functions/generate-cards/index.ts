import { aiHandler, callModel, HttpError, json, languageSchema, levelSchema, toolArguments, z } from "../_shared/ai.ts";

const schema = z.object({
  text: z.string().trim().min(1).max(20_000),
  nativeLanguage: languageSchema,
  targetLanguage: languageSchema,
  level: levelSchema,
});

const extractCardsTool = {
  type: "function",
  function: {
    name: "extract_cards",
    description: "Extract key expressions and their translations as flashcards",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              native_text: { type: "string", description: "The expression in the native language" },
              target_text: { type: "string", description: "Translation in the target language" },
              context: { type: "string", description: "Brief usage tip or example sentence in target language" },
            },
            required: ["native_text", "target_text", "context"],
            additionalProperties: false,
          },
        },
      },
      required: ["cards"],
      additionalProperties: false,
    },
  },
};

Deno.serve(aiHandler("generate-cards", schema, async ({ text, nativeLanguage, targetLanguage, level }, ctx) => {
  const systemPrompt = `You are a language learning assistant. Extract 5-10 key expressions/phrases from the user's native language text that would be most useful to learn in ${targetLanguage}.

The user's level is "${level}". Choose expressions appropriate for their level.

You MUST respond by calling the extract_cards function with the extracted cards.`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Extract key expressions from this ${nativeLanguage} text and translate them to ${targetLanguage}:\n\n${text}` },
    ],
    tools: [extractCardsTool],
    tool_choice: { type: "function", function: { name: "extract_cards" } },
  });

  const result = toolArguments<{ cards: unknown[] }>(data, "extract_cards");
  if (!result) throw new HttpError(502, "카드를 생성하지 못했어요. 다시 시도해주세요.", "gateway_error");
  return json({ cards: result.cards });
}));
