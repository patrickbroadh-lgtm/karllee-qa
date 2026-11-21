-- Disposable CI only: mimic Supabase's default authenticated API grants
-- on the tables created by the authentication foundation.
-- Run after 202609280001_auth_foundation.sql and before QA migrations.
GRANT SELECT ON public.organisations, public.organisation_members, public.profiles
  TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
