-- Access rules and server-side logic of the migrations. Run with scripts/test-db.sh.
-- Everything happens in one transaction that is rolled back, so now() is fixed.

\set alice '00000000-0000-0000-0000-00000000000a'
\set bob '00000000-0000-0000-0000-00000000000b'
\set carol '00000000-0000-0000-0000-00000000000c'

BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  (:'alice', 'alice@example.com', '{"display_name": "alice@example.com"}'),
  (:'bob', 'bob@example.com', '{"display_name": "Bob"}'),
  (:'carol', 'carol@example.com', '{"display_name": "Carol"}');

\echo 'schema invariants'

SELECT tests.eq(
  (SELECT string_agg(relname::text, ', ' ORDER BY relname) FROM pg_class
   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity),
  NULL, 'every table has row-level security');

SELECT tests.eq(
  (SELECT string_agg(c.relname::text, ', ' ORDER BY c.relname)
   FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id'
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint k
       WHERE k.conrelid = c.oid AND k.contype = 'f' AND k.confrelid = 'auth.users'::regclass
         AND k.confdeltype IN ('c', 'n'))),
  NULL, 'every per-user table is cleaned up when the account is deleted');

SELECT tests.eq(
  (SELECT string_agg(proname::text, ', ' ORDER BY proname) FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND prosecdef AND prorettype <> 'trigger'::regtype
     AND has_function_privilege('anon', oid, 'EXECUTE')),
  NULL, 'anon can call no SECURITY DEFINER function');

SELECT tests.eq(
  (SELECT string_agg(proname::text, ', ' ORDER BY proname) FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND prosecdef AND prorettype <> 'trigger'::regtype
     AND has_function_privilege('authenticated', oid, 'EXECUTE')),
  'adopt_pet, feed_pet, get_leaderboard, get_my_rank, record_activity',
  'signed-in users can call only the intended SECURITY DEFINER functions');

\echo 'profiles (SEC-1, SEC-4, BIZ-1)'

SELECT tests.eq((SELECT display_name FROM profiles WHERE user_id = :'alice'), '학습자#000000',
  'an email is never used as a display name');
SELECT tests.eq(safe_display_name(repeat('a', 29) || ' bcd', :'bob'), repeat('a', 29),
  'a name cut at 30 characters does not end in a space');

SELECT tests.login(:'alice');
SELECT tests.eq((SELECT count(*) FROM profiles), 1, 'a user sees only their own profile');
UPDATE profiles SET display_name = 'Alice', ai_processing_consent_at = now(), timezone = 'America/New_York';
SELECT tests.eq((SELECT display_name FROM profiles), 'Alice', 'preferences stay editable');
SELECT tests.fails($$UPDATE profiles SET timezone = 'Mars/Olympus_Mons'$$, 'unknown time zones are rejected', '23514');
SELECT tests.fails($$UPDATE profiles SET display_name = 'alice@example.com'$$,
  'emails are rejected as display names', '23514');
SELECT tests.fails($$UPDATE profiles SET total_xp = 1000000$$, 'XP is not client-writable');
SELECT tests.fails($$UPDATE profiles SET streak_days = 365$$, 'streaks are not client-writable');
SELECT tests.fails($$UPDATE profiles SET pro_until = now() + interval '1 year'$$, 'Pro is not client-writable');

\echo 'progress ledger (SEC-4)'

SELECT tests.eq(record_activity('card_review', 'review-1') ->> 'xp', '2', 'a card review earns 2 XP');
SELECT tests.eq(record_activity('card_review', 'review-1') ->> 'applied', 'false',
  'replaying an idempotency key is a no-op');
SELECT tests.eq((SELECT total_xp FROM profiles), 2, 'XP is credited once');
SELECT tests.eq(record_activity('chat_mission', 'mission-1', 1000) ->> 'xp', '25',
  'client-reported units are clamped');
SELECT record_activity('import_analyzed', 'import-' || n) FROM generate_series(1, 3) n;
SELECT tests.eq(record_activity('import_analyzed', 'import-4') ->> 'xp', '0', 'XP stops at the daily cap');
SELECT tests.fails($$SELECT record_activity('free_xp', 'x')$$, 'unknown activity kinds are rejected', '22023');
SELECT tests.fails($$INSERT INTO activity_events (user_id, kind, idempotency_key, units, xp, local_date)
  VALUES (auth.uid(), 'card_review', 'forged', 1, 1000, current_date)$$, 'activity events are server-only');
SELECT tests.fails($$INSERT INTO learning_stats (user_id, date, xp_earned)
  VALUES (auth.uid(), current_date, 1000)$$, 'daily stats are server-only');
SELECT tests.fails($$UPDATE user_points SET balance = 1000000$$, 'points are server-only');

RESET ROLE;
UPDATE profiles SET streak_days = 5, last_active_date = (now() AT TIME ZONE timezone)::date - 1
WHERE user_id = :'alice';
SELECT tests.login(:'alice');
SELECT tests.eq(record_activity('card_review', 'review-2') ->> 'streak_days', '6',
  'studying the next day extends the streak');

RESET ROLE;
UPDATE profiles SET last_active_date = (now() AT TIME ZONE timezone)::date - 3 WHERE user_id = :'alice';
SELECT tests.login(:'alice');
SELECT tests.eq(record_activity('card_review', 'review-3') ->> 'streak_days', '1', 'a missed day resets the streak');

SELECT tests.login(NULL);
SELECT tests.fails($$SELECT record_activity('card_review', 'anon-1')$$, 'anon cannot record activity');

\echo 'AI quota (SEC-3)'

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT tests.eq(consume_ai_quota(:'alice', 'chat', 2, 3), true, 'a request within the limits passes');
SELECT tests.eq(consume_ai_quota(:'alice', 'chat', 2, 3), true, 'a second request passes');
SELECT tests.eq(consume_ai_quota(:'alice', 'chat', 2, 3), false, 'the feature limit refuses a request');
SELECT tests.eq(consume_ai_quota(:'alice', 'speaking', 10, 3), true, 'another feature still has room');
SELECT tests.eq(consume_ai_quota(:'alice', 'speaking', 10, 3), false, 'the daily limit covers all features');
SELECT tests.eq((SELECT sum(requests) FROM ai_usage_daily WHERE user_id = :'alice'), 3,
  'refused requests are not counted');

SELECT tests.login(:'alice');
SELECT tests.fails($$SELECT consume_ai_quota(auth.uid(), 'chat', 1000, 1000)$$, 'clients cannot use the quota function');
SELECT tests.fails($$SELECT * FROM ai_usage_daily$$, 'quota usage is server-only');
SELECT tests.fails($$DELETE FROM ai_usage_daily$$, 'clients cannot reset their quota');

\echo 'cards (PRD-1)'

INSERT INTO srs_cards (user_id, native_text, target_text) VALUES (:'alice', '안녕', 'hello');
SELECT tests.fails(format($$INSERT INTO srs_cards (user_id, native_text, target_text) VALUES (%L, '안녕', 'hi')$$, :'alice'),
  'a user has one card per native text', '23505');
SELECT tests.fails(format($$INSERT INTO srs_cards (user_id, native_text, target_text) VALUES (%L, 'x', 'x')$$, :'bob'),
  'cards cannot be created for another user');

\echo 'analytics (PRD-2)'

INSERT INTO analytics_events (event) VALUES ('app_opened') ON CONFLICT (user_id, event, event_date) DO NOTHING;
INSERT INTO analytics_events (event) VALUES ('app_opened') ON CONFLICT (user_id, event, event_date) DO NOTHING;
SELECT tests.eq((SELECT count(event) FROM analytics_events), 1, 'an event is stored once per user and day');
SELECT tests.fails($$INSERT INTO analytics_events (event) VALUES ('made_up')$$, 'unknown events are rejected', '23514');
SELECT tests.fails(format($$INSERT INTO analytics_events (user_id, event) VALUES (%L, 'app_opened')$$, :'bob'),
  'events cannot be recorded for another user');
SELECT tests.fails($$SELECT * FROM analytics_cohorts$$, 'cohort metrics are not exposed to users');
SELECT tests.fails($$SELECT * FROM backup.srs_cards_removed_prd1$$, 'backed-up cards are not exposed to users');

\echo 'push reminders (PRD-3)'

INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://push.example/alice', 'key', 'secret');
SELECT tests.fails(format($$INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
  VALUES ('https://push.example/bob', %L, 'key', 'secret')$$, :'bob'), 'subscriptions cannot be added for another user');
SELECT tests.fails($$SELECT claim_due_reminders()$$, 'clients cannot claim reminders');

\echo 'payments (BIZ-1)'

RESET ROLE;
SET LOCAL ROLE service_role;
INSERT INTO payments (order_id, user_id, product, amount) VALUES
  ('00000000-0000-0000-0000-0000000000f1', :'alice', 'pro_30d', 4900),
  ('00000000-0000-0000-0000-0000000000f2', :'alice', 'pro_30d', 4900),
  ('00000000-0000-0000-0000-0000000000f3', :'alice', 'pro_30d', 4900);
SELECT tests.eq(complete_payment('00000000-0000-0000-0000-0000000000f1', 'pk-1'), now() + interval '30 days',
  'a payment grants 30 days of Pro');
SELECT tests.eq(complete_payment('00000000-0000-0000-0000-0000000000f1', 'pk-1'), now() + interval '30 days',
  'confirming an order twice grants once');
SELECT tests.eq(complete_payment('00000000-0000-0000-0000-0000000000f2', 'pk-2'), now() + interval '60 days',
  'buying while Pro adds 30 days');
UPDATE profiles SET pro_until = now() - interval '10 days' WHERE user_id = :'alice';
SELECT tests.eq(complete_payment('00000000-0000-0000-0000-0000000000f3', 'pk-3'), now() + interval '30 days',
  'an expired pass restarts from today');
SELECT tests.fails($$SELECT complete_payment('00000000-0000-0000-0000-0000000000ff', 'x')$$,
  'unknown orders are rejected', '22023');

SELECT tests.login(:'alice');
SELECT tests.eq((SELECT count(*) FROM payments), 3, 'a user sees their own payments');
SELECT tests.fails($$SELECT complete_payment('00000000-0000-0000-0000-0000000000f1', 'x')$$, 'clients cannot grant Pro');
SELECT tests.fails($$INSERT INTO payments (user_id, product, amount) VALUES (auth.uid(), 'pro_30d', 1)$$,
  'clients cannot create orders');
SELECT tests.fails($$UPDATE payments SET status = 'paid'$$, 'clients cannot mark orders paid');

SELECT tests.login(:'bob');
SELECT tests.eq((SELECT count(*) FROM payments), 0, 'other users see no payments');
SELECT tests.eq((SELECT count(*) FROM push_subscriptions), 0, 'other users see no push subscriptions');
SELECT tests.eq((SELECT count(*) FROM srs_cards), 0, 'other users see no cards');

\echo 'order limit (BIZ-1)'

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT tests.eq((SELECT count(create_order(:'bob', 'pro_30d', 4900)) FROM generate_series(1, 5)), 5,
  'five orders can be open at once');
SELECT tests.eq(create_order(:'bob', 'pro_30d', 4900), NULL::uuid, 'a sixth open order within the hour is refused');
SELECT tests.eq(create_order(:'carol', 'pro_30d', 4900) IS NOT NULL, true, 'the limit is per user');
UPDATE payments SET status = 'paid'
WHERE order_id = (SELECT order_id FROM payments WHERE user_id = :'bob' LIMIT 1);
SELECT tests.eq(create_order(:'bob', 'pro_30d', 4900) IS NOT NULL, true, 'paid orders do not count against the limit');
SELECT tests.eq(create_order(:'bob', 'pro_30d', 4900), NULL::uuid, 'the limit applies again once five are open');
UPDATE payments SET created_at = now() - interval '2 hours' WHERE user_id = :'bob';
SELECT tests.eq(create_order(:'bob', 'pro_30d', 4900) IS NOT NULL, true, 'orders older than an hour do not count');
SELECT tests.eq((SELECT count(*) FROM payments WHERE user_id = :'bob'), 7, 'older unpaid orders are kept');

SELECT tests.login(:'bob');
SELECT tests.fails($$SELECT create_order(auth.uid(), 'pro_30d', 1)$$, 'clients cannot create orders through the function');

\echo 'account deletion (CMP-1)'

RESET ROLE;
DELETE FROM auth.users WHERE id = :'alice';
SELECT tests.eq((SELECT count(*) FROM profiles WHERE user_id = :'alice'), 0, 'the profile is deleted');
SELECT tests.eq((SELECT count(*) FROM activity_events WHERE user_id = :'alice'), 0, 'activity is deleted');
SELECT tests.eq((SELECT count(*) FROM payments WHERE user_id IS NULL), 3,
  'payment records are kept, unlinked from the account');

ROLLBACK;
