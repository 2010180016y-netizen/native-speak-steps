-- Reminders fire in profiles.timezone. The app now keeps it set to the device's timezone from
-- the moment it opens (src/hooks/useAuth.tsx), not only after the first recorded activity.

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

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_timezone_valid
  CHECK (char_length(timezone) <= 64 AND public.is_valid_timezone(timezone));

GRANT UPDATE (timezone) ON public.profiles TO authenticated;
