-- Neon platform objects the schema relies on, so db/migrations can be applied to plain
-- Postgres by scripts/test-db.sh, followed by helpers for the tests. Not a migration.

-- ── Platform stubs ──────────────────────────────────────────────────────────

-- Data API roles. Roles are cluster-wide and may exist from an earlier run.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anonymous'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;

-- Neon Auth's user table (only the columns the schema uses).
CREATE SCHEMA neon_auth;
CREATE TABLE neon_auth."user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  name text
);

-- pg_session_jwt: the `sub` claim of the JWT the Data API request carries.
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anonymous;
CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')
$$;

-- ── Test helpers ────────────────────────────────────────────────────────────

CREATE SCHEMA tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anonymous;

-- Continues the transaction as a signed-in user, or as an anonymous visitor when uid is null.
CREATE FUNCTION tests.login(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  PERFORM set_config('role', CASE WHEN uid IS NULL THEN 'anonymous' ELSE 'authenticated' END, true);
END $$;

CREATE FUNCTION tests.eq(actual anycompatible, expected anycompatible, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', label, expected, actual;
  END IF;
END $$;

-- Runs a statement as the current role and fails unless it raises the given SQLSTATE
-- (default 42501: permission denied, including row-level security violations).
CREATE FUNCTION tests.fails(statement text, label text, expected_state text DEFAULT '42501') RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  state text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    state := SQLSTATE;
  END;
  IF state IS DISTINCT FROM expected_state THEN
    RAISE EXCEPTION 'FAIL %: expected SQLSTATE %, got %', label, expected_state, coalesce(state, 'success');
  END IF;
END $$;
