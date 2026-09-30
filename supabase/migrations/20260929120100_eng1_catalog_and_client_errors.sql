-- ENG-1: reproducible environments and client error reporting.

-- Pet catalog. Inserted only into an empty table, so environments that
-- already have a catalog are left untouched.
INSERT INTO public.pet_types (name, species, unlock_cost, description)
SELECT * FROM (VALUES
  ('시바견', 'dog', 0, '씩씩하고 충성스러운 친구'),
  ('코르기', 'dog', 100, '짧은 다리로 열심히 달려요'),
  ('골든 리트리버', 'dog', 200, '다정하고 영리한 친구'),
  ('먼치킨', 'cat', 0, '호기심 많은 작은 고양이'),
  ('러시안 블루', 'cat', 100, '조용하고 우아한 고양이'),
  ('스코티시 폴드', 'cat', 200, '접힌 귀가 매력적인 고양이')
) AS v(name, species, unlock_cost, description)
WHERE NOT EXISTS (SELECT 1 FROM public.pet_types);

INSERT INTO public.pet_items (name, category, price, exp_reward, emoji, description)
SELECT * FROM (VALUES
  ('뼈다귀 간식', 'snack', 10, 20, '🦴', '기본 간식'),
  ('참치 캔', 'snack', 15, 30, '🐟', '고소한 참치'),
  ('스테이크', 'snack', 30, 70, '🥩', '특별한 날의 간식'),
  ('공 장난감', 'toy', 20, 40, '⚽', '신나게 뛰어놀아요'),
  ('깃털 장난감', 'toy', 25, 50, '🪶', '살랑살랑 깃털'),
  ('반짝이 목줄', 'accessory', 40, 100, '💎', '멋쟁이 목줄')
) AS v(name, category, price, exp_reward, emoji, description)
WHERE NOT EXISTS (SELECT 1 FROM public.pet_items);

-- Names match ACCESSORY_CONFIGS in src/components/pet/Pet3DAccessory.tsx.
INSERT INTO public.pet_accessories (name, category, emoji, unlock_level, position)
SELECT * FROM (VALUES
  ('빨간 리본', 'ribbon', '🎀', 1, 'neck'),
  ('꽃 왕관', 'hat', '🌸', 2, 'top'),
  ('별 선글라스', 'glasses', '🕶️', 3, 'face'),
  ('파티 모자', 'hat', '🎉', 4, 'top'),
  ('종 목걸이', 'ribbon', '🔔', 5, 'neck'),
  ('하트 안경', 'glasses', '💖', 6, 'face'),
  ('진주 목걸이', 'ribbon', '📿', 7, 'neck'),
  ('왕관', 'hat', '👑', 10, 'top'),
  ('마법사 안경', 'glasses', '🔮', 12, 'face'),
  ('천사 날개', 'special', '👼', 15, 'back'),
  ('무지개 망토', 'special', '🌈', 20, 'back'),
  ('별빛 이펙트', 'special', '✨', 25, 'top')
) AS v(name, category, emoji, unlock_level, position)
WHERE NOT EXISTS (SELECT 1 FROM public.pet_accessories);

-- Client-side errors reported by signed-in users (src/lib/errorReporting.ts).
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) <= 2000),
  stack text CHECK (char_length(stack) <= 8000),
  url text CHECK (char_length(url) <= 500),
  user_agent text CHECK (char_length(user_agent) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_errors_created ON public.client_errors (created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can report own client errors" ON public.client_errors
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.client_errors FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.client_errors FROM authenticated;
