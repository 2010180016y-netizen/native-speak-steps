import { aiHandler, HttpError, json, z } from "../_shared/ai.ts";

// Query parameters Toss Payments appends to the success URL.
const schema = z.object({
  paymentKey: z.string().min(1).max(200),
  orderId: z.string().uuid(),
  amount: z.coerce.number().int().positive(),
});

Deno.serve(aiHandler("confirm-payment", schema, async ({ paymentKey, orderId, amount }, { userId, admin }) => {
  const { data: payment } = await admin
    .from("payments")
    .select("status, amount")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  // The amount must match what this server priced in create-order.
  if (!payment || payment.amount !== amount) {
    throw new HttpError(400, "결제 정보가 올바르지 않아요.", "invalid_payment");
  }

  if (payment.status === "pending") {
    const secretKey = Deno.env.get("TOSS_SECRET_KEY");
    if (!secretKey) throw new Error("TOSS_SECRET_KEY is not configured");

    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.error("toss confirm failed:", res.status, detail);
      throw new HttpError(402, detail.message ?? "결제 승인에 실패했어요.", "payment_failed");
    }
  }

  // Charged but not yet granted if this fails: the order stays pending with the payment in Toss.
  const { data: proUntil, error } = await admin.rpc("complete_payment", { p_order_id: orderId, p_payment_key: paymentKey });
  if (error) throw new Error(`complete_payment failed for ${orderId}: ${error.message}`);
  return json({ proUntil });
}, { quota: false }));
