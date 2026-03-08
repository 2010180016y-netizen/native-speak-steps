
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature TEXT NOT NULL DEFAULT 'chat',
  rating INTEGER CHECK (rating IN (-1, 1)),
  response_time_ms INTEGER DEFAULT 0,
  error_type TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_feedback_user_id ON public.ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_created_at ON public.ai_feedback(created_at);
CREATE INDEX idx_ai_feedback_feature ON public.ai_feedback(feature);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON public.ai_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON public.ai_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON public.ai_feedback
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
