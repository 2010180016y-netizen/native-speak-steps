// Shared guardrails for every AI edge function (SEC-3): auth, request validation,
// size caps, per-user daily quotas, usage logging and model configuration.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

export { z };

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// The Gemini API directly when GEMINI_API_KEY is set (free tier), otherwise the Lovable AI gateway.
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const PROVIDER = GEMINI_API_KEY
  ? {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: GEMINI_API_KEY,
    model: "gemini-2.5-flash",
  }
  : {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    key: Deno.env.get("LOVABLE_API_KEY"),
    model: "google/gemini-2.5-flash",
  };

/** The one model every function uses; override per environment with AI_MODEL_DEFAULT. */
const DEFAULT_MODEL = Deno.env.get("AI_MODEL_DEFAULT") ?? PROVIDER.model;

export const LIMITS = {
  maxBodyChars: 100_000,
  maxMessages: 100,
  maxMessageChars: 4_000,
  historyWindow: 20,
};

/**
 * Per-user daily request limits by plan (BIZ-1). `total` caps all functions together;
 * functions not listed (account and payment endpoints) get `other`.
 * The upgrade page shows the free/pro numbers: keep src/lib/plan.ts in sync.
 */
const DAILY_LIMITS = {
  free: {
    total: 80, other: 20,
    features: { "chat": 30, "speaking": 30, "chat-feedback": 3, "speaking-feedback": 3, "analyze-text": 3, "generate-cards": 10, "split-dialogue": 3 },
  },
  pro: {
    total: 400, other: 20,
    features: { "chat": 200, "speaking": 200, "chat-feedback": 30, "speaking-feedback": 30, "analyze-text": 20, "generate-cards": 40, "split-dialogue": 20 },
  },
} satisfies Record<string, { total: number; other: number; features: Record<string, number> }>;

export class HttpError extends Error {
  constructor(public status: number, message: string, public errorType: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Request schemas ──
export const languageSchema = z.string().trim().min(1).max(32);
export const levelSchema = z.enum(["beginner", "elementary", "intermediate", "advanced"]).catch("beginner");
export const personaSchema = z.object({
  gender: z.enum(["male", "female"]),
  occupation: z.string().trim().max(60),
  personality: z.string().trim().max(120),
});
export const messagesSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(LIMITS.maxMessageChars) }))
  .min(1)
  .max(LIMITS.maxMessages);

export type ChatMessage = z.infer<typeof messagesSchema>[number];

/** Review-card phrases the user is practising (PRD-4). */
export const practicePhrasesSchema = z.array(z.string().trim().min(1).max(100)).max(5).default([]);

export const practicePhrasesInstruction = (phrases: string[]) =>
  phrases.length > 0
    ? `\nThe user is practising these expressions: ${phrases.map((p) => `"${p}"`).join(", ")}. Steer the conversation naturally so the user has chances to use them. Do not list them, quiz the user, or use them all yourself.\n`
    : "";

export type AiContext = {
  feature: string;
  userId: string;
  /** Client acting as the caller (RLS applies). */
  supabase: SupabaseClient;
  /** Service-role client for quota, usage logging and storage. */
  admin: SupabaseClient;
};

async function authenticate(req: Request, feature: string): Promise<AiContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "로그인이 필요해요. 다시 로그인해 주세요.", "unauthorized");

  const url = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getClaims(authHeader.slice("Bearer ".length));
  const claims = data?.claims;
  // The public anon key is also a valid JWT; only signed-in users may use AI features.
  if (error || !claims?.sub || claims.role !== "authenticated") {
    throw new HttpError(401, "로그인이 필요해요. 다시 로그인해 주세요.", "unauthorized");
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  return { feature, userId: claims.sub, supabase, admin };
}

async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const raw = await req.text();
  if (raw.length > LIMITS.maxBodyChars) throw new HttpError(413, "요청 내용이 너무 길어요.", "payload_too_large");

  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "잘못된 요청 형식입니다.", "invalid_request");
    }
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const tooBig = result.error.issues.some((issue) => issue.code === "too_big");
    throw tooBig
      ? new HttpError(413, "요청 내용이 너무 길어요.", "payload_too_large")
      : new HttpError(400, "잘못된 요청입니다.", "invalid_request");
  }
  return result.data;
}

async function consumeQuota(ctx: AiContext) {
  const { data: profile } = await ctx.admin.from("profiles").select("pro_until").eq("user_id", ctx.userId).maybeSingle();
  const isPro = Boolean(profile?.pro_until && new Date(profile.pro_until) > new Date());
  const limits = isPro ? DAILY_LIMITS.pro : DAILY_LIMITS.free;

  const { data: allowed, error } = await ctx.admin.rpc("consume_ai_quota", {
    p_user_id: ctx.userId,
    p_feature: ctx.feature,
    p_feature_limit: (limits.features as Record<string, number>)[ctx.feature] ?? limits.other,
    p_daily_limit: limits.total,
  });
  if (error) throw new Error(`quota check failed: ${error.message}`);
  if (!allowed) {
    throw new HttpError(
      429,
      isPro
        ? "오늘 사용할 수 있는 AI 요청을 모두 사용했어요. 내일 다시 시도해주세요."
        : "오늘 무료로 사용할 수 있는 AI 요청을 모두 사용했어요. Pro로 업그레이드하면 더 많이 쓸 수 있어요.",
      "quota_exceeded",
    );
  }
}

/**
 * Wraps a function handler with CORS, auth, validation, quota and uniform error responses.
 * `quota: false` is for non-AI calls (payments, account deletion) that must keep working
 * after the daily AI quota is used up.
 */
export function aiHandler<T extends z.ZodTypeAny>(
  feature: string,
  schema: T,
  handler: (body: z.infer<T>, ctx: AiContext) => Promise<Response>,
  { quota = true } = {},
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    try {
      const ctx = await authenticate(req, feature);
      const body = await parseBody(req, schema);
      if (quota) await consumeQuota(ctx);
      return await handler(body, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, error_type: e.errorType }, e.status);
      console.error(`${feature} error:`, e);
      return json({ error: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.", error_type: "server_error" }, 500);
    }
  };
}

type GatewayResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
      images?: Array<{ image_url?: { url?: string } }>;
    };
  }>;
  usage?: Record<string, number>;
};

type ModelRequest = {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  [key: string]: unknown;
};

async function logUsage(ctx: AiContext, model: string, status: number, latencyMs: number, usage?: Record<string, number>) {
  const { error } = await ctx.admin.from("ai_usage_log").insert({
    user_id: ctx.userId,
    feature: ctx.feature,
    model,
    status,
    latency_ms: latencyMs,
    prompt_tokens: usage?.prompt_tokens ?? null,
    completion_tokens: usage?.completion_tokens ?? null,
    total_tokens: usage?.total_tokens ?? null,
  });
  if (error) console.error("usage log failed:", error.message);
}

/** Calls the model provider and records token usage for the calling user. */
export async function callModel(ctx: AiContext, request: ModelRequest) {
  if (!PROVIDER.key) throw new Error("Set GEMINI_API_KEY or LOVABLE_API_KEY");

  const model = request.model ?? DEFAULT_MODEL;
  const started = Date.now();
  const res = await fetch(PROVIDER.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${PROVIDER.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ stream: false, ...request, model }),
  });
  const latencyMs = Date.now() - started;

  if (!res.ok) {
    await logUsage(ctx, model, res.status, latencyMs);
    if (res.status === 429) throw new HttpError(429, "요청이 너무 많아요. 잠시 후 다시 시도해주세요.", "rate_limit");
    // The Lovable gateway returns 402 once the workspace's AI allowance is used up.
    if (res.status === 402) throw new HttpError(402, "AI 크레딧이 부족합니다.", "payment_required");
    console.error(`AI gateway error (${ctx.feature}):`, res.status, await res.text());
    throw new HttpError(502, "AI 응답을 받지 못했어요. 다시 시도해주세요.", "gateway_error");
  }

  const data: GatewayResponse = await res.json();
  await logUsage(ctx, model, res.status, latencyMs, data.usage);
  return { data, latencyMs };
}

// ── Response helpers ──
export const messageText = (data: GatewayResponse): string => data.choices?.[0]?.message?.content ?? "";

/** Parses a JSON object from model text, tolerating markdown code fences. */
export function parseJsonContent<T = unknown>(content: string): T {
  const cleaned = content.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

/** Returns the parsed arguments of the named tool call, or null when the model did not call it. */
export function toolArguments<T = unknown>(data: GatewayResponse, name: string): T | null {
  const call = data.choices?.[0]?.message?.tool_calls?.find((c) => c.function?.name === name);
  if (!call?.function?.arguments) return null;
  try {
    return JSON.parse(call.function.arguments) as T;
  } catch {
    return null;
  }
}

/** Splits a model reply of the form {"response": ..., "corrections": [...]} used by chat and speaking. */
export function parseReplyWithCorrections(raw: string) {
  try {
    const parsed = parseJsonContent<{ response?: string; corrections?: unknown }>(raw);
    if (typeof parsed.response === "string") {
      const corrections = Array.isArray(parsed.corrections) ? parsed.corrections : [];
      return { content: parsed.response, corrections };
    }
  } catch {
    // Model did not return JSON; use the raw text.
  }
  return { content: raw, corrections: [] };
}
