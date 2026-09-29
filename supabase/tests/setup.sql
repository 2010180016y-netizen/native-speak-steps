-- Supabase platform objects the migrations rely on, so they can be applied to plain
-- Postgres by scripts/test-db.sh, followed by helpers for the tests. Not a migration.

-- ── Platform stubs ──────────────────────────────────────────────────────────

-- Roles are cluster-wide and may exist from an earlier run.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;
ALTER ROLE service_role BYPASSRLS;

-- Like Supabase, API roles get every privilege on new objects unless a migration revokes it.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- ── Test helpers ────────────────────────────────────────────────────────────

CREATE SCHEMA tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;

-- Continues the transaction as a signed-in user, or as anon when uid is null.
CREATE FUNCTION tests.login(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  PERFORM set_config('role', CASE WHEN uid IS NULL THEN 'anon' ELSE 'authenticated' END, true);
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
