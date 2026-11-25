-- Minimal stand-ins for the Supabase auth and storage schemas so the migrations and
-- pgTAP tests can run on a plain PostgreSQL server (see scripts/test-db.sh).
-- Not used against a real Supabase project: `supabase test db` provides the real ones.
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE supabase_auth_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid() TO anon, authenticated, service_role;

CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets (id), name text, owner uuid
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
