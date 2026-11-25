# Karllee QA

Mobile quality assurance, inspection and snagging application for Karllee Construction (UK) Ltd.

## Current status (17 October 2026)

**Implemented in source:** Supabase authentication client with persisted sessions, email/password sign-in screen, Expo Router protected navigation, sign-out, and a dashboard that reads the signed-in user's **active organisation memberships** from Supabase. A missing membership is explicitly shown instead of implying access. No sample projects are presented as genuine site data.

**New source increment:** Organisation-scoped projects, plots and numbered 12-stage inspection attempts are defined in the migration `supabase/migrations/202610170001_projects_plots_inspections.sql`. A read-only **Developments & plots** screen now queries real Supabase rows through RLS; no sample developments are presented as real records. See `docs/projects-plots-inspections.md` for deployment and security checks.

**Not yet verified on a device or against the live Supabase project.** The new migration is **not applied to the live database**. Project/plot creation screens, detailed inspection checklists, evidence, snagging, subcontractor workflow, offline sync, reporting and deployment remain pending.

## Run locally

1. Install Node.js and run `npm install`.
2. Copy `.env.example` to `.env`.
3. In Supabase **Project Settings → API Keys**, obtain the **publishable** key; obtain the project URL from **Project Settings → Data API**. Set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Run `npm run typecheck`, then `npm start`. Open using Expo Go or an appropriate development build.
5. Sign in with a user created in Supabase Authentication → Users. The user must have an **active** row in `public.organisation_members` for an organisation to appear on the dashboard.

**Security:** `EXPO_PUBLIC_*` variables are embedded in the client. Only use the public/publishable key here; never put a Supabase secret or service-role key in the app or GitHub. The initial auth migration (`supabase/migrations/202609280001_auth_foundation.sql`) must already have been applied to the project. The migration does **not** automatically create the company membership; that is a separate one-off admin action.

## Smoke test checklist (manual, pending)

- With a clean install, the app opens on the sign-in screen.
- Wrong credentials show an error without navigating.
- Valid credentials open the dashboard and the active organisation name and role are fetched from Supabase.
- Signing out returns to sign-in; reopening the app restores a valid session.
- A valid account without an active organisation membership sees the access message.
- Unauthenticated users cannot navigate to the protected dashboard.
- RLS rejects a request for another user's membership.
- After applying the new migration, the Developments screen shows only projects and plots accessible to the signed-in organisation member.
- The cross-organisation, inactive-user and role-permission tests in `docs/projects-plots-inspections.md` pass.

## MVP build order

1. Authentication and Supabase integration — **source implementation complete; live smoke test pending**
2. Persistent projects, plots and QA inspections with organisation-scoped RLS — **schema and read-only project/plot screen committed; migration and live tests pending**
3. Photo/document evidence
4. Automatic snag creation from failed QA checks
5. Subcontractor completion workflow and email notifications
6. Offline sync and audit trail
7. PDF reports
8. Testing, deployment and release documentation
