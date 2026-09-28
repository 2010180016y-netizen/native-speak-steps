import {
  aiHandler, callModel, json, languageSchema, levelSchema, messagesSchema, messageText,
  parseReplyWithCorrections, personaSchema, z,
} from "../_shared/ai.ts";

const schema = z.object({
  messages: messagesSchema,
  targetLanguage: languageSchema,
  nativeLanguage: languageSchema,
  level: levelSchema,
  scenario: z.string().trim().max(50).optional(),
  persona: personaSchema.optional(),
  callerName: z.string().trim().max(40).optional(),
});

const scenarioPrompts: Record<string, string> = {
  cafe: `The caller is calling a café to place a takeout order or ask about the menu.`,
  restaurant: `The caller is calling a restaurant to make a reservation or ask about available tables.`,
  business_meeting: `The caller is calling about a business matter — scheduling a meeting, discussing a project, etc.`,
  job_interview: `The caller is a recruiter calling to conduct a phone interview for a job position.`,
  blind_date: `The caller is someone the user was introduced to, calling to chat and get to know each other.`,
  airport: `The caller is an airline agent calling about a flight change, booking confirmation, or gate info.`,
  hotel: `The caller is calling from a hotel to confirm a reservation or discuss check-in details.`,
  shopping: `The caller is a shop assistant calling to let the user know their order is ready or to follow up.`,
  phone_call: `The caller is making a general phone call — could be scheduling, inquiring, or catching up.`,
  free: `The caller is a friend or acquaintance calling for a casual chat about anything.`,
};

const levelGuide: Record<string, string> = {
  beginner: "Use very simple vocabulary and short sentences (3-5 words). Speak slowly and clearly. Provide translations in parentheses.",
  elementary: "Use simple daily expressions. Keep sentences short (5-8 words). Include translations for harder words.",
  intermediate: "Use natural conversational language. Vary sentence length. Only explain advanced vocabulary.",
  advanced: "Use sophisticated language with idioms, slang, and complex structures naturally.",
};

const LANG_NAMES: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
  es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
};

/** Speaking sends the whole call; only the most recent turns go to the model. */
const HISTORY_WINDOW = 15;

Deno.serve(aiHandler("speaking", schema, async ({ messages, targetLanguage, nativeLanguage, level, scenario, persona, callerName }, ctx) => {
  const targetLangName = LANG_NAMES[targetLanguage] || targetLanguage;
  const nativeLangName = LANG_NAMES[nativeLanguage] || nativeLanguage;

  let personaDesc = "";
  if (persona) {
    const nameStr = callerName ? `Your name is ${callerName}.` : "";
    personaDesc = `You are a ${persona.gender} ${persona.occupation}. ${nameStr} Your personality is: ${persona.personality}. Stay true to this character throughout the call.`;
  }

  // The initial call is a single system-trigger message from the client.
  const isInitialCall = messages.length === 1 && messages[0].role === "user" && messages[0].content.includes("just answered");

  const systemPrompt = `You are making a PHONE CALL to a language learner. The user speaks ${nativeLangName} and is practicing ${targetLangName} at the ${level} level.

${personaDesc ? personaDesc + "\n" : ""}Scenario: ${scenarioPrompts[scenario ?? "free"] || scenarioPrompts.free}

This is a phone call scenario. You are the one who CALLED the user. The conversation should feel like a real phone call.

Rules:
- Respond ONLY in ${targetLangName}
- ${levelGuide[level]}
- Keep responses short and conversational (1-3 sentences max) — this is a phone conversation
- Start with a natural phone greeting — introduce yourself by name (e.g. "Hi, this is ${callerName || "me"}!") and set the context for why you're calling
- Stay in character for the scenario and persona
- Be warm, encouraging, and natural
- Do NOT use markdown formatting — speak naturally as in a real phone call
- Add a brief ${nativeLangName} translation in parentheses for key phrases at beginner/elementary levels
- Include natural phone conversation elements: pauses, "uh-huh", confirmations, etc.

IMPORTANT - GRAMMAR CORRECTION:
${isInitialCall ? `For the initial greeting, just respond normally with: {"response":"<your greeting>","corrections":[]}` : `If the user's LAST message contains grammar, spelling, or unnatural expression errors, you MUST respond in this exact JSON format:
{"response":"<your normal conversational reply>","corrections":[{"wrong":"<exact text the user said>","correct":"<corrected version>","explanation":"<brief explanation in ${nativeLangName}>"}]}

If the user's last message has NO errors, respond in this format:
{"response":"<your normal conversational reply>","corrections":[]}`}

ALWAYS respond with valid JSON. No markdown wrapping around the JSON.`;

  const { data } = await callModel(ctx, {
    messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-HISTORY_WINDOW)],
  });
  return json(parseReplyWithCorrections(messageText(data)));
}));
