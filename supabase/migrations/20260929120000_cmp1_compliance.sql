-- CMP-1: account deletion removes every per-user row, imported raw text is not
-- retained, and consent to AI processing of imported text is recorded.

-- Link every per-user table to auth.users so deleting the account cascades.
-- Rows whose user no longer exists are unreachable and are removed first.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_points', 'point_transactions', 'user_pets', 'pet_feeding_log', 'user_sessions',
    'lesson_completions', 'ai_feedback', 'learning_goals', 'chat_feedback_results',
    'pet_diaries', 'user_pet_accessories'
  ] LOOP
    EXECUTE format(
      'DELETE FROM public.%I x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)', t);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
      t, t || '_user_id_fkey');
  END LOOP;
END $$;

-- Imported text is analysed, never stored. This also purges text stored so far.
ALTER TABLE public.language_imports DROP COLUMN content;

ALTER TABLE public.profiles ADD COLUMN ai_processing_consent_at timestamptz;
GRANT UPDATE (ai_processing_consent_at) ON public.profiles TO authenticated;
