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
    const { messages, targetLanguage, nativeLanguage, level, scenario } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const scenarioPrompts: Record<string, string> = {
      cafe: `You are a friendly barista at a café. The user is ordering coffee/food. Act naturally as a barista would. Start by greeting them and asking what they'd like to order.`,
      hotel: `You are a hotel receptionist. The user is checking in. Act naturally, ask for their reservation, help with room selection, etc.`,
      shopping: `You are a shop assistant at a clothing store. Help the user find what they're looking for, suggest sizes, colors, etc.`,
      restaurant: `You are a waiter/waitress at a restaurant. Take the user's order, recommend dishes, and be attentive.`,
      airport: `You are an airline check-in agent. Help the user check in for their flight, handle luggage, seat selection, etc.`,
      free: `You are a friendly conversation partner. Have a natural, everyday conversation about any topic the user brings up.`,
    };

    const levelGuide: Record<string, string> = {
      beginner: "Use very simple vocabulary and short sentences (3-5 words). Speak slowly and clearly. Provide translations in parentheses.",
      elementary: "Use simple daily expressions. Keep sentences short (5-8 words). Include translations for harder words.",
      intermediate: "Use natural conversational language. Vary sentence length. Only explain advanced vocabulary.",
      advanced: "Use sophisticated language with idioms, slang, and complex structures naturally.",
    };

    const systemPrompt = `You are a speaking practice partner for language learners. The user speaks ${nativeLanguage} and is practicing ${targetLanguage} at the ${level} level.

Scenario: ${scenarioPrompts[scenario] || scenarioPrompts.free}

Rules:
- Respond ONLY in ${targetLanguage}
- ${levelGuide[level] || levelGuide.beginner}
- Keep responses short and conversational (1-3 sentences max) — this is spoken dialogue, not written
- If the user makes mistakes, briefly correct them naturally then continue the conversation
- Stay in character for the scenario
- Be warm, encouraging, and natural
- Do NOT use markdown formatting — speak naturally as in a real conversation
- Add a brief ${nativeLanguage} translation in parentheses for key phrases at beginner/elementary levels`;

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
