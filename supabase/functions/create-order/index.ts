import { aiHandler, json, z } from "../_shared/ai.ts";

// The price is decided here; the client only displays it (src/lib/plan.ts).
const PRO_PASS = { product: "pro_30d", amount: 4900, name: "LangSync Pro 30일 이용권" };

// ponytail: no rate limit on orders; unpaid pending rows are harmless, add one if they pile up.
Deno.serve(aiHandler("create-order", z.object({}), async (_body, { userId, admin }) => {
  const { data, error } = await admin
    .from("payments")
    .insert({ user_id: userId, product: PRO_PASS.product, amount: PRO_PASS.amount })
    .select("order_id")
    .single();
  if (error) throw error;

  return json({ orderId: data.order_id, amount: PRO_PASS.amount, orderName: PRO_PASS.name, customerKey: userId });
}, { quota: false }));
