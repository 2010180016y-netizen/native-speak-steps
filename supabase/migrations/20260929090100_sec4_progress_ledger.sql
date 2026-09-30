-- SEC-4: progress and the points economy become server-authoritative.
-- Clients can no longer write XP, streaks, daily stats, points or pet stats;
-- they report activities through record_activity() and spend through adopt_pet()/feed_pet().

-- ── Schema ──────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Seoul',
  ADD COLUMN IF NOT EXISTS last_active_date date;

-- One idempotent row per reported activity; also the source for daily XP caps.
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Every user has a points row, so clients never need to create one.
INSERT INTO public.user_points (user_id, balance)
SELECT p.user_id, 50
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_points up WHERE up.user_id = p.user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, public.safe_display_name(NEW.raw_user_meta_data->>'display_name', NEW.id));
  INSERT INTO public.user_points (user_id, balance)
  VALUES (NEW.id, 50)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Client write access ─────────────────────────────────────────────────────

-- profiles: identity and preferences stay editable; progress columns do not.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  display_name, avatar_url, native_language, target_language, current_level,
  onboarding_completed, reminder_enabled, reminder_time
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.learning_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON public.learning_stats;
REVOKE INSERT, UPDATE, DELETE ON public.learning_stats FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can insert own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update own points" ON public.user_points;
REVOKE INSERT, UPDATE, DELETE ON public.user_points FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.point_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.point_transactions FROM anon, authenticated;

-- user_pets: only the name and which pet is active are client-editable.
DROP POLICY IF EXISTS "Users can insert own pets" ON public.user_pets;
REVOKE INSERT, UPDATE ON public.user_pets FROM anon, authenticated;
GRANT UPDATE (name, is_active) ON public.user_pets TO authenticated;

DROP POLICY IF EXISTS "Users can insert own feeding log" ON public.pet_feeding_log;
REVOKE INSERT, UPDATE, DELETE ON public.pet_feeding_log FROM anon, authenticated;

-- Accessories may only be unlocked once the (server-controlled) pet level allows it.
DROP POLICY IF EXISTS "Users can insert own pet accessories" ON public.user_pet_accessories;
CREATE POLICY "Users can unlock earned pet accessories" ON public.user_pet_accessories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_pets p
      JOIN public.pet_accessories a ON a.id = user_pet_accessories.accessory_id
      WHERE p.id = user_pet_accessories.pet_id
        AND p.user_id = auth.uid()
        AND a.unlock_level <= p.level
    )
  );
REVOKE UPDATE ON public.user_pet_accessories FROM anon, authenticated;
GRANT UPDATE (is_equipped) ON public.user_pet_accessories TO authenticated;

-- ── Internal helpers (not callable by clients) ──────────────────────────────

-- Deducts points under a row lock so concurrent spends cannot overdraw.
CREATE FUNCTION public.spend_points(p_user_id uuid, p_amount integer, p_type text, p_description text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'invalid amount' USING ERRCODE = '22023';
  END IF;

  SELECT balance INTO v_balance FROM public.user_points WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient points' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_points SET balance = balance - p_amount
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  IF p_amount > 0 THEN
    INSERT INTO public.point_transactions (user_id, amount, type, description)
    VALUES (p_user_id, -p_amount, p_type, p_description);
  END IF;
  RETURN v_balance;
END;
$$;

CREATE FUNCTION public.grant_points(p_user_id uuid, p_amount integer, p_type text, p_description text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_points (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_points.balance + excluded.balance;

  INSERT INTO public.point_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_type, p_description);
END;
$$;

-- Adds experience and applies level-ups (thresholds: round(100 * 1.2^(level-1)), max level 30).
CREATE FUNCTION public.add_pet_experience(p_pet_id uuid, p_exp integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.user_pets%ROWTYPE;
BEGIN
  SELECT * INTO v_pet FROM public.user_pets WHERE id = p_pet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_pet.experience := v_pet.experience + greatest(p_exp, 0);
  WHILE v_pet.experience >= v_pet.exp_to_next_level AND v_pet.level < 30 LOOP
    v_pet.experience := v_pet.experience - v_pet.exp_to_next_level;
    v_pet.level := v_pet.level + 1;
    v_pet.exp_to_next_level := round(100 * power(1.2, v_pet.level - 1))::integer;
  END LOOP;

  UPDATE public.user_pets
  SET experience = v_pet.experience, level = v_pet.level, exp_to_next_level = v_pet.exp_to_next_level
  WHERE id = p_pet_id;
  RETURN v_pet.level;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_points(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_points(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_pet_experience(uuid, integer) FROM PUBLIC, anon, authenticated;

-- ── Client RPCs ─────────────────────────────────────────────────────────────

-- Records one learning activity. XP, daily stats, the streak, milestone points and
-- pet experience are all derived here from server-side rules; the client only says
-- what happened. Replaying an idempotency key is a no-op.
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
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_units integer := greatest(coalesce(p_units, 0), 0);
  v_xp integer;
  v_daily_cap integer;
  v_points integer := 0;
  v_pet_xp integer := 0;
  v_xp_today integer;
  v_tz text;
  v_today date;
  v_first_today boolean;
  v_streak integer;
  v_event_id uuid;
  v_pet_id uuid;
  v_milestone_points integer;
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
      v_points := greatest(5, v_units / 5); v_pet_xp := greatest(3, v_units / 8);
    WHEN 'roleplay_complete' THEN
      v_units := least(v_units, 50); v_xp := least(v_units * 2, 40); v_daily_cap := 120;
      v_points := least(greatest(5, v_units * 2), 40); v_pet_xp := least(greatest(3, v_units * 3 / 2), 30);
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

  IF v_xp_today >= v_daily_cap THEN
    v_xp := 0; v_points := 0; v_pet_xp := 0;
  ELSE
    v_xp := least(v_xp, v_daily_cap - v_xp_today);
  END IF;

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

  IF v_points > 0 THEN
    PERFORM public.grant_points(v_uid, v_points, p_kind, p_kind || ' 보상');
  END IF;

  IF v_pet_xp > 0 THEN
    SELECT id INTO v_pet_id FROM public.user_pets
    WHERE user_id = v_uid AND is_active
    ORDER BY updated_at DESC
    LIMIT 1;
    IF v_pet_id IS NOT NULL THEN
      PERFORM public.add_pet_experience(v_pet_id, v_pet_xp);
    END IF;
  END IF;

  -- Streak milestones pay out once per milestone, ever.
  IF v_first_today THEN
    v_milestone_points := CASE v_streak
      WHEN 1 THEN 10 WHEN 3 THEN 30 WHEN 7 THEN 100 WHEN 14 THEN 250
      WHEN 30 THEN 500 WHEN 60 THEN 500 WHEN 90 THEN 500 ELSE 0
    END;
    IF v_milestone_points > 0 AND NOT EXISTS (
      SELECT 1 FROM public.point_transactions
      WHERE user_id = v_uid AND type = 'milestone' AND description LIKE v_streak || '일 연속 학습%'
    ) THEN
      PERFORM public.grant_points(v_uid, v_milestone_points, 'milestone', v_streak || '일 연속 학습');
      v_milestone := jsonb_build_object('days', v_streak, 'points', v_milestone_points);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'applied', true, 'xp', v_xp, 'total_xp', v_profile.total_xp + v_xp,
    'streak_days', v_streak, 'milestone', v_milestone
  );
END;
$$;

CREATE FUNCTION public.adopt_pet(p_pet_type_id uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_type public.pet_types%ROWTYPE;
  v_name text := left(btrim(coalesce(p_name, '')), 20);
  v_pet_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_type FROM public.pet_types WHERE id = p_pet_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown pet type' USING ERRCODE = '22023';
  END IF;

  PERFORM public.spend_points(v_uid, v_type.unlock_cost, 'pet_unlock', v_type.name || ' 입양');

  UPDATE public.user_pets SET is_active = false WHERE user_id = v_uid AND is_active;
  INSERT INTO public.user_pets (user_id, pet_type_id, name, is_active, exp_to_next_level)
  VALUES (v_uid, p_pet_type_id, CASE WHEN v_name = '' THEN '내 펫' ELSE v_name END, true, 100)
  RETURNING id INTO v_pet_id;
  RETURN v_pet_id;
END;
$$;

CREATE FUNCTION public.feed_pet(p_pet_id uuid, p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.pet_items%ROWTYPE;
  v_old_level integer;
  v_new_level integer;
  v_balance integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT level INTO v_old_level FROM public.user_pets WHERE id = p_pet_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown pet' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item FROM public.pet_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown item' USING ERRCODE = '22023';
  END IF;

  v_balance := public.spend_points(v_uid, v_item.price, 'feed', v_item.name || ' 구매');
  v_new_level := public.add_pet_experience(p_pet_id, v_item.exp_reward);
  INSERT INTO public.pet_feeding_log (user_id, pet_id, item_id) VALUES (v_uid, p_pet_id, p_item_id);

  RETURN jsonb_build_object('level', v_new_level, 'leveled_up', v_new_level > v_old_level, 'balance', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity(text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adopt_pet(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_pet(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_activity(text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adopt_pet(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_pet(uuid, uuid) TO authenticated;

-- ── Leaderboard: a streak only counts while it is still alive ──────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 50)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_xp integer,
  streak_days integer,
  current_level text,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (ROW_NUMBER() OVER (ORDER BY p.total_xp DESC, p.created_at ASC))::integer AS rank,
    p.display_name,
    p.total_xp,
    CASE
      WHEN p.last_active_date >= (now() AT TIME ZONE p.timezone)::date - 1 THEN p.streak_days
      ELSE 0
    END AS streak_days,
    p.current_level,
    COALESCE(p.user_id = auth.uid(), false) AS is_me
  FROM public.profiles p
  WHERE p.onboarding_completed = true
  ORDER BY p.total_xp DESC, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
$$;
