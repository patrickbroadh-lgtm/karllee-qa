# Disposable PostgreSQL integration test gate

This repository now runs a **real PostgreSQL 16 database** in GitHub Actions,
in addition to the TypeScript and Node unit tests.

## What the `postgres-rls` CI job does

1. Starts a throwaway PostgreSQL service (no Supabase production credentials).
2. Loads `tests/postgres-auth-bootstrap.sql`, a **minimal simulation** of
   Supabase's `auth.users`, `auth.uid()` and API roles. This is NOT a
   substitute for a real Supabase environment.
3. Applies `202609280001_auth_foundation.sql`, followed by the simulated
   foundation table grants in `tests/postgres-api-grants.sql`.
4. Applies QA migrations `202610170001`, `202610210001` and `202610220001`
   **in order**. A SQL error fails the workflow.
5. Executes `tests/rls-cross-org.sql` with `ON_ERROR_STOP=1`. Fixtures are
   created inside a transaction and rolled back, including successful writes.

The RLS script tests manager, inspector, viewer, other-organisation and
inactive-user access; checklist RPC authorisation, saving of all five stage-one
answers, automatic snag creation, append-only inspection attempts, incomplete
and undescribed-failure rejection, reinspection history, and snag status audit.

## What this does NOT prove

- It does not exercise a hosted Supabase Auth or PostgREST request with a
  signed JWT, storage policies, network permissions or service-role behaviour.
- The compatibility bootstrap is intentionally smaller than Supabase's actual
  `auth` schema and role/default-grant configuration.
- The test does not apply migrations to the live Karllee QA database, and it
  does not test Expo on a physical device.
- The rollback-only fixtures are test identities and must never be used in
  production.

## Required release gates before deployment

- Run the same ordered migrations against a **disposable Supabase project**
  using the real Auth/PostgREST schema, not the compatibility bootstrap.
- Verify authenticated inspector/manager/viewer requests, inactive membership,
  cross-organisation isolation, rejection of malformed submissions and
  reinspection, including audit records and snag status updates.
- Verify Storage RLS separately before enabling evidence uploads.
- Test the app against that disposable environment on an Expo device.
- Review migration rollback/recovery and backups before live deployment.
- Keep PR #1 in draft and do not deploy any QA migrations to production until
  these gates are complete.

## Running locally

With a clean PostgreSQL 16 database and superuser access, run:

```sh
psql -X -v ON_ERROR_STOP=1 -f tests/postgres-auth-bootstrap.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/202609280001_auth_foundation.sql
psql -X -v ON_ERROR_STOP=1 -f tests/postgres-api-grants.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/202610170001_projects_plots_inspections.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/202610210001_qa_snags_and_audit.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/202610220001_checklist_answers.sql
psql -X -v ON_ERROR_STOP=1 -f tests/rls-cross-org.sql
```

**Never** run the bootstrap or fixture script against a real Supabase project.
