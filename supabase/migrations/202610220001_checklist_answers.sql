-- Karllee QA: atomic, complete per-item inspection submissions.
-- Apply only AFTER 202610170001_projects_plots_inspections.sql and
-- 202610210001_qa_snags_and_audit.sql, following review and RLS tests.
-- REVIEW ONLY: this script has NOT been run against PostgreSQL or Supabase.
begin;

-- The source labels are the 48 reference prompts transcribed from QA Folder Rev a.
-- Template text is administrator-managed; old answers snapshot the exact label.
create table public.qa_checklist_templates (
  stage_number smallint not null check (stage_number between 1 and 12),
  check_number smallint not null check (check_number > 0),
  check_text text not null check (length(btrim(check_text)) > 0),
  primary key (stage_number, check_number)
);

insert into public.qa_checklist_templates(stage_number, check_number, check_text)
values
  (1, 1, 'Construction Drawings & Specifications Received'),
  (1, 2, 'Planning Conditions Reviewed'),
  (1, 3, 'Building Control Approval in Place'),
  (1, 4, 'Warranty Provider Acceptance Confirmed'),
  (1, 5, 'Setting Out & Datum Confirmed'),
  (2, 1, 'Excavations Inspected Prior to Pour — photos saved to Dropbox folder'),
  (2, 2, 'Foundations Poured'),
  (2, 3, 'Below-Ground Drainage Air / Water Test Carried Out (Witnessed)'),
  (2, 4, 'Substructure to DPC Completed'),
  (2, 5, 'DPC & DPM Installed and Continuous'),
  (3, 1, 'External Cavity Walls Constructed to Drawings'),
  (3, 2, 'Wall Ties & Insulation Installed Correctly'),
  (3, 3, 'Cavities Kept Clear Throughout Construction (signature/date required)'),
  (3, 4, 'Lintels, Trays & Weep Vents Installed'),
  (4, 1, 'First Floor Joists Installed & Restrained'),
  (4, 2, 'Stair Openings Formed Correctly'),
  (4, 3, 'Roof Structure Installed & Braced'),
  (4, 4, 'Fascia/Soffit/Barge boards installed to correct upstands for coverings'),
  (5, 1, 'Eaves Tray, Rafter Roll, Underlay, Battens & Roof Covering Installed'),
  (5, 2, 'Windows & External Doors Installed and Sealed'),
  (6, 1, 'First Fix Plumbing Installed, Pressure Tested and Witnessed (signature/date required)'),
  (6, 2, 'First Fix Electrical Installed'),
  (6, 3, 'Fire Stopping to Penetrations Completed (signature/date required)'),
  (7, 1, 'Wall & Roof Insulation Installed'),
  (7, 2, 'Vapour Control Layer Installed'),
  (7, 3, 'Plasterboarding complete and snag free (socket not overcut)'),
  (7, 4, 'Plasterboarding complete and snagged'),
  (8, 1, 'Second Fix Plumbing Completed'),
  (8, 2, 'Second Fix Electrical Completed'),
  (8, 3, 'Internal Joinery, Kitchens & Bathrooms Completed'),
  (9, 1, 'Drainage Final Connections Completed'),
  (9, 2, 'Paths, Drives & Levels Completed'),
  (10, 1, 'Electrical Installation Certificate Received (EIC to be filed)'),
  (10, 2, 'Gas Safe / Heating Certificate Received (Gas Safe / commissioning certificate to be filed)'),
  (10, 3, 'Air Source Heat Pump / Solar PV Installed (if applicable; MCS / commissioning certificate to be filed)'),
  (10, 4, 'Air Tightness Test Completed (air test report to be filed)'),
  (10, 5, 'EPC Completed (EPC to be filed)'),
  (11, 1, 'Oven Warranty Collected & Filed'),
  (11, 2, 'Hob Warranty Collected & Filed'),
  (11, 3, 'Dishwasher Warranty Collected & Filed'),
  (11, 4, 'Washing Machine Warranty Collected & Filed'),
  (11, 5, 'Tumble Dryer Warranty Collected & Filed'),
  (11, 6, 'Site Manager Signature / Date'),
  (12, 1, 'Building Control Final Certificate Received (completion certificate to be filed)'),
  (12, 2, 'Warranty Provider Final Certificate Received (final warranty certificate to be filed)'),
  (12, 3, 'Snagging Completed'),
  (12, 4, 'QA Folder Complete and Checked Prior to Handover'),
  (12, 5, 'Signed for Karllee Construction / Date');

create table public.qa_check_answers (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.qa_inspections(id) on delete restrict,
  check_number smallint not null check (check_number > 0),
  check_text text not null check (length(btrim(check_text)) > 0),
  result text not null check (result in ('pass', 'fail', 'not_applicable')),
  notes text,
  created_at timestamptz not null default now(),
  unique (inspection_id, check_number),
  constraint qa_check_failure_requires_notes check (
    result <> 'fail' or (notes is not null and length(btrim(notes)) > 0)
  )
);
create index qa_check_answers_inspection_idx on public.qa_check_answers(inspection_id);

alter table public.qa_checklist_templates enable row level security;
alter table public.qa_check_answers enable row level security;

create policy "qa checklist template read" on public.qa_checklist_templates
  for select to authenticated using (true);
create policy "qa check answer read" on public.qa_check_answers
  for select to authenticated using (exists (
    select 1 from public.qa_inspections i
    join public.plots pl on pl.id = i.plot_id
    join public.projects p on p.id = pl.project_id
    where i.id = qa_check_answers.inspection_id
      and public.qa_is_member(p.organisation_id)
  ));

revoke all on public.qa_checklist_templates, public.qa_check_answers from public, anon, authenticated;
grant select on public.qa_checklist_templates, public.qa_check_answers to authenticated;

-- Prevent bypassing the atomic submission API by inserting an overall stage
-- result without all its individual answers. Existing legacy attempts remain
-- read-only and explicitly have no per-item answers.
revoke insert on public.qa_inspections from authenticated;

create or replace function public.qa_submit_stage_checklist(
  p_plot_id uuid,
  p_stage_number smallint,
  p_answers jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_expected integer;
  v_count integer;
  v_distinct integer;
  v_failed integer;
  v_na integer;
  v_result text;
  v_notes text;
  v_attempt integer;
  v_inspection_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select p.organisation_id into v_org_id
  from public.plots pl join public.projects p on p.id = pl.project_id
  where pl.id = p_plot_id;
  if v_org_id is null or not public.qa_can_inspect(v_org_id) then
    raise exception 'Inspection access denied' using errcode = '42501';
  end if;
  if p_stage_number is null or p_stage_number not between 1 and 12 then
    raise exception 'Invalid QA stage';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Checklist answers must be a JSON array';
  end if;
  select count(*) into v_expected from public.qa_checklist_templates
  where stage_number = p_stage_number;
  if v_expected = 0 then
    raise exception 'QA stage template has no checks';
  end if;

  select count(*), count(distinct a.check_number),
         count(*) filter (where a.result = 'fail'),
         count(*) filter (where a.result = 'not_applicable')
  into v_count, v_distinct, v_failed, v_na
  from jsonb_to_recordset(p_answers) as a(check_number integer, result text, notes text);
  if v_count <> v_expected or v_distinct <> v_expected then
    raise exception 'Exactly one answer is required for each checklist item';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_answers)
      as a(check_number integer, result text, notes text)
    left join public.qa_checklist_templates t
      on t.stage_number = p_stage_number and t.check_number = a.check_number
    where t.check_number is null
      or a.result is null or a.result not in ('pass', 'fail', 'not_applicable')
      or (a.result = 'fail' and nullif(btrim(a.notes), '') is null)
  ) then
    raise exception 'Checklist contains an unknown check, result, or undescribed failure';
  end if;

  v_result := case when v_failed > 0 then 'fail'
                   when v_na = v_expected then 'not_applicable'
                   else 'pass' end;
  if v_failed > 0 then
    select string_agg(format('Check %s: %s', a.check_number, btrim(a.notes)), E'\n'
                      order by a.check_number)
      into v_notes
    from jsonb_to_recordset(p_answers) as a(check_number integer, result text, notes text)
    where a.result = 'fail';
  end if;

  -- Serialize competing submissions for the same plot/stage, so attempts are
  -- allocated without racing against another inspector's concurrent save.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_plot_id::text || ':' || p_stage_number::text, 0)
  );
  select coalesce(max(attempt), 0) + 1 into v_attempt
  from public.qa_inspections
  where plot_id = p_plot_id and stage_number = p_stage_number;

  insert into public.qa_inspections
    (plot_id, stage_number, attempt, result, notes, inspected_at, created_by)
  values (p_plot_id, p_stage_number, v_attempt, v_result, v_notes, now(), auth.uid())
  returning id into v_inspection_id;

  insert into public.qa_check_answers
    (inspection_id, check_number, check_text, result, notes)
  select v_inspection_id, t.check_number, t.check_text, a.result, nullif(btrim(a.notes), '')
  from jsonb_to_recordset(p_answers) as a(check_number integer, result text, notes text)
  join public.qa_checklist_templates t
    on t.stage_number = p_stage_number and t.check_number = a.check_number;

  return v_inspection_id;
end;
$$;

revoke all on function public.qa_submit_stage_checklist(uuid, smallint, jsonb) from public;
grant execute on function public.qa_submit_stage_checklist(uuid, smallint, jsonb) to authenticated;
commit;
