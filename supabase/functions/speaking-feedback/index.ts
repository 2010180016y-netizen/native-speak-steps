import {
  aiHandler, callModel, json, languageSchema, levelSchema, messagesSchema, messageText, parseJsonContent, z,
} from "../_shared/ai.ts";

const schema = z.object({
  messages: messagesSchema,
  targetLanguage: languageSchema,
  nativeLanguage: languageSchema,
  level: levelSchema,
});

Deno.serve(aiHandler("speaking-feedback", schema, async ({ messages, targetLanguage, nativeLanguage, level }, ctx) => {
  if (!messages.some((m) => m.role === "user")) return json({ feedback: null });

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "학습자" : "AI"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `You are an expert language tutor analyzing a ${targetLanguage} speaking practice conversation by a ${level}-level learner whose native language is ${nativeLanguage}.

Analyze ONLY the learner's messages. Respond in ${nativeLanguage}.

Return your analysis in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "overallScore": <number 1-100>,
  "pronunciation": {
    "score": <number 1-100>,
    "comments": ["<string>", ...]
  },
  "grammar": {
    "score": <number 1-100>,
    "errors": [
      { "original": "<what the learner said>", "corrected": "<correct form>", "explanation": "<brief explanation in ${nativeLanguage}>" }
    ]
  },
  "vocabulary": {
    "score": <number 1-100>,
    "comments": ["<string>", ...],
    "newWordsUsed": ["<word>", ...]
  },
  "fluency": {
    "score": <number 1-100>,
    "comments": ["<string>", ...]
  },
  "tips": ["<actionable tip>", "<actionable tip>"]
}

Rules:
- Be encouraging but honest
- If the learner made very few messages, still give feedback on what's available
- Keep comments short (1-2 sentences each)
- Give 2-3 actionable tips
- Score generously for beginners, strictly for advanced`;

  const { data } = await callModel(ctx, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the conversation:\n\n${conversationText}` },
    ],
  });

  const content = messageText(data);
  let feedback: unknown;
  try {
    feedback = parseJsonContent(content);
  } catch {
    console.error("Failed to parse feedback JSON:", content);
    feedback = { raw: content };
  }
  return json({ feedback });
}));
