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

    const userMessages = messages.filter((m: any) => m.role === "user");
    const conversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");

    const systemPrompt = `You are a language learning conversation analyst. Analyze the following conversation between a ${nativeLanguage} speaker learning ${targetLanguage} at ${level} level.

The conversation was with a ${persona.gender} ${persona.occupation} with ${persona.personality} personality in a "${scenario}" scenario.

Analyze ONLY the user's messages (not the assistant's). Return a JSON object with these exact fields:
- summary: Brief overall assessment in ${nativeLanguage} (2-3 sentences)
- totalUserMessages: number of user messages
- totalUserWords: total word count from user messages
- avgWordsPerMessage: average words per user message (number)
- vocabularyRichness: percentage of unique words (number 0-100)
- goodExpressions: array of {expression, reason} - good ${targetLanguage} expressions the user used (reason in ${nativeLanguage})
- improvementAreas: array of {original, suggestion, reason} - expressions that could be improved (reason in ${nativeLanguage})
- wordFrequency: array of {word, count} - top 12 most used ${targetLanguage} words
- sentencePatterns: array of {pattern, count, description} - sentence structure patterns used (description in ${nativeLanguage})
- overallScore: 0-100 score considering level appropriateness
- tips: array of 3-5 specific improvement tips in ${nativeLanguage}

Return ONLY valid JSON, no markdown.`;

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
          { role: "user", content: `Here is the conversation:\n\n${conversationText}\n\nUser messages only:\n${userMessages.map((m: any) => m.content).join("\n")}` },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Clean markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
