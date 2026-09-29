-- PRD-3: call send-reminders every 15 minutes (pg_cron + pg_net).
-- Reads the project URL and the shared cron secret from Vault; see docs/reminders.md.
-- Where the extensions are unavailable (plain Postgres in CI, or a host without them) the
-- schedule is skipped with a notice rather than failing the deploy, and reminders fall back to
-- the in-app toast. Check it with: SELECT jobname, schedule FROM cron.job;
DO $do$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  PERFORM cron.schedule(
    'send-reminders',
    '*/15 * * * *',
    $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_cron_secret')
      ),
      body := '{}'::jsonb
    );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'send-reminders schedule skipped: %', SQLERRM;
END
$do$;
