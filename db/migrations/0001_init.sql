-- LangSync schema for Neon. Consolidates the Supabase-era migrations (kept in git history)
-- into one starting point for a fresh database. Pets, points and the leaderboard are not
-- carried over: they were frozen (docs/decisions/D1-scope.md) and their code was removed.
--
-- Neon specifics:
-- - Users live in neon_auth."user" (Neon Auth). Every per-user table references it and is
--   deleted with the account.
-- - Browser requests reach Postgres through the Neon Data API as role `authenticated` with
--   the user's JWT; auth.user_id() returns its `sub` claim. current_user_id() turns it into a
--   uuid for the policies below.
-- - Neon grants API roles nothing by default, so every grant here is explicit. Tables used
--   only by the server functions (api/) have row-level security and no grants: the server
--   connects as the database owner.

-- ── Shared helpers ──────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT nullif(auth.user_id(), '')::uuid $$;

CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- A display name that is safe to show to other users: no emails, never blank, at most 30
-- characters. Anything else falls back to a generated handle.
CREATE FUNCTION public.safe_display_name(candidate text, uid uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN candidate IS NULL OR btrim(candidate) = '' OR position('@' IN candidate) > 0
      THEN '학습자#' || upper(left(replace(uid::text, '-', ''), 6))
    ELSE btrim(left(btrim(candidate), 30))
  END;
$$;

-- True for anything AT TIME ZONE accepts. One bad value would break every reminder run.
CREATE FUNCTION public.is_valid_timezone(tz text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM timestamptz '2000-01-01 00:00+00' AT TIME ZONE tz;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- ── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (
    display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 1 AND 30
    AND position('@' IN display_name) = 0
  ),
  avatar_url text,
  native_language text NOT NULL DEFAULT 'ko',
  target_language text NOT NULL DEFAULT 'en',
  -- American or British English for learners of English. NULL means American English.
  target_variety text CHECK (target_variety IN ('en-US', 'en-GB')),
  current_level text NOT NULL DEFAULT 'beginner',
  onboarding_completed boolean NOT NULL DEFAULT false,
  streak_days integer NOT NULL DEFAULT 0,
  total_xp integer NOT NULL DEFAULT 0,
  last_active_date date,
  timezone text NOT NULL DEFAULT 'Asia/Seoul'
    CHECK (char_length(timezone) <= 64 AND public.is_valid_timezone(timezone)),
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_time text NOT NULL DEFAULT '20:00',
  last_reminded_on date,
  ai_processing_consent_at timestamptz,
  -- Paid Pro access ends here (BIZ-1). Server-written only.
  pro_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = public.current_user_id());
-- Identity and preferences are editable; progress (XP, streak) and Pro are server-only.
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (
  display_name, avatar_url, native_language, target_language, target_variety, current_level,
  onboarding_completed, timezone, reminder_enabled, reminder_time, ai_processing_consent_at
) ON public.profiles TO authenticated;

-- Creates the caller's profile on first sign-in and returns it. Neon Auth owns the user
-- table, so the app calls this instead of relying on a sign-up trigger. Idempotent.
CREATE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.current_user_id();
  v_profile public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (v_uid, public.safe_display_name((SELECT name FROM neon_auth."user" WHERE id = v_uid), v_uid))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_uid;
  RETURN v_profile;
END;
$$;

-- ── Learning content ────────────────────────────────────────────────────────

CREATE TABLE public.srs_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  native_text text NOT NULL,
  target_text text NOT NULL,
  context text,
  -- Where the card came from.
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'chat', 'speaking')),
  difficulty integer NOT NULL DEFAULT 0,
  interval_days real NOT NULL DEFAULT 1,
  ease_factor real NOT NULL DEFAULT 2.5,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, native_text)
);

CREATE INDEX idx_srs_cards_review ON public.srs_cards (user_id, next_review_at);
CREATE TRIGGER update_srs_cards_updated_at BEFORE UPDATE ON public.srs_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.srs_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cards" ON public.srs_cards
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.srs_cards TO authenticated;

-- One row per review: how recall went over time. Keyed by the card's review count, so a
-- retried request is logged once.
CREATE TABLE public.card_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.srs_cards(id) ON DELETE CASCADE,
  review_number integer NOT NULL CHECK (review_number >= 0),
  quality smallint NOT NULL CHECK (quality BETWEEN 0 AND 5),
  interval_before integer NOT NULL,
  interval_after integer NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, review_number)
);

CREATE INDEX idx_card_reviews_user ON public.card_reviews (user_id, reviewed_at DESC);

ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own card reviews" ON public.card_reviews
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
CREATE POLICY "Users can log reviews of own cards" ON public.card_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (SELECT 1 FROM public.srs_cards c WHERE c.id = card_id AND c.user_id = public.current_user_id())
  );
GRANT SELECT, INSERT ON public.card_reviews TO authenticated;

-- Imported text is analysed, never stored: only counts and the analysis result are kept.
CREATE TABLE public.language_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'text',
  word_count integer NOT NULL DEFAULT 0,
  unique_words integer NOT NULL DEFAULT 0,
  analysis_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_language_imports_user ON public.language_imports (user_id, created_at DESC);

ALTER TABLE public.language_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own imports" ON public.language_imports
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
-- The app saves the analysis after the import row exists, so it may update that column.
GRANT SELECT, INSERT, DELETE ON public.language_imports TO authenticated;
GRANT UPDATE (analysis_result) ON public.language_imports TO authenticated;

-- ── Conversation ────────────────────────────────────────────────────────────

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON public.chat_messages (user_id, session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
CREATE POLICY "Users can add own messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;

CREATE TABLE public.chat_feedback_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  overall_score integer NOT NULL DEFAULT 0,
  total_user_messages integer NOT NULL DEFAULT 0,
  total_user_words integer NOT NULL DEFAULT 0,
  avg_words_per_message real NOT NULL DEFAULT 0,
  vocabulary_richness real NOT NULL DEFAULT 0,
  good_expressions_count integer NOT NULL DEFAULT 0,
  improvement_areas_count integer NOT NULL DEFAULT 0,
  persona_gender text,
  persona_occupation text,
  scenario_label text,
  feedback_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_feedback_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chat feedback" ON public.chat_feedback_results
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
CREATE POLICY "Users can add own chat feedback" ON public.chat_feedback_results
  FOR INSERT TO authenticated WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT ON public.chat_feedback_results TO authenticated;

-- Ratings of AI answers and the errors users ran into.
CREATE TABLE public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  feature text NOT NULL DEFAULT 'chat',
  rating integer CHECK (rating IN (-1, 1)),
  response_time_ms integer DEFAULT 0,
  error_type text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_feedback_user ON public.ai_feedback (user_id, created_at DESC);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own AI feedback" ON public.ai_feedback
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT, UPDATE ON public.ai_feedback TO authenticated;

-- ── Goals, sessions and stats ───────────────────────────────────────────────

CREATE TABLE public.learning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  goal_type text NOT NULL DEFAULT 'daily_xp',
  target_value integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON public.learning_goals
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_goals TO authenticated;

CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  activity_type text NOT NULL DEFAULT 'general',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_date ON public.user_sessions (user_id, started_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON public.user_sessions
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;

CREATE TABLE public.lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  lesson_type text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  score integer DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_lesson_completions_user_date ON public.lesson_completions (user_id, completed_at DESC);

ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own completions" ON public.lesson_completions
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
CREATE POLICY "Users can add own completions" ON public.lesson_completions
  FOR INSERT TO authenticated WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT ON public.lesson_completions TO authenticated;

-- Daily totals, written only by record_activity().
CREATE TABLE public.learning_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  native_words_analyzed integer NOT NULL DEFAULT 0,
  target_words_learned integer NOT NULL DEFAULT 0,
  cards_reviewed integer NOT NULL DEFAULT 0,
  chat_messages_sent integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.learning_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stats" ON public.learning_stats
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
GRANT SELECT ON public.learning_stats TO authenticated;

-- ── Progress ledger (SEC-4) ─────────────────────────────────────────────────

-- One idempotent row per reported activity; also the source for daily XP caps.
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  kind text NOT NULL,
  idempotency_key text NOT NULL,
  units integer NOT NULL,
  xp integer NOT NULL,
  local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_activity_events_user_day ON public.activity_events (user_id, local_date, kind);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activity events" ON public.activity_events
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
GRANT SELECT ON public.activity_events TO authenticated;

-- Records one learning activity. XP, daily stats and the streak are derived here from
-- server-side rules; the client only says what happened. Replaying an idempotency key is a
-- no-op. Reports a streak milestone on the first activity of the day that reaches one.
CREATE FUNCTION public.record_activity(
  p_kind text,
  p_idempotency_key text,
  p_units integer DEFAULT 1,
  p_timezone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.current_user_id();
  v_profile public.profiles%ROWTYPE;
  v_units integer := greatest(coalesce(p_units, 0), 0);
  v_xp integer;
  v_daily_cap integer;
  v_xp_today integer;
  v_tz text;
  v_today date;
  v_first_today boolean;
  v_streak integer;
  v_event_id uuid;
  v_milestone jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid idempotency key' USING ERRCODE = '22023';
  END IF;

  -- Reward rules. Client-reported units are clamped; XP is capped per kind per day.
  CASE p_kind
    WHEN 'card_review' THEN
      v_units := 1; v_xp := 2; v_daily_cap := 200;
    WHEN 'chat_message' THEN
      v_units := 1; v_xp := 1; v_daily_cap := 100;
    WHEN 'chat_mission', 'speaking_mission' THEN
      v_units := least(v_units, 25); v_xp := v_units; v_daily_cap := 300;
    WHEN 'speaking_session' THEN
      v_units := least(v_units, 100); v_xp := 10; v_daily_cap := 100;
    WHEN 'roleplay_complete' THEN
      v_units := least(v_units, 50); v_xp := least(v_units * 2, 40); v_daily_cap := 120;
    WHEN 'import_analyzed' THEN
      v_units := least(v_units, 100000); v_xp := 10; v_daily_cap := 30;
    WHEN 'cards_saved' THEN
      v_units := least(v_units, 200); v_xp := least(v_units, 20); v_daily_cap := 60;
    ELSE
      RAISE EXCEPTION 'unknown activity kind: %', p_kind USING ERRCODE = '22023';
  END CASE;

  -- Serialize this user's activity: caps, XP and streak are computed under the lock.
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_tz := coalesce(nullif(p_timezone, ''), v_profile.timezone);
  BEGIN
    v_today := (now() AT TIME ZONE v_tz)::date;
  EXCEPTION WHEN others THEN
    v_tz := v_profile.timezone;
    v_today := (now() AT TIME ZONE v_tz)::date;
  END;

  SELECT coalesce(sum(xp), 0) INTO v_xp_today
  FROM public.activity_events
  WHERE user_id = v_uid AND local_date = v_today AND kind = p_kind;

  v_xp := CASE WHEN v_xp_today >= v_daily_cap THEN 0 ELSE least(v_xp, v_daily_cap - v_xp_today) END;

  INSERT INTO public.activity_events (user_id, kind, idempotency_key, units, xp, local_date)
  VALUES (v_uid, p_kind, p_idempotency_key, v_units, v_xp, v_today)
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object(
      'applied', false, 'xp', 0, 'total_xp', v_profile.total_xp,
      'streak_days', v_profile.streak_days, 'milestone', NULL
    );
  END IF;

  -- Streak: +1 on the first activity of a new consecutive day, reset after a gap.
  v_first_today := v_profile.last_active_date IS NULL OR v_profile.last_active_date < v_today;
  v_streak := CASE
    WHEN NOT v_first_today THEN greatest(v_profile.streak_days, 1)
    WHEN v_profile.last_active_date = v_today - 1 THEN v_profile.streak_days + 1
    ELSE 1
  END;

  UPDATE public.profiles
  SET total_xp = total_xp + v_xp,
      streak_days = v_streak,
      last_active_date = greatest(coalesce(last_active_date, v_today), v_today),
      timezone = v_tz
  WHERE user_id = v_uid;

  INSERT INTO public.learning_stats AS s (
    user_id, date, xp_earned, cards_reviewed, chat_messages_sent, native_words_analyzed, target_words_learned
  )
  VALUES (
    v_uid, v_today, v_xp,
    CASE WHEN p_kind = 'card_review' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'chat_message' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'import_analyzed' THEN v_units ELSE 0 END,
    CASE WHEN p_kind = 'cards_saved' THEN v_units ELSE 0 END
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    xp_earned = s.xp_earned + excluded.xp_earned,
    cards_reviewed = s.cards_reviewed + excluded.cards_reviewed,
    chat_messages_sent = s.chat_messages_sent + excluded.chat_messages_sent,
    native_words_analyzed = s.native_words_analyzed + excluded.native_words_analyzed,
    target_words_learned = s.target_words_learned + excluded.target_words_learned;

  IF v_first_today AND v_streak IN (1, 3, 7, 14, 30, 60, 90) THEN
    v_milestone := jsonb_build_object('days', v_streak);
  END IF;

  RETURN jsonb_build_object(
    'applied', true, 'xp', v_xp, 'total_xp', v_profile.total_xp + v_xp,
    'streak_days', v_streak, 'milestone', v_milestone
  );
END;
$$;

-- ── AI quota (SEC-3), server-only ───────────────────────────────────────────

CREATE TABLE public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  feature text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date, feature)
);

CREATE TABLE public.ai_usage_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  feature text NOT NULL,
  model text NOT NULL,
  status integer NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_user_created ON public.ai_usage_log (user_id, created_at DESC);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Counts one request against the feature and daily limits. Returns false (and does not
-- count the request) when either limit would be exceeded.
CREATE FUNCTION public.consume_ai_quota(
  p_user_id uuid,
  p_feature text,
  p_feature_limit integer,
  p_daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_feature_count integer;
  v_total_count integer;
BEGIN
  INSERT INTO public.ai_usage_daily (user_id, usage_date, feature, requests)
  VALUES (p_user_id, CURRENT_DATE, p_feature, 1)
  ON CONFLICT (user_id, usage_date, feature)
  DO UPDATE SET requests = ai_usage_daily.requests + 1
  RETURNING requests INTO v_feature_count;

  SELECT sum(requests) INTO v_total_count
  FROM public.ai_usage_daily
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;

  IF v_feature_count > p_feature_limit OR v_total_count > p_daily_limit THEN
    UPDATE public.ai_usage_daily
    SET requests = requests - 1
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE AND feature = p_feature;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ── Product analytics (PRD-2) and client errors (ENG-1) ─────────────────────

-- One row per user, event and (UTC) day: enough for funnels and day-N retention.
CREATE TABLE public.analytics_events (
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN (
    'app_opened', 'onboarding_completed', 'import_analyzed', 'cards_saved',
    'card_reviewed', 'chat_completed', 'speaking_completed',
    'paywall_shown', 'upgrade_viewed', 'checkout_started', 'upgrade_completed'
  )),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event, event_date)
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can record own analytics events" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (user_id = public.current_user_id());
-- INSERT ... ON CONFLICT DO NOTHING (used to dedupe) needs SELECT on the key columns and a
-- SELECT policy.
CREATE POLICY "Users can view own analytics events" ON public.analytics_events
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
GRANT INSERT ON public.analytics_events TO authenticated;
GRANT SELECT (user_id, event, event_date) ON public.analytics_events TO authenticated;

-- Weekly signup cohorts (docs/metrics.md). Owner only.
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

-- Client-side errors reported by signed-in users (src/lib/errorReporting.ts).
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) <= 2000),
  stack text CHECK (char_length(stack) <= 8000),
  url text CHECK (char_length(url) <= 500),
  user_agent text CHECK (char_length(user_agent) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_errors_created ON public.client_errors (created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can report own client errors" ON public.client_errors
  FOR INSERT TO authenticated WITH CHECK (user_id = public.current_user_id());
GRANT INSERT ON public.client_errors TO authenticated;

-- ── Study reminders (PRD-3) ─────────────────────────────────────────────────

-- One row per browser that allowed notifications.
CREATE TABLE public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT public.current_user_id() REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- Returns users whose reminder is due and marks them reminded for their local day, so
-- overlapping runs never notify twice. Due = reminder enabled, at least one push
-- subscription, local time within an hour after the chosen reminder time, and either review
-- cards are due or the user has not studied yet today. Called hourly by the server.
CREATE FUNCTION public.claim_due_reminders()
RETURNS TABLE (user_id uuid, due_cards integer, streak_days integer)
LANGUAGE sql
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
      -- Two hours, so a late hourly run still sends; last_reminded_on keeps it to one a day.
      AND l.now_time < l.remind_at + interval '2 hours'
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

-- ── Payments (BIZ-1) ────────────────────────────────────────────────────────

-- Payment records outlive account deletion (the user link is cleared) because Korean
-- e-commerce law requires keeping payment records for five years.
CREATE TABLE public.payments (
  order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  product text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX idx_payments_user ON public.payments (user_id, created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT TO authenticated USING (user_id = public.current_user_id());
GRANT SELECT ON public.payments TO authenticated;

-- Opens an order, unless the user already has 5 unpaid orders from the last hour. Each
-- checkout attempt opens an order, so this stops one account from piling up pending rows.
CREATE FUNCTION public.create_order(p_user_id uuid, p_product text, p_amount integer)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Serialize this user's calls so concurrent requests cannot all pass the count.
  PERFORM pg_advisory_xact_lock(hashtextextended('create_order:' || p_user_id::text, 0));

  IF (
    SELECT count(*) FROM public.payments
    WHERE user_id = p_user_id AND status = 'pending' AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.payments (user_id, product, amount)
  VALUES (p_user_id, p_product, p_amount)
  RETURNING order_id INTO v_order_id;
  RETURN v_order_id;
END;
$$;

-- Marks an order paid and extends Pro by 30 days from the later of now and the current
-- expiry. Idempotent: a paid order returns the current expiry without extending again.
CREATE FUNCTION public.complete_payment(p_order_id uuid, p_payment_key text)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_pro_until timestamptz;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_payment.user_id IS NULL THEN
    RAISE EXCEPTION 'unknown order' USING ERRCODE = '22023';
  END IF;

  IF v_payment.status = 'paid' THEN
    SELECT pro_until INTO v_pro_until FROM public.profiles WHERE user_id = v_payment.user_id;
    RETURN v_pro_until;
  END IF;

  UPDATE public.payments
  SET status = 'paid', payment_key = p_payment_key, paid_at = now()
  WHERE order_id = p_order_id;

  UPDATE public.profiles
  SET pro_until = greatest(coalesce(pro_until, now()), now()) + interval '30 days'
  WHERE user_id = v_payment.user_id
  RETURNING pro_until INTO v_pro_until;
  RETURN v_pro_until;
END;
$$;

-- ── Function access ─────────────────────────────────────────────────────────

-- Functions are executable by PUBLIC by default. Only these two are client RPCs; the rest
-- are internal or called by the server as the database owner.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_activity(text, text, integer, text) TO authenticated;
-- Used inside row-level security policies and column defaults evaluated as the caller.
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_timezone(text) TO authenticated;
