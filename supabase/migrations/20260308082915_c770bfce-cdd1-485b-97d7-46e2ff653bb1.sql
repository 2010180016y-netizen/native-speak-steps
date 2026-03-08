
-- Points system
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.point_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'milestone',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pet system
CREATE TABLE public.pet_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'dog',
  unlock_cost INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  base_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.user_pets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pet_type_id UUID NOT NULL REFERENCES public.pet_types(id),
  name TEXT NOT NULL DEFAULT '내 펫',
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  exp_to_next_level INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.pet_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'snack',
  price INTEGER NOT NULL DEFAULT 10,
  exp_reward INTEGER NOT NULL DEFAULT 10,
  emoji TEXT NOT NULL DEFAULT '🦴',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.pet_feeding_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES public.user_pets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.pet_items(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_feeding_log ENABLE ROW LEVEL SECURITY;

-- pet_types and pet_items are readable by all authenticated users
CREATE POLICY "Anyone can read pet types" ON public.pet_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read pet items" ON public.pet_items FOR SELECT TO authenticated USING (true);

-- user_points
CREATE POLICY "Users can view own points" ON public.user_points FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own points" ON public.user_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own points" ON public.user_points FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- point_transactions
CREATE POLICY "Users can view own transactions" ON public.point_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.point_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_pets
CREATE POLICY "Users can view own pets" ON public.user_pets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pets" ON public.user_pets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pets" ON public.user_pets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pets" ON public.user_pets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pet_feeding_log
CREATE POLICY "Users can view own feeding log" ON public.pet_feeding_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feeding log" ON public.pet_feeding_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_points_updated_at BEFORE UPDATE ON public.user_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_pets_updated_at BEFORE UPDATE ON public.user_pets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
