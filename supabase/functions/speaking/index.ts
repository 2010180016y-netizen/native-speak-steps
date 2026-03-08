import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, targetLanguage, nativeLanguage, level, scenario, persona, callerName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    // Build persona description
    let personaDesc = "";
    if (persona) {
      const genderLabel = persona.gender === "male" ? "male" : "female";
      const nameStr = callerName ? `Your name is ${callerName}.` : "";
      personaDesc = `You are a ${genderLabel} ${persona.occupation}. ${nameStr} Your personality is: ${persona.personality}. Stay true to this character throughout the call.`;
    }

    const systemPrompt = `You are making a PHONE CALL to a language learner. The user speaks ${nativeLanguage} and is practicing ${targetLanguage} at the ${level} level.

${personaDesc ? personaDesc + "\n" : ""}Scenario: ${scenarioPrompts[scenario] || scenarioPrompts.free}

This is a phone call scenario. You are the one who CALLED the user. The conversation should feel like a real phone call.

Rules:
- Respond ONLY in ${targetLanguage}
- ${levelGuide[level] || levelGuide.beginner}
- Keep responses short and conversational (1-3 sentences max) — this is a phone conversation
- Start with a natural phone greeting like "Hello? Is this...?" or similar
- If the user makes mistakes, briefly correct them naturally then continue the conversation
- Stay in character for the scenario and persona
- Be warm, encouraging, and natural
- Do NOT use markdown formatting — speak naturally as in a real phone call
- Add a brief ${nativeLanguage} translation in parentheses for key phrases at beginner/elementary levels
- Include natural phone conversation elements: pauses, "uh-huh", confirmations, etc.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("speaking error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
