
CREATE TABLE public.pet_diaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES public.user_pets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT 'neutral',
  diary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pet_id, diary_date)
);

ALTER TABLE public.pet_diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet diaries" ON public.pet_diaries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pet diaries" ON public.pet_diaries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
