import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const userMessages = messages.filter((m: any) => m.role === "user");
    if (userMessages.length === 0) {
      return new Response(JSON.stringify({ feedback: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conversationText = messages
      .map((m: any) => `${m.role === "user" ? "학습자" : "AI"}: ${m.content}`)
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
          { role: "user", content: `Here is the conversation:\n\n${conversationText}` },
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
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip markdown code blocks if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let feedback;
    try {
      feedback = JSON.parse(content);
    } catch {
      console.error("Failed to parse feedback JSON:", content);
      feedback = { raw: content };
    }

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("speaking-feedback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
