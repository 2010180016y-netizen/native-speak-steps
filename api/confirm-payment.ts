import { aiHandler, HttpError, json, sql, z } from "./_lib/ai.js";

// Query parameters Toss Payments appends to the success URL.
const schema = z.object({
  paymentKey: z.string().min(1).max(200),
  orderId: z.string().uuid(),
  amount: z.coerce.number().int().positive(),
});

// The fields read from Toss's payment and error responses.
type TossData = { status?: string; totalAmount?: number; paymentKey?: string; message?: string; error?: string };

async function toss(path: string, body?: unknown): Promise<{ ok: boolean; data: TossData }> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("TOSS_SECRET_KEY is not configured");
  try {
    const res = await fetch(`https://api.tosspayments.com/v1/payments${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as TossData };
  } catch (e) {
    return { ok: false, data: { error: String(e) } };
  }
}

export const POST = aiHandler("confirm-payment", schema, async ({ paymentKey, orderId, amount }, { userId }) => {
  const [payment] = await sql`
    SELECT status, amount FROM public.payments WHERE order_id = ${orderId} AND user_id = ${userId}`;
  // The amount must match what this server priced in create-order.
  if (!payment || payment.amount !== amount) {
    throw new HttpError(400, "결제 정보가 올바르지 않아요.", "invalid_payment");
  }

  let paidKey = paymentKey;
  if (payment.status === "pending") {
    const confirm = await toss("/confirm", { paymentKey, orderId, amount });
    if (!confirm.ok) {
      // The charge may already have gone through: a confirm that timed out, or a retry after the
      // grant below failed (Toss answers ALREADY_PROCESSED_PAYMENT). Trust Toss's record of this
      // order, which belongs to this user and was priced by this server.
      const order = await toss(`/orders/${orderId}`);
      if (!(order.ok && order.data.status === "DONE" && order.data.totalAmount === amount)) {
        console.error("toss confirm failed:", orderId, confirm.data, order.data);
        throw new HttpError(402, confirm.data.message ?? "결제 승인에 실패했어요.", "payment_failed");
      }
      paidKey = order.data.paymentKey ?? paymentKey;
    }
  }

  // If this fails the order stays pending; reopening the success page retries through the lookup above.
  const [{ pro_until }] = await sql`SELECT public.complete_payment(${orderId}, ${paidKey}) AS pro_until`;
  return json({ proUntil: pro_until });
}, { quota: false });
