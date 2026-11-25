-- Private QA evidence bucket. REVIEW/STAGING ONLY: do not run on production
-- until hosted Supabase Storage, Auth and device integration have been tested.
-- Requires the auth foundation and 202610170001 projects/plots/inspections.
-- The Storage service owns storage.buckets and storage.objects in Supabase.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qa-evidence', 'qa-evidence', false, 20971520,
  array['image/jpeg','image/png','image/heic','application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Client path contract: organisation UUID / inspection UUID / file UUID.ext.
-- Validate the exact three components before casting UUIDs. Never trust a
-- caller-supplied organisation prefix without checking the inspection's plot.
create or replace function public.qa_evidence_path_allowed(
  p_path text, p_write boolean
) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_inspection uuid;
begin
  if auth.uid() is null or p_path is null or p_write is null
    or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|heic|pdf)$'
  then
    return false;
  end if;

  v_org := pg_catalog.split_part(p_path, '/', 1)::uuid;
  v_inspection := pg_catalog.split_part(p_path, '/', 2)::uuid;
  return exists (
    select 1 from public.qa_inspections i
    join public.plots pl on pl.id = i.plot_id
    join public.projects p on p.id = pl.project_id
    where i.id = v_inspection
      and p.organisation_id = v_org
      and (case when p_write
        then public.qa_can_inspect(p.organisation_id)
        else public.qa_is_member(p.organisation_id)
      end)
  );
end;
$$;

-- The bucket enforces the maximum size and accepted MIME types. The RLS
-- policy also requires that the extension agrees with upload metadata.
create or replace function public.qa_evidence_mime_matches(
  p_path text, p_mime text
) returns boolean language sql immutable set search_path = ''
as $$
  select case
    when p_path ~ '\.(jpg|jpeg)$' then p_mime = 'image/jpeg'
    when p_path ~ '\.png$' then p_mime = 'image/png'
    when p_path ~ '\.heic$' then p_mime = 'image/heic'
    when p_path ~ '\.pdf$' then p_mime = 'application/pdf'
    else false
  end;
$$;

revoke all on function public.qa_evidence_path_allowed(text, boolean) from public;
revoke all on function public.qa_evidence_mime_matches(text, text) from public;
grant execute on function public.qa_evidence_path_allowed(text, boolean) to authenticated;
grant execute on function public.qa_evidence_mime_matches(text, text) to authenticated;

-- Bucket is private. Members may read evidence, but only active authorised
-- inspectors may upload it to an inspection in their own organisation.
-- No UPDATE or DELETE policies: evidence is append-only for app users.
-- Storage service_role retains its normal server-side administrative access.
drop policy if exists "qa evidence member read" on storage.objects;
create policy "qa evidence member read" on storage.objects
  for select to authenticated using (
    bucket_id = 'qa-evidence'
    and public.qa_evidence_path_allowed(name, false)
  );

drop policy if exists "qa evidence inspector upload" on storage.objects;
create policy "qa evidence inspector upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'qa-evidence'
    and public.qa_evidence_path_allowed(name, true)
    and public.qa_evidence_mime_matches(name, metadata ->> 'mimetype')
  );

commit;
