# Karllee QA projects, plots and inspections

**Migration:** `supabase/migrations/202610170001_projects_plots_inspections.sql`

## Deployment (not yet performed)

The migration is source code only. GitHub commits do **not** update the live Supabase database. Apply it **after** `202609280001_auth_foundation.sql` in the correct Supabase project's SQL Editor, using an administrator connection, only after review. It creates empty tables: **no real project, plot or inspection records are seeded**.

## Model and access

- `projects` belong to an organisation. Managers can create/update them.
- `plots` belong to projects. Plot numbers are unique within a project.
- `qa_inspections` belong to plots, with numbered stage 1–12, attempt number, result, notes and immutable creator. Separate attempts preserve re-inspection history.
- Row-level security (RLS) grants **read** to active organisation members, **project/plot write** to director/admin/site manager, and **inspection write** additionally to inspectors. No client delete policies.
- The twelve stage **names and checklist questions are not yet specified**. Do not interpret the numbered stages as approved checklists.
- Subcontractor and viewer roles currently see all projects within their organisation. Project-specific assignments and fine-grained subcontractor visibility are future work.

## Essential integration tests (pending)

Use authenticated client sessions, **not** Supabase SQL Editor's privileged role (which bypasses RLS):

1. Director in organisation A creates a project and plot in A.
2. Inspector in A reads both and creates an inspection, but cannot create a project.
3. Viewer in A can read but cannot create or edit.
4. Member only in organisation B cannot read or modify any of A's records, even when supplying A's UUIDs.
5. Inactive member of A cannot access A's records.
6. Duplicate plot number or stage+attempt is rejected.
7. Updating `created_by` on an inspection is rejected.
8. Unauthenticated requests cannot access any of the new tables.

**Status:** Authenticated access and SQL execution have **not** been tested against the live database. Do not declare production-ready before these tests pass.
