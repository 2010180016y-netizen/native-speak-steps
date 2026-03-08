
CREATE TABLE public.chat_feedback_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
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
  feedback_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_feedback_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own chat feedback" ON public.chat_feedback_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own chat feedback" ON public.chat_feedback_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
