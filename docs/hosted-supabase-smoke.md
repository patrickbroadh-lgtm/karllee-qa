# Hosted Supabase staging smoke test (real Auth, RPC and Storage)

**Review-only / staging-only.** This test has not been run against hosted Supabase.
It creates one additional stage-1 inspection attempt and one tiny PNG object.
It does not delete them (QA evidence is append-only). **Never use live data,
production credentials, a service-role key, or the production project URL.**

## Prepare a separate project

1. Create a **new, disposable Supabase staging project**. Record its 20-character
   project reference and publishable/anon key. Do not copy live user data.
2. Apply the reviewed migrations **to staging only**, in this order:
   `202609280001_auth_foundation.sql`,
   `202610170001_projects_plots_inspections.sql`,
   `202610210001_qa_snags_and_audit.sql`,
   `202610220001_checklist_answers.sql`,
   `202610280001_qa_evidence_storage.sql`.
3. Provision **three distinct real Supabase Auth users** (email/password):
   an active inspector in organisation A, an active viewer in A, and an active
   manager in organisation B. Use the actual `organisation_members` roles.
4. Seed one dedicated test plot in organisation A, and at least one project in
   organisation B. Use test data only. The script verifies ownership and roles
   before making the first inspection submission.
5. Export these variables **locally in a private terminal or secure environment**,
   never in GitHub commits or logs:

   - `STAGING_SUPABASE_URL`: `https://<staging-ref>.supabase.co`
   - `STAGING_PROJECT_REF`: the exact 20-character staging project ref
   - `STAGING_PUBLISHABLE_KEY`: staging publishable/anon key, **not service_role**
   - `STAGING_ORG_A_ID`, `STAGING_ORG_B_ID`, `STAGING_PLOT_A_ID`
   - `STAGING_INSPECTOR_A_EMAIL`, `STAGING_INSPECTOR_A_PASSWORD`
   - `STAGING_VIEWER_A_EMAIL`, `STAGING_VIEWER_A_PASSWORD`
   - `STAGING_MANAGER_B_EMAIL`, `STAGING_MANAGER_B_PASSWORD`
   - `STAGING_WRITE_ACK=STAGING_ONLY_ACCEPT_TEST_RECORDS`

The script refuses to run without explicit acknowledgement or when the URL
does not **exactly** match the provided staging project reference on
`*.supabase.co`. This is a safety check, **not proof that the reference is
not your production project**. Verify the project identity manually first.

## Execute (manually, never in ordinary CI)

From the repository root, after `npm install`:

```sh
node scripts/staging-auth-smoke.mjs
```

The script checks:

- Real password sign-in and JWT-backed PostgREST visibility for A and B.
- Viewer and B-manager rejection of A's checklist RPC.
- A inspector's complete stage-1 checklist RPC, saved answers, viewer read,
  and B cross-organisation isolation.
- A inspector's real Storage API upload to the private bucket, A viewer
  listing/signed URL, B denial, viewer/B upload denial, overwrite denial,
  and evidence survival after an attempted deletion.

A successful run prints the test inspection UUID and object path. These
**staging-only** records remain by design. A failed run may also leave a
partially completed staging test (for example, the inspection exists but
Storage upload failed). Re-running creates another attempt.

## Boundaries and release gate

This is a **real hosted API integration smoke test only when actually executed**.
Committing it does not count as a passing hosted test. It does not replace
physical iOS/Android testing, network interruption testing, expired-token
checks, file content scanning, large-file rejection, signing/certificates,
or review of other pre-existing Storage policies. A 60-second signed URL is
a bearer URL and may remain usable until expiry even after access revocation.

Do not run this script in production, merge PR #1 or apply live migrations
until hosted staging, security review and device acceptance tests pass.
