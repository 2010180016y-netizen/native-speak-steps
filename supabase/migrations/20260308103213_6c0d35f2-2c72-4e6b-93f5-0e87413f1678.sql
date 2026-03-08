ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_time text NOT NULL DEFAULT '20:00';