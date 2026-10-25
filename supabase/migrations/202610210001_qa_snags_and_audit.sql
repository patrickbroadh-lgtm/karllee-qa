-- Karllee QA: automatically create a snag for each failed QA stage attempt,
-- keep client inspection history append-only, and record snag status changes.
-- Prerequisites: 202609280001_auth_foundation.sql and
-- 202610170001_projects_plots_inspections.sql.
-- REVIEW ONLY: not applied to any Supabase project by this package.
begin;

-- NOT VALID preserves legacy incomplete rows for review while enforcing
-- the check on all new and updated inspections.
alter table public.qa_inspections
  add constraint qa_failed_inspection_requires_notes
  check (result <> 'fail' or (notes is not null and length(btrim(notes)) > 0))
  not valid;

-- Inspection evidence is append-only for ordinary authenticated users.
drop policy if exists "qa inspection update" on public.qa_inspections;
revoke update on public.qa_inspections from authenticated;

create table if not exists public.qa_snags (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null unique
    references public.qa_inspections(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null check (length(btrim(description)) > 0),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qa_snags_status_idx on public.qa_snags(status);
create index if not exists qa_snags_inspection_idx on public.qa_snags(inspection_id);

create table if not exists public.qa_snag_events (
  id uuid primary key default gen_random_uuid(),
  snag_id uuid not null references public.qa_snags(id) on delete restrict,
  previous_status text not null,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now()
);
create index if not exists qa_snag_events_snag_idx
  on public.qa_snag_events(snag_id, changed_at desc);

create or replace function public.qa_create_snag_on_failed_inspection()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.result = 'fail' then
    insert into public.qa_snags(inspection_id, title, description)
    values (
      new.id,
      format('QA stage %s failed (attempt %s)', new.stage_number, new.attempt),
      btrim(new.notes)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.qa_create_snag_on_failed_inspection() from public;

create or replace function public.qa_record_snag_status_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.qa_snag_events(snag_id, previous_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.qa_record_snag_status_change() from public;

create or replace function public.qa_set_snag_resolution_time()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at = now();
  elsif new.status <> 'resolved' then
    new.resolved_at = null;
  end if;
  return new;
end;
$$;
revoke all on function public.qa_set_snag_resolution_time() from public;

-- Backfill failed attempts inserted before this migration without inventing
-- missing findings or evidence.
insert into public.qa_snags(inspection_id, title, description)
select i.id,
       format('QA stage %s failed (attempt %s)', i.stage_number, i.attempt),
       coalesce(nullif(btrim(i.notes), ''), 'Historical failure: inspection notes were not recorded')
from public.qa_inspections i
where i.result = 'fail'
on conflict (inspection_id) do nothing;

drop trigger if exists qa_inspection_auto_snag on public.qa_inspections;
create trigger qa_inspection_auto_snag
  after insert on public.qa_inspections for each row
  execute function public.qa_create_snag_on_failed_inspection();

drop trigger if exists qa_snags_touch on public.qa_snags;
create trigger qa_snags_touch before update on public.qa_snags
  for each row execute function public.qa_touch_updated_at();
drop trigger if exists qa_snags_resolution_time on public.qa_snags;
create trigger qa_snags_resolution_time before update on public.qa_snags
  for each row execute function public.qa_set_snag_resolution_time();
drop trigger if exists qa_snags_status_event on public.qa_snags;
create trigger qa_snags_status_event after update on public.qa_snags
  for each row execute function public.qa_record_snag_status_change();

alter table public.qa_snags enable row level security;
alter table public.qa_snag_events enable row level security;

drop policy if exists "qa snag read" on public.qa_snags;
create policy "qa snag read" on public.qa_snags for select to authenticated
using (exists (
  select 1 from public.qa_inspections i
  join public.plots pl on pl.id = i.plot_id
  join public.projects p on p.id = pl.project_id
  where i.id = qa_snags.inspection_id and public.qa_is_member(p.organisation_id)
));

drop policy if exists "qa snag status update" on public.qa_snags;
create policy "qa snag status update" on public.qa_snags for update to authenticated
using (exists (
  select 1 from public.qa_inspections i
  join public.plots pl on pl.id = i.plot_id
  join public.projects p on p.id = pl.project_id
  where i.id = qa_snags.inspection_id and public.qa_can_manage(p.organisation_id)
))
with check (exists (
  select 1 from public.qa_inspections i
  join public.plots pl on pl.id = i.plot_id
  join public.projects p on p.id = pl.project_id
  where i.id = qa_snags.inspection_id and public.qa_can_manage(p.organisation_id)
));

drop policy if exists "qa snag events read" on public.qa_snag_events;
create policy "qa snag events read" on public.qa_snag_events for select to authenticated
using (exists (
  select 1 from public.qa_snags s
  join public.qa_inspections i on i.id = s.inspection_id
  join public.plots pl on pl.id = i.plot_id
  join public.projects p on p.id = pl.project_id
  where s.id = qa_snag_events.snag_id and public.qa_is_member(p.organisation_id)
));

-- Clients may read snags and status history. Managers may only update
-- status; all creation and audit history writes happen through triggers.
revoke all on public.qa_snags, public.qa_snag_events from anon;
revoke all on public.qa_snags, public.qa_snag_events from authenticated;
grant select on public.qa_snags, public.qa_snag_events to authenticated;
grant update(status) on public.qa_snags to authenticated;
commit;
