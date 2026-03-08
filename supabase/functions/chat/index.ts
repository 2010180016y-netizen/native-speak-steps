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
    const { messages, targetLanguage, nativeLanguage, level, persona, scenario } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const levelGuide: Record<string, string> = {
      beginner: "Use very simple vocabulary and short sentences. Provide translations in parentheses for key words.",
      elementary: "Use simple daily expressions. Occasionally include translations for harder words.",
      intermediate: "Use natural conversational language. Only explain advanced vocabulary.",
      advanced: "Use sophisticated language with idioms and complex structures.",
    };

    // Build persona description
    const personaDesc = persona
      ? `You are a ${persona.gender === "male" ? "man" : "woman"} who works as a ${persona.occupation}. Your personality is ${persona.personality}.`
      : "";
    
    const scenarioDesc = scenario
      ? `The conversation takes place in a "${scenario}" scenario. Stay in character and context.`
      : "";

    const systemPrompt = `You are a real conversation partner for language practice. The user speaks ${nativeLanguage} and is learning ${targetLanguage} at the ${level} level.

${personaDesc}
${scenarioDesc}

CRITICAL RULES:
- Respond ONLY in ${targetLanguage} (use ${nativeLanguage} only for brief translations when absolutely needed)
- ${levelGuide[level] || levelGuide.beginner}
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

    const startTime = Date.now();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded", response_time_ms: responseTimeMs, error_type: "rate_limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", response_time_ms: responseTimeMs, error_type: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error", response_time_ms: responseTimeMs, error_type: "gateway_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content, response_time_ms: responseTimeMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", error_type: "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
