-- PRD-1: one card per native text per user, and no pre-test placeholder cards.
-- Destructive: deletes placeholder cards and duplicate cards (the most-reviewed copy is kept).

-- Placeholders created by the old import pre-test: the "translation" was the word itself.
DELETE FROM public.srs_cards
WHERE context IN ('빈도 기반 단어 학습', '문장 구조 학습')
  AND target_text IN ('[' || native_text || ']', native_text);

DELETE FROM public.srs_cards
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY user_id, native_text ORDER BY review_count DESC, created_at ASC
    ) AS copy_number
    FROM public.srs_cards
  ) ranked
  WHERE copy_number > 1
);

ALTER TABLE public.srs_cards
  ADD CONSTRAINT srs_cards_user_native_text_key UNIQUE (user_id, native_text);
