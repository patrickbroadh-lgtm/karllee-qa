-- Minimal Supabase-auth compatibility layer for disposable PostgreSQL CI.
-- Never execute this bootstrap against a real Supabase project.
-- Production Supabase owns auth.users, auth.uid() and the API roles.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

-- Supabase grants these API read privileges in the hosted environment.
-- Simulate them only for the tables introduced by the auth foundation.
-- Run this file BEFORE the foundation migration, then apply the grants
-- below after the foundation migration in the CI workflow.
