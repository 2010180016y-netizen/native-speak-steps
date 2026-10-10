import webpush from "web-push";
import { json, sql } from "./_lib/ai.js";

type DueReminder = { user_id: string; due_cards: number; streak_days: number };

function reminderMessage({ due_cards, streak_days }: DueReminder) {
  const streakLine = streak_days > 0 ? `${streak_days}일 연속 학습 중이에요. 오늘도 이어가요!` : null;
  return due_cards > 0
    ? { title: `복습할 카드 ${due_cards}장이 기다려요 📚`, body: streakLine ?? "잊기 전에 몇 분만 복습해 보세요.", url: "/cards" }
    : { title: "오늘의 학습 시간이에요 🔥", body: streakLine ?? "내 표현으로 짧게 대화 연습을 해 보세요.", url: "/chat" };
}

// Called hourly by .github/workflows/reminders.yml, never by users.
export async function POST(req: Request) {
  const cronSecret = process.env.REMINDER_CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

  const due = (await sql`SELECT * FROM public.claim_due_reminders()`) as DueReminder[];

  // ponytail: sequential sends; batch with Promise.allSettled if a run takes too long.
  let sent = 0;
  for (const reminder of due) {
    const subscriptions = await sql`
      SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = ${reminder.user_id}`;
    const payload = JSON.stringify(reminderMessage(reminder));

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped the subscription.
        if (status === 404 || status === 410) await sql`DELETE FROM public.push_subscriptions WHERE endpoint = ${sub.endpoint}`;
        else console.error("push failed:", status, e);
      }
    }
  }

  return json({ users: due.length, sent });
}
