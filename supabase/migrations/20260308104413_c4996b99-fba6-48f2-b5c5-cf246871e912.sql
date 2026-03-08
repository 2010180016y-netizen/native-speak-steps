CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_xp integer,
  streak_days integer,
  current_level text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    COALESCE(p.display_name, '학습자') as display_name,
    p.total_xp,
    p.streak_days,
    p.current_level,
    p.avatar_url
  FROM public.profiles p
  WHERE p.onboarding_completed = true
  ORDER BY p.total_xp DESC
  LIMIT limit_count;
$$;

CREATE OR REPLACE FUNCTION public.get_user_rank(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rank::integer FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
    FROM public.profiles
    WHERE onboarding_completed = true
  ) ranked
  WHERE user_id = target_user_id;
$$;