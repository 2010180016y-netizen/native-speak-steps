-- PRD-3: daily reminders delivered by web push while the app is closed.
-- Setup (VAPID keys, secrets, schedule): docs/reminders.md.

ALTER TABLE public.profiles ADD COLUMN last_reminded_on date;

-- One row per browser that allowed notifications.
CREATE TABLE public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add own push subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.push_subscriptions FROM anon;

-- Returns users whose reminder is due and marks them reminded for their local day, so
-- overlapping runs never notify twice. Due = reminder enabled, at least one push
-- subscription, local time within an hour after the chosen reminder time, and either
-- review cards are due or the user has not studied yet today.
CREATE FUNCTION public.claim_due_reminders()
RETURNS TABLE (user_id uuid, due_cards integer, streak_days integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH local AS (
    SELECT
      p.user_id,
      (now() AT TIME ZONE p.timezone)::date AS today,
      (now() AT TIME ZONE p.timezone)::time AS now_time,
      p.reminder_time::time AS remind_at,
      (SELECT count(*)::integer FROM srs_cards c WHERE c.user_id = p.user_id AND c.next_review_at <= now()) AS due_cards
    FROM profiles p
    WHERE p.reminder_enabled
      AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = p.user_id)
  ),
  due AS (
    SELECT l.* FROM local l
    JOIN profiles p ON p.user_id = l.user_id
    WHERE l.now_time >= l.remind_at
      AND l.now_time < l.remind_at + interval '1 hour'
      AND p.last_reminded_on IS DISTINCT FROM l.today
      AND (l.due_cards > 0 OR p.last_active_date IS DISTINCT FROM l.today)
  )
  UPDATE profiles p
  SET last_reminded_on = due.today
  FROM due
  WHERE p.user_id = due.user_id
  RETURNING
    p.user_id,
    due.due_cards,
    CASE WHEN p.last_active_date >= due.today - 1 THEN p.streak_days ELSE 0 END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders() TO service_role;
