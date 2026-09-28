import { aiHandler, callModel, json, messageText, z } from "../_shared/ai.ts";

const schema = z.object({
  target_text: z.string().trim().min(1).max(200),
  native_text: z.string().trim().max(200).optional(),
});

Deno.serve(aiHandler("generate-examples", schema, async ({ target_text, native_text }, ctx) => {
  const prompt = `Generate 3 natural, practical example sentences using the English word/phrase "${target_text}" (meaning: ${native_text || "unknown"}).

Rules:
- Each sentence should show a different real-life context
- Keep sentences at intermediate level (B1-B2)
- After each English sentence, add its Korean translation
- Format: numbered list

Respond in this exact format:
1. [English sentence]
→ [Korean translation]

2. [English sentence]
→ [Korean translation]

3. [English sentence]
→ [Korean translation]`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: "You are a language learning assistant. Generate practical example sentences." },
      { role: "user", content: prompt },
    ],
  });
  return json({ examples: messageText(data) });
}));
