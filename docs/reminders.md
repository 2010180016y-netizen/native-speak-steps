# Study reminders (PRD-3)

Users turn reminders on in Profile. The browser then asks for notification permission and
stores a push subscription in `push_subscriptions`. Every hour a GitHub Actions workflow
(`.github/workflows/reminders.yml`) calls `/api/send-reminders`, which claims the users whose
reminder time has come in the last two hours (`claim_due_reminders()`, at most once per local
day) and sends a web push:

- review cards due: "복습할 카드 N장이 기다려요" (opens `/cards`)
- otherwise, if the user has not studied today: "오늘의 학습 시간이에요" (opens `/chat`)

The streak is included when it is still alive.

## One-time setup

1. Generate VAPID keys: `npx web-push generate-vapid-keys`.
2. Frontend env: `VITE_VAPID_PUBLIC_KEY=<public key>`.
3. Vercel environment variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (for example `mailto:support@example.com`), and
   `REMINDER_CRON_SECRET` (any long random string).
4. GitHub repository settings: the variable `APP_URL` (for example
   `https://native-speak-steps.vercel.app`) and the secret `REMINDER_CRON_SECRET` (same value).

Without these, reminders fall back to the in-app toast shown when the app is opened near the
reminder time, and the workflow skips. GitHub may run scheduled workflows late or pause them
after 60 days without repository activity; the two-hour claim window absorbs late runs.
iOS delivers web push only to web apps added to the Home Screen.
