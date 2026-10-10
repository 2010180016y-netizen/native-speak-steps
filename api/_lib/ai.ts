// Shared guardrails for every AI function (SEC-3): auth, request validation,
// size caps, per-user daily quotas, usage logging and model configuration.
import { neon } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export { z };

/** Connects as the database owner, so RLS does not apply: always filter by the caller's id. */
export const sql = neon(process.env.DATABASE_URL!);

// The Gemini API's OpenAI-compatible endpoint (free tier).
const PROVIDER = {
  url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  key: process.env.GEMINI_API_KEY,
  model: "gemini-2.5-flash",
};

/** The one model every function uses; override per environment with AI_MODEL_DEFAULT. */
const DEFAULT_MODEL = process.env.AI_MODEL_DEFAULT ?? PROVIDER.model;

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

export const json = (body: unknown, status = 200) => Response.json(body, { status });

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
};

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Verifies the Neon Auth session JWT the app sends as a bearer token. */
async function authenticate(req: Request, feature: string): Promise<AiContext> {
  const unauthorized = new HttpError(401, "로그인이 필요해요. 다시 로그인해 주세요.", "unauthorized");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw unauthorized;

  jwks ??= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
  try {
    const { payload } = await jwtVerify(authHeader.slice("Bearer ".length), jwks);
    // Anonymous tokens are signed by the same keys; only signed-in users may call these functions.
    if (payload.role === "anonymous" || !z.string().uuid().safeParse(payload.sub).success) throw unauthorized;
    return { feature, userId: payload.sub! };
  } catch {
    throw unauthorized;
  }
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
  const [profile] = await sql`SELECT pro_until > now() AS is_pro FROM public.profiles WHERE user_id = ${ctx.userId}`;
  const isPro = Boolean(profile?.is_pro);
  const limits = isPro ? DAILY_LIMITS.pro : DAILY_LIMITS.free;
  const featureLimit = (limits.features as Record<string, number>)[ctx.feature] ?? limits.other;

  const [{ allowed }] = await sql`
    SELECT public.consume_ai_quota(${ctx.userId}, ${ctx.feature}, ${featureLimit}, ${limits.total}) AS allowed`;
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
 * Wraps a function handler with auth, validation, quota and uniform error responses.
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
  try {
    await sql`
      INSERT INTO public.ai_usage_log
        (user_id, feature, model, status, latency_ms, prompt_tokens, completion_tokens, total_tokens)
      VALUES (${ctx.userId}, ${ctx.feature}, ${model}, ${status}, ${latencyMs},
        ${usage?.prompt_tokens ?? null}, ${usage?.completion_tokens ?? null}, ${usage?.total_tokens ?? null})`;
  } catch (e) {
    console.error("usage log failed:", e);
  }
}

/** Calls the model provider and records token usage for the calling user. */
export async function callModel(ctx: AiContext, request: ModelRequest) {
  if (!PROVIDER.key) throw new Error("Set GEMINI_API_KEY");

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
    console.error(`AI gateway error (${ctx.feature}):`, res.status, await res.text());
    throw new HttpError(502, "AI 응답을 받지 못했어요. 다시 시도해주세요.", "gateway_error");
  }

  const data = (await res.json()) as GatewayResponse;
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
