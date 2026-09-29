# Study reminders (PRD-3)

Users turn reminders on in Profile. The browser then asks for notification permission and
stores a push subscription in `push_subscriptions`. Every 15 minutes pg_cron calls the
`send-reminders` edge function, which claims the users whose reminder time has come
(`claim_due_reminders()`, at most once per local day) and sends a web push:

- review cards due: "복습할 카드 N장이 기다려요" (opens `/cards`)
- otherwise, if the user has not studied today: "오늘의 학습 시간이에요" (opens `/chat`)

The streak is included when it is still alive.

## One-time setup

1. Generate VAPID keys: `npx web-push generate-vapid-keys`.
2. Frontend env: `VITE_VAPID_PUBLIC_KEY=<public key>`.
3. Edge function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (for example `mailto:support@example.com`), and
   `REMINDER_CRON_SECRET` (any long random string).
4. Vault secrets used by the cron job (SQL editor):

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<same value as REMINDER_CRON_SECRET>', 'reminder_cron_secret');
   ```

Without these, reminders fall back to the in-app toast shown when the app is opened near the
reminder time. The same happens where pg_cron or pg_net is unavailable: the schedule migration
then skips with a notice instead of failing the deploy (check with `select * from cron.job;`). iOS delivers web push only to web apps added to the Home Screen.
