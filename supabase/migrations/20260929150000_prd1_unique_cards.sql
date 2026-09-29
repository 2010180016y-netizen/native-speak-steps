-- PRD-1: one card per native text per user, and no pre-test placeholder cards.
-- Destructive: deletes placeholder cards and duplicate cards (the most-reviewed copy is kept).
-- The deleted rows are kept in backup.srs_cards_removed_prd1: the API cannot reach that schema,
-- and the rows still go when their account is deleted. Once nobody has asked for a card back:
--   DROP SCHEMA backup CASCADE;

CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC;

-- Placeholders were created by the old import pre-test: the "translation" was the word itself.
-- Duplicates are ranked among the other cards, as if the placeholders were already gone.
CREATE TABLE backup.srs_cards_removed_prd1 AS
WITH placeholders AS (
  SELECT id FROM public.srs_cards
  WHERE context IN ('빈도 기반 단어 학습', '문장 구조 학습')
    AND target_text IN ('[' || native_text || ']', native_text)
), duplicates AS (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY user_id, native_text ORDER BY review_count DESC, created_at ASC
    ) AS copy_number
    FROM public.srs_cards
    WHERE id NOT IN (SELECT id FROM placeholders)
  ) ranked
  WHERE copy_number > 1
)
SELECT * FROM public.srs_cards
WHERE id IN (SELECT id FROM placeholders UNION ALL SELECT id FROM duplicates);

ALTER TABLE backup.srs_cards_removed_prd1
  ADD FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DELETE FROM public.srs_cards WHERE id IN (SELECT id FROM backup.srs_cards_removed_prd1);

ALTER TABLE public.srs_cards
  ADD CONSTRAINT srs_cards_user_native_text_key UNIQUE (user_id, native_text);
