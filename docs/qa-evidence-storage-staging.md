# QA evidence Storage: private bucket and staging verification

Status (28 October 2026): **migration committed for review; not applied to live Supabase**.
The CI test uses a **synthetic** Storage table and simulated auth claims in disposable
PostgreSQL 16. It does not exercise Supabase's actual Storage HTTP API, JWT verification,
signed URLs, upload body handling, MIME detection or Expo photo picker.

## Migration

- File: supabase/migrations/202610280001_qa_evidence_storage.sql
- Bucket: qa-evidence, private, 20 MiB per object, JPEG/PNG/HEIC/PDF MIME allowlist.
- Object key: organisation_uuid/inspection_uuid/file_uuid.extension.
- Read: active members of the inspection's organisation.
- Insert: active director/admin/site manager/inspector for that organisation.
- No authenticated UPDATE/DELETE policies: evidence is append-only.
- Validates that the organisation prefix matches the inspection's plot/project.
- Requires the filename extension and metadata.mimetype to agree.
- Client-side file validation in src/lib/evidence-path.ts is **not** security.

The bucket policy is not sufficient to prove file contents match their declared MIME
type. The hosted Storage service must enforce the bucket's upload restrictions; a
further server-side content validation/scanning strategy may be needed before launch.

## Local disposable PostgreSQL CI

The GitHub Actions postgres-rls job:

1. Boots a minimal mock auth schema and Storage schema.
2. Applies the auth foundation and all QA migrations in chronological order.
3. Executes tests/rls-cross-org.sql and tests/rls-evidence-storage.sql.
4. Rolls back test fixtures.

Tests cover active inspector/manager uploads, viewer read-only access, isolation
from another organisation, inactive members, invalid paths and MIME mismatches,
and rejected authenticated overwrite/delete operations.

## Required hosted Supabase staging checks (NOT YET DONE)

Use a **separate staging Supabase project**; do not run this against live production.
Apply the ordered migrations there using the supported Supabase migration workflow.

1. Create real Auth users for manager, inspector, viewer, inactive and second-org manager.
2. Create two organisations, membership records, project, plot and a completed inspection.
3. Sign in through the actual Supabase client with each role (real JWT, no SQL test impersonation).
4. Upload a small JPEG using the Supabase Storage upload method as an inspector with contentType image/jpeg and upsert false; verify download as a member.
5. Confirm viewer cannot upload, other-org and inactive users cannot list/download,
   and no role can overwrite or delete evidence through the Storage API.
6. Confirm malformed path, cross-org prefix, missing inspection, extension/MIME mismatch,
   oversized file and disallowed MIME all fail.
7. Check storage.objects metadata, bucket privacy, authenticated downloads and
   signed URL behaviour; verify that object bytes and Content-Type match expectations.
8. Test Expo on iOS and Android with real camera/gallery/document files, especially HEIC,
   network failures and duplicate uploads.
9. Review any other policies already present on storage.objects. PostgreSQL's
   permissive RLS policies combine with OR; a broad pre-existing policy could
   override the intended append-only restrictions.

Do not merge PR #1, apply migrations to the live project, or claim that photo
upload is operational until these checks pass. No device photo-upload UI is
included in this increment.
