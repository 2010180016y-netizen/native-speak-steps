-- PRD-2: product analytics for activation and retention. Definitions: docs/metrics.md.

-- One row per user, event and (UTC) day: enough for funnels and day-N retention.
CREATE TABLE public.analytics_events (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN (
    'app_opened', 'onboarding_completed', 'import_analyzed', 'cards_saved',
    'card_reviewed', 'chat_completed', 'speaking_completed'
  )),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event, event_date)
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can record own analytics events" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- INSERT ... ON CONFLICT DO NOTHING (used to dedupe) needs SELECT on the key columns and a SELECT policy.
CREATE POLICY "Users can view own analytics events" ON public.analytics_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.analytics_events FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.analytics_events FROM authenticated;
GRANT SELECT (user_id, event, event_date) ON public.analytics_events TO authenticated;

-- Weekly signup cohorts. Signup = profile creation.
-- Activated: within 7 days of signup the user saved cards and reviewed a card.
-- Dn retained: any event on exactly day n after signup (rates only count users old enough).
CREATE VIEW public.analytics_cohorts AS
WITH user_flags AS (
  SELECT
    date_trunc('week', p.created_at)::date AS cohort_week,
    p.created_at::date AS signup_date,
    coalesce(bool_or(e.event = 'onboarding_completed'), false) AS onboarded,
    coalesce(bool_or(e.event = 'import_analyzed'), false) AS imported,
    coalesce(bool_or(e.event = 'cards_saved' AND e.event_date < p.created_at::date + 7), false)
      AND coalesce(bool_or(e.event = 'card_reviewed' AND e.event_date < p.created_at::date + 7), false) AS activated,
    coalesce(bool_or(e.event_date = p.created_at::date + 1), false) AS active_d1,
    coalesce(bool_or(e.event_date = p.created_at::date + 7), false) AS active_d7
  FROM public.profiles p
  LEFT JOIN public.analytics_events e ON e.user_id = p.user_id
  GROUP BY p.user_id, p.created_at
)
SELECT
  cohort_week,
  count(*) AS signups,
  count(*) FILTER (WHERE onboarded) AS onboarded,
  count(*) FILTER (WHERE imported) AS imported,
  count(*) FILTER (WHERE activated) AS activated,
  round(100.0 * count(*) FILTER (WHERE activated) / count(*), 1) AS activation_rate,
  round(100.0 * count(*) FILTER (WHERE active_d1)
    / nullif(count(*) FILTER (WHERE signup_date + 1 <= CURRENT_DATE), 0), 1) AS d1_retention,
  round(100.0 * count(*) FILTER (WHERE active_d7)
    / nullif(count(*) FILTER (WHERE signup_date + 7 <= CURRENT_DATE), 0), 1) AS d7_retention
FROM user_flags
GROUP BY cohort_week
ORDER BY cohort_week DESC;

-- Aggregates across all users: owner / service role only.
REVOKE ALL ON public.analytics_cohorts FROM anon, authenticated;
