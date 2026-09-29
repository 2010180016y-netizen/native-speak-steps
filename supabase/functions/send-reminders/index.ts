import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/ai.ts";

type DueReminder = { user_id: string; due_cards: number; streak_days: number };

function reminderMessage({ due_cards, streak_days }: DueReminder) {
  const streakLine = streak_days > 0 ? `${streak_days}일 연속 학습 중이에요. 오늘도 이어가요!` : null;
  return due_cards > 0
    ? { title: `복습할 카드 ${due_cards}장이 기다려요 📚`, body: streakLine ?? "잊기 전에 몇 분만 복습해 보세요.", url: "/cards" }
    : { title: "오늘의 학습 시간이에요 🔥", body: streakLine ?? "내 표현으로 짧게 대화 연습을 해 보세요.", url: "/chat" };
}

// Called by pg_cron (see migrations/*_prd3_reminder_schedule.sql), never by users.
Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: due, error } = await admin.rpc("claim_due_reminders");
  if (error) {
    console.error("claim_due_reminders failed:", error.message);
    return json({ error: "claim failed" }, 500);
  }

  // ponytail: sequential sends; batch with Promise.allSettled if a run takes too long.
  let sent = 0;
  for (const reminder of (due ?? []) as DueReminder[]) {
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", reminder.user_id);
    const payload = JSON.stringify(reminderMessage(reminder));

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped the subscription.
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        else console.error("push failed:", status, e);
      }
    }
  }

  return json({ users: due?.length ?? 0, sent });
});
