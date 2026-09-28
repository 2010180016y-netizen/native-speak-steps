-- SEC-1: Never expose email addresses through display names or the leaderboard.

-- Returns a display name that is safe to show to other users. Empty names and
-- anything containing '@' (i.e. email addresses) fall back to a generated handle.
CREATE OR REPLACE FUNCTION public.safe_display_name(candidate text, uid uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN candidate IS NULL OR btrim(candidate) = '' OR position('@' IN candidate) > 0
      THEN '학습자#' || upper(left(replace(uid::text, '-', ''), 6))
    ELSE left(btrim(candidate), 30)
  END;
$$;

REVOKE ALL ON FUNCTION public.safe_display_name(text, uuid) FROM PUBLIC, anon, authenticated;

-- New users: no longer default display_name to the account email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, public.safe_display_name(NEW.raw_user_meta_data->>'display_name', NEW.id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Existing users: replace emails, blanks and over-long names.
UPDATE public.profiles
SET display_name = public.safe_display_name(display_name, user_id)
WHERE display_name IS DISTINCT FROM public.safe_display_name(display_name, user_id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_safe CHECK (
    display_name IS NOT NULL
    AND display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 1 AND 30
    AND position('@' IN display_name) = 0
  );

-- Leaderboard: no user_id in the result; callers learn only which row is theirs.
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);
DROP FUNCTION IF EXISTS public.get_user_rank(uuid);

CREATE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 50)
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
    p.streak_days,
    p.current_level,
    COALESCE(p.user_id = auth.uid(), false) AS is_me
  FROM public.profiles p
  WHERE p.onboarding_completed = true
  ORDER BY p.total_xp DESC, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
$$;

-- Rank of the calling user only; no way to look up other users by id.
CREATE FUNCTION public.get_my_rank()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ranked.rank FROM (
    SELECT
      user_id,
      (ROW_NUMBER() OVER (ORDER BY total_xp DESC, created_at ASC))::integer AS rank
    FROM public.profiles
    WHERE onboarding_completed = true
  ) ranked
  WHERE ranked.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_rank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;
