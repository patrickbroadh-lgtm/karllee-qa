-- Disposable PostgreSQL ONLY: minimal Storage schema for RLS policy tests.
-- Real Supabase supplies its own storage schema, tables and service roles.
create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  metadata jsonb,
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
-- Grant all four operations deliberately: RLS, not lack of SQL grants,
-- must prevent unauthorised reads, writes, overwrites and deletions.
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
