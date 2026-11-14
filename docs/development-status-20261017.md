# Karllee QA development review — 17 October 2026

The sign-in and protected dashboard branch is under draft pull request #1. Device testing and Supabase integration testing remain outstanding. The next change will add organisation-scoped projects, plots and inspection records; it has not been deployed to Supabase.

Security requirement: organisation-scoped row-level security and 12-stage inspection attempt history. Do not expose privileged Supabase keys in mobile code.
