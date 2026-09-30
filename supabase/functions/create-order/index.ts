import { aiHandler, HttpError, json, z } from "../_shared/ai.ts";

// The price is decided here; the client only displays it (src/lib/plan.ts).
const PRO_PASS = { product: "pro_30d", amount: 4900, name: "LangSync Pro 30일 이용권" };

Deno.serve(aiHandler("create-order", z.object({}), async (_body, { userId, admin }) => {
  // create_order() enforces the open-order limit and returns null once it is reached.
  const { data: orderId, error } = await admin.rpc("create_order", {
    p_user_id: userId,
    p_product: PRO_PASS.product,
    p_amount: PRO_PASS.amount,
  });
  if (error) throw new Error(`create_order failed: ${error.message}`);
  if (!orderId) {
    throw new HttpError(429, "결제를 너무 여러 번 시작했어요. 잠시 후 다시 시도해 주세요.", "too_many_orders");
  }

  return json({ orderId, amount: PRO_PASS.amount, orderName: PRO_PASS.name, customerKey: userId });
}, { quota: false }));
