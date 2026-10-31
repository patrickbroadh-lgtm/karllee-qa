# Inspection photo evidence: hosted staging acceptance tests

Status: **code review / staging only**. Do not run QA migrations on the live
Supabase project and do not merge PR #1 until these gates are complete.

## Scope and implementation

- The inspection history screen links to `/evidence?inspectionId=<uuid>`.
- Authenticated members can list and view files on a specific immutable
  inspection attempt. Authorised inspectors can take/select one photo at a
  time; uploads use Expo ImagePicker + Expo FileSystem `File.arrayBuffer()`.
- Upload paths are `<organisation UUID>/<inspection UUID>/<new file UUID>.<ext>`.
  The client validates MIME/extension and 1–20 MiB; the private Storage
  bucket and RLS enforce organisation/inspection/role checks. No upserts,
  updates or deletes are exposed to app users.
- JPEG, PNG and HEIC are supported. PDF certificates are intentionally not
  yet selectable in the photo screen. Original image formats may be converted
  by the device picker; reject MIME/extension mismatches rather than silently
  relabel file bytes.
- Evidence is opened with a 60-second signed URL. This is a bearer URL:
  treat it as sensitive and do not log or share it. The bucket is never public.
- Current implementation loads the selected file into memory (ArrayBuffer).
  For now the 20 MiB cap is mandatory; consider resumable/streaming uploads
  before permitting larger evidence or poor mobile connectivity.

## Prepare an isolated Supabase staging project

1. Create a separate staging Supabase project with its own URL, publishable
   key, test users and non-production data. Never copy production credentials
   into GitHub or commit `.env`.
2. Review and apply the committed auth foundation and QA migrations in order
   **to staging only**: `202609280001`, `202610170001`,
   `202610210001`, `202610220001`, `202610280001`.
3. Configure test organisations A and B, active director/site manager,
   inspector, viewer, and inactive member users. Create project, plot and
   recorded inspection attempts in each organisation.
4. Confirm the `qa-evidence` bucket is private, allowed MIME types and
   size limit are correct, and there are no unintended broad Storage policies.
5. Run the app against staging credentials on physical iOS and Android
   devices (camera availability, picker, permissions, app resume and session
   refresh). Rebuild the app when native plugin configuration changes.

## Hosted Auth / Storage / PostgREST checks (must be observed)

- [ ] Active A inspector can upload JPEG, PNG and HEIC (where supported),
      see the new item in the list and open it with a signed URL.
- [ ] A viewer can list/open A evidence but cannot upload; inactive A user
      and anonymous user cannot list, read, sign or upload.
- [ ] A user cannot list/read/sign/upload evidence for organisation B,
      even with a guessed inspection UUID and a crafted A/B path.
- [ ] A user cannot upload to an unrelated inspection, malformed path,
      unsupported MIME, mismatched extension/MIME or >20 MiB file.
- [ ] A user cannot overwrite an existing object, update metadata or delete
      evidence through the Storage API.
- [ ] A signed URL expires as expected; opening evidence does not make the
      bucket public. Recheck policy for any pre-existing signed URL after
      membership revocation: signed URLs may remain usable until expiry.
- [ ] Reinspection evidence stays attached to the original attempt; a new
      attempt starts with an empty evidence list.
- [ ] Rejecting a permission prompt, cancelling picker, lost connectivity,
      duplicate uploads, upload errors and large photos all show recoverable
      UI feedback without claiming a successful upload.
- [ ] Confirm the Storage metadata `mimetype` is populated correctly by
      real uploads. Synthetic PostgreSQL tests do not establish this.
- [ ] Verify that actual `qa_submit_stage_checklist` calls work through
      hosted JWT/PostgREST for authorised roles and reject cross-org calls.
- [ ] Verify iOS and Android release builds, not only Expo Go.

## Known limitations / release blockers

- No hosted Supabase staging tests or physical-device uploads have been run.
- No evidence-specific relational audit/attachment table, captions or photo
  annotation yet; the object path ties evidence to an immutable inspection.
- No PDF certificate picker, signatures, offline queue, upload progress or
  resumable transfers. Storage list pagination is implemented, but needs a
  high-volume staging test.
- The app has no production QA sign-off workflow yet. Do not use it to certify
  statutory compliance or replace signed site inspection records.

Only after the checklist passes should production migration/deployment be
planned with backups, a rollback plan and an agreed release window.
