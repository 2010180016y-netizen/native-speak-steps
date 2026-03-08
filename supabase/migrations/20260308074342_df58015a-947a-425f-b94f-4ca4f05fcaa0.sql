-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  native_language TEXT NOT NULL DEFAULT 'ko',
  target_language TEXT NOT NULL DEFAULT 'en',
  current_level TEXT NOT NULL DEFAULT 'beginner',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  streak_days INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Language imports (native language samples)
CREATE TABLE public.language_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  unique_words INTEGER NOT NULL DEFAULT 0,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.language_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own imports" ON public.language_imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own imports" ON public.language_imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own imports" ON public.language_imports FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_language_imports_user ON public.language_imports(user_id, created_at DESC);

-- SRS Cards (spaced repetition)
CREATE TABLE public.srs_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  native_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  context TEXT,
  difficulty INTEGER NOT NULL DEFAULT 0,
  interval_days REAL NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  next_review_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.srs_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cards" ON public.srs_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cards" ON public.srs_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cards" ON public.srs_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cards" ON public.srs_cards FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_srs_cards_updated_at BEFORE UPDATE ON public.srs_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_srs_cards_review ON public.srs_cards(user_id, next_review_at);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_messages_session ON public.chat_messages(user_id, session_id, created_at);

-- Learning stats (daily aggregation)
CREATE TABLE public.learning_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  native_words_analyzed INTEGER NOT NULL DEFAULT 0,
  target_words_learned INTEGER NOT NULL DEFAULT 0,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  chat_messages_sent INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.learning_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats" ON public.learning_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own stats" ON public.learning_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stats" ON public.learning_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_learning_stats_user_date ON public.learning_stats(user_id, date DESC);