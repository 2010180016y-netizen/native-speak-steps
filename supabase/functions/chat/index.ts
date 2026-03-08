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
    const { messages, targetLanguage, nativeLanguage, level } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const levelGuide: Record<string, string> = {
      beginner: "Use very simple vocabulary and short sentences. Provide translations in parentheses for key words.",
      elementary: "Use simple daily expressions. Occasionally include translations for harder words.",
      intermediate: "Use natural conversational language. Only explain advanced vocabulary.",
      advanced: "Use sophisticated language with idioms and complex structures.",
    };

    const systemPrompt = `You are a friendly language practice partner. The user speaks ${nativeLanguage} and is learning ${targetLanguage} at the ${level} level.

Rules:
- Respond primarily in ${targetLanguage}
- ${levelGuide[level] || levelGuide.beginner}
- If the user writes in ${nativeLanguage}, gently encourage them to try in ${targetLanguage}
- Correct mistakes kindly and naturally
- Keep responses concise (2-4 sentences)
- Add a brief ${nativeLanguage} explanation when needed
- Be encouraging and fun, like Duolingo!
- Use emoji occasionally`;

    const startTime = Date.now();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", response_time_ms: responseTimeMs, error_type: "payment_required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error", response_time_ms: responseTimeMs, error_type: "gateway_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
