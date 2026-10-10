-- P1: groundwork for the "my core" strategy. Records where each card came from and how each
-- review went, and lets English learners choose American or British English.

-- Where a card came from. The app used to tell cards apart by phrases in `context`;
-- the backfill reads the same phrases the app writes.
ALTER TABLE public.srs_cards
  ADD COLUMN source text NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'chat', 'speaking'));

UPDATE public.srs_cards SET source = 'speaking' WHERE context LIKE '%스피킹%교정%';
UPDATE public.srs_cards SET source = 'chat'
WHERE context LIKE '%좋은 표현%' OR context LIKE '%개선 표현%' OR context LIKE '%채팅 교정%';

-- One row per review. srs_cards only keeps a card's current schedule, so this is the only
-- record of how recall went over time. Keyed by the card's review count, so a retried
-- request is logged once.
CREATE TABLE public.card_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.srs_cards(id) ON DELETE CASCADE,
  review_number integer NOT NULL CHECK (review_number >= 0),
  quality smallint NOT NULL CHECK (quality BETWEEN 0 AND 5),
  interval_before integer NOT NULL,
  interval_after integer NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, review_number)
);

CREATE INDEX idx_card_reviews_user ON public.card_reviews (user_id, reviewed_at DESC);

ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own card reviews" ON public.card_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can log reviews of own cards" ON public.card_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.srs_cards c WHERE c.id = card_id AND c.user_id = auth.uid())
  );
REVOKE ALL ON public.card_reviews FROM anon;
REVOKE UPDATE, DELETE ON public.card_reviews FROM authenticated;

-- American or British English for learners of English. NULL means American English.
-- Profile updates are granted per column (SEC-4), so the new column needs its own grant.
ALTER TABLE public.profiles
  ADD COLUMN target_variety text CHECK (target_variety IN ('en-US', 'en-GB'));
GRANT UPDATE (target_variety) ON public.profiles TO authenticated;
