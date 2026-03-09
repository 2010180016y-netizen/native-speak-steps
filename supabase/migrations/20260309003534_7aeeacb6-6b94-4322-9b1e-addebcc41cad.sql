-- Ensure one row per user for core identity tables
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_points_user_id_unique ON public.user_points (user_id);
