
-- Accessory catalog
CREATE TABLE public.pet_accessories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'hat',
  emoji TEXT NOT NULL DEFAULT '🎩',
  description TEXT,
  unlock_level INTEGER NOT NULL DEFAULT 1,
  position TEXT NOT NULL DEFAULT 'top',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pet accessories" ON public.pet_accessories
  FOR SELECT USING (true);

-- User's unlocked/equipped accessories
CREATE TABLE public.user_pet_accessories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES public.user_pets(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES public.pet_accessories(id) ON DELETE CASCADE,
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pet_id, accessory_id)
);

ALTER TABLE public.user_pet_accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet accessories" ON public.user_pet_accessories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pet accessories" ON public.user_pet_accessories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pet accessories" ON public.user_pet_accessories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
