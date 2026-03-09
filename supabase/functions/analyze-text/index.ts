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
    const { 
      text, 
      nativeLanguage, 
      targetLanguage, 
      totalWordCount, 
      totalUniqueWords,
      speakerNames = []
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Create speaker exclusion instruction if speakers are provided
    const speakerInstruction = speakerNames.length > 0 
      ? `\n\nIMPORTANT: Exclude these speaker names/IDs from word frequency analysis (they are chat usernames, not content): ${speakerNames.join(", ")}`
      : "";

    const systemPrompt = `You are a linguistic analysis expert. Analyze the given text and return structured data.
The text is in ${nativeLanguage}. The user is learning ${targetLanguage}.
${speakerInstruction}

Analyze the ENTIRE text from start to end thoroughly and return JSON with these fields:
- wordFrequency: array of {word, count, percentage} sorted by count desc, top 50 (MUST EXCLUDE: speaker names/usernames, timestamps, masked placeholders like [전화번호], single characters, common particles/connectors. In messenger conversations, words that appear very frequently at the start of lines are usually usernames - exclude them.)
- sentenceStructures: array of {pattern, description, count, example} sorted by count desc (e.g. "SVO", "Question", "Conditional", "Imperative", etc.)
- totalSentences: number
- avgSentenceLength: number (words per sentence)
- vocabularyRichness: number (0-100, ratio of unique words to total)
- complexityScore: number (1-10, overall text complexity)
- topBigrams: array of {phrase, count} top 15 two-word combinations (exclude combinations with speaker names)
- topTrigrams: array of {phrase, count} top 10 three-word combinations
- summary: detailed analysis summary in Korean (3-4 sentences)
- keyExpressions: array of {expression, translation, context} top 10 useful expressions for language learning
- emotionalTone: object {positive: number, negative: number, neutral: number} as percentages
${totalWordCount ? `\nNote: The full text has ${totalWordCount} total words and ${totalUniqueWords} unique words. Use these for overall statistics even if analyzing a sample.` : ""}

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
          { role: "user", content: text },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    const analysis = JSON.parse(content);
    
    // Add total counts if provided
    if (totalWordCount) {
      analysis.totalWordCount = totalWordCount;
      analysis.totalUniqueWords = totalUniqueWords;
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
