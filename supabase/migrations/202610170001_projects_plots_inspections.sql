-- Karllee QA projects, plots and stage inspection attempts.
-- Apply AFTER 202609280001_auth_foundation.sql. No site data is inserted.
begin;

create or replace function public.qa_is_member(org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org_id and m.user_id = auth.uid() and m.active
  );
$$;

create or replace function public.qa_can_manage(org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org_id and m.user_id = auth.uid() and m.active
      and m.role in ('director','admin','site_manager')
  );
$$;

create or replace function public.qa_can_inspect(org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org_id and m.user_id = auth.uid() and m.active
      and m.role in ('director','admin','site_manager','inspector')
  );
$$;

revoke all on function public.qa_is_member(uuid) from public;
revoke all on function public.qa_can_manage(uuid) from public;
revoke all on function public.qa_can_inspect(uuid) from public;
grant execute on function public.qa_is_member(uuid) to authenticated;
grant execute on function public.qa_can_manage(uuid) to authenticated;
grant execute on function public.qa_can_inspect(uuid) to authenticated;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  code text check (code is null or length(btrim(code)) between 1 and 50),
  status text not null default 'planning'
    check (status in ('planning','active','on_hold','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  plot_number text not null check (length(btrim(plot_number)) between 1 and 50),
  description text,
  status text not null default 'not_started'
    check (status in ('not_started','under_construction','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, plot_number)
);

-- The twelve actual stage labels and checklists have not yet been approved.
-- Re-inspections use a new attempt instead of overwriting the prior result.
create table if not exists public.qa_inspections (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete restrict,
  stage_number smallint not null check (stage_number between 1 and 12),
  attempt integer not null default 1 check (attempt > 0),
  result text not null default 'draft'
    check (result in ('draft','pass','fail','not_applicable')),
  notes text,
  inspected_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plot_id, stage_number, attempt)
);

create index if not exists qa_projects_org_idx on public.projects (organisation_id);
create index if not exists qa_plots_project_idx on public.plots (project_id);
create index if not exists qa_inspections_plot_stage_idx
  on public.qa_inspections (plot_id, stage_number, attempt desc);

create or replace function public.qa_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.qa_preserve_inspection_author()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Inspection author cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists qa_projects_touch on public.projects;
create trigger qa_projects_touch before update on public.projects
  for each row execute function public.qa_touch_updated_at();
drop trigger if exists qa_plots_touch on public.plots;
create trigger qa_plots_touch before update on public.plots
  for each row execute function public.qa_touch_updated_at();
drop trigger if exists qa_inspections_touch on public.qa_inspections;
create trigger qa_inspections_touch before update on public.qa_inspections
  for each row execute function public.qa_touch_updated_at();
drop trigger if exists qa_inspections_preserve_author on public.qa_inspections;
create trigger qa_inspections_preserve_author before update on public.qa_inspections
  for each row execute function public.qa_preserve_inspection_author();

alter table public.projects enable row level security;
alter table public.plots enable row level security;
alter table public.qa_inspections enable row level security;

drop policy if exists "qa project read" on public.projects;
create policy "qa project read" on public.projects for select to authenticated
  using (public.qa_is_member(organisation_id));
drop policy if exists "qa project insert" on public.projects;
create policy "qa project insert" on public.projects for insert to authenticated
  with check (public.qa_can_manage(organisation_id));
drop policy if exists "qa project update" on public.projects;
create policy "qa project update" on public.projects for update to authenticated
  using (public.qa_can_manage(organisation_id))
  with check (public.qa_can_manage(organisation_id));

drop policy if exists "qa plot read" on public.plots;
create policy "qa plot read" on public.plots for select to authenticated using (
  exists (select 1 from public.projects p
    where p.id = plots.project_id and public.qa_is_member(p.organisation_id))
);
drop policy if exists "qa plot insert" on public.plots;
create policy "qa plot insert" on public.plots for insert to authenticated with check (
  exists (select 1 from public.projects p
    where p.id = plots.project_id and public.qa_can_manage(p.organisation_id))
);
drop policy if exists "qa plot update" on public.plots;
create policy "qa plot update" on public.plots for update to authenticated
  using (exists (select 1 from public.projects p
    where p.id = plots.project_id and public.qa_can_manage(p.organisation_id)))
  with check (exists (select 1 from public.projects p
    where p.id = plots.project_id and public.qa_can_manage(p.organisation_id)));

drop policy if exists "qa inspection read" on public.qa_inspections;
create policy "qa inspection read" on public.qa_inspections for select to authenticated using (
  exists (select 1 from public.plots pl
    join public.projects p on p.id = pl.project_id
    where pl.id = qa_inspections.plot_id and public.qa_is_member(p.organisation_id))
);
drop policy if exists "qa inspection insert" on public.qa_inspections;
create policy "qa inspection insert" on public.qa_inspections for insert to authenticated
  with check (created_by = auth.uid() and exists (
    select 1 from public.plots pl join public.projects p on p.id = pl.project_id
    where pl.id = qa_inspections.plot_id and public.qa_can_inspect(p.organisation_id))
  );
drop policy if exists "qa inspection update" on public.qa_inspections;
create policy "qa inspection update" on public.qa_inspections for update to authenticated
  using (exists (
    select 1 from public.plots pl join public.projects p on p.id = pl.project_id
    where pl.id = qa_inspections.plot_id and public.qa_can_inspect(p.organisation_id))
  )
  with check (exists (
    select 1 from public.plots pl join public.projects p on p.id = pl.project_id
    where pl.id = qa_inspections.plot_id and public.qa_can_inspect(p.organisation_id))
  );

-- No client DELETE policy: retain QA history.
revoke all on public.projects, public.plots, public.qa_inspections from anon;
revoke all on public.projects, public.plots, public.qa_inspections from authenticated;
grant select, insert, update on public.projects, public.plots, public.qa_inspections to authenticated;
commit;
