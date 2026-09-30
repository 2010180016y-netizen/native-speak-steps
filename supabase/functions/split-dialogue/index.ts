import { aiHandler, callModel, HttpError, json, languageSchema, toolArguments, z } from "../_shared/ai.ts";

const schema = z.object({
  text: z.string().trim().min(1).max(8_000),
  nativeLanguage: languageSchema,
  targetLanguage: languageSchema,
});

const systemPrompt = `You are a dialogue analysis expert. Analyze the given text and split it into a structured dialogue with identified speakers.

Rules:
- Identify distinct speakers from the text (by name, label like A/B, or contextual clues)
- If the text is already formatted as a dialogue (e.g., "A: ...", "Person: ..."), parse it directly
- If not clearly formatted, intelligently detect conversation turns
- Assign speaker labels (use names if found, otherwise "화자 1", "화자 2", etc.)
- Preserve the original language of the dialogue lines
- Return the result using the extract_dialogue function`;

const extractDialogueTool = {
  type: "function",
  function: {
    name: "extract_dialogue",
    description: "Extract structured dialogue with speakers",
    parameters: {
      type: "object",
      properties: {
        speakers: {
          type: "array",
          items: { type: "string" },
          description: "List of unique speaker names/labels",
        },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              speaker: { type: "string", description: "Speaker name/label" },
              text: { type: "string", description: "The dialogue line" },
            },
            required: ["speaker", "text"],
            additionalProperties: false,
          },
        },
        is_dialogue: {
          type: "boolean",
          description: "Whether the text appears to be a dialogue/conversation",
        },
      },
      required: ["speakers", "lines", "is_dialogue"],
      additionalProperties: false,
    },
  },
};

Deno.serve(aiHandler("split-dialogue", schema, async ({ text }, ctx) => {
  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Split this text into a dialogue:\n\n${text}` },
    ],
    tools: [extractDialogueTool],
    tool_choice: { type: "function", function: { name: "extract_dialogue" } },
  });

  const result = toolArguments(data, "extract_dialogue");
  if (!result) throw new HttpError(502, "대화 분리에 실패했어요. 다시 시도해주세요.", "gateway_error");
  return json(result);
}));
