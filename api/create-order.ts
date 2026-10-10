import { aiHandler, HttpError, json, sql, z } from "./_lib/ai.js";

// The price is decided here; the client only displays it (src/lib/plan.ts).
const PRO_PASS = { product: "pro_30d", amount: 4900, name: "LangSync Pro 30일 이용권" };

export const POST = aiHandler("create-order", z.object({}), async (_body, { userId }) => {
  // create_order() enforces the open-order limit and returns null once it is reached.
  const [{ order_id: orderId }] = await sql`
    SELECT public.create_order(${userId}, ${PRO_PASS.product}, ${PRO_PASS.amount}) AS order_id`;
  if (!orderId) {
    throw new HttpError(429, "결제를 너무 여러 번 시작했어요. 잠시 후 다시 시도해 주세요.", "too_many_orders");
  }

  return json({ orderId, amount: PRO_PASS.amount, orderName: PRO_PASS.name, customerKey: userId });
}, { quota: false });
