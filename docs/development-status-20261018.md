# Karllee QA — 18 October 2026

## Next increment: project and plot creation

- Only active directors, administrators and site managers may create developments or plots.
- The user must choose an organisation they actively manage; do not assume all users belong to one company.
- New developments start in planning status. New plots start in not-started status.
- Trim and validate names, reference codes and plot numbers before insert.
- Preserve uniqueness of project codes per organisation and plot numbers per project.
- The Supabase RLS policies remain the authority for write permission, regardless of client controls.
- Never pre-populate real developments with fabricated data.

## Deployment and verification

The 17 October migration is not known to have been applied to the live Supabase project. No live database changes are performed by this documentation commit. Integration tests must use real authenticated sessions to validate cross-organisation isolation, role-based write access and duplicate plot rejection. Device testing is still pending.
