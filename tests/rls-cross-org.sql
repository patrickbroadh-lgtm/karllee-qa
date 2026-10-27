-- Cross-organisation RLS integration checks for Karllee QA.
-- Run ONLY in a disposable local Supabase database as postgres, after the
-- auth, projects, snags and checklist migrations. Never run against production.
-- All test fixtures and changes are rolled back.
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-manager-a@example.invalid', '', now(), now(), now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-inspector-a@example.invalid', '', now(), now(), now()),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-viewer-a@example.invalid', '', now(), now(), now()),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-manager-b@example.invalid', '', now(), now(), now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-inactive-a@example.invalid', '', now(), now(), now());

INSERT INTO public.organisations (id, name) VALUES
 ('11111111-1111-4111-8111-111111111111', 'QA TEST Organisation A'),
 ('22222222-2222-4222-8222-222222222222', 'QA TEST Organisation B');
INSERT INTO public.organisation_members (organisation_id, user_id, role, active) VALUES
 ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'site_manager', true),
 ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'inspector', true),
 ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'viewer', true),
 ('22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'site_manager', true),
 ('11111111-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'site_manager', false);
INSERT INTO public.projects (id, organisation_id, name, status) VALUES
 ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'QA TEST Project A', 'active');
INSERT INTO public.plots (id, project_id, plot_number) VALUES
 ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'QA-1');

-- Test as an authenticated A manager rather than as the admin/service role.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.projects WHERE id = '33333333-3333-4333-8333-333333333333') <> 1
 THEN RAISE EXCEPTION 'FAIL: A manager cannot read their project'; END IF;
 INSERT INTO public.plots (project_id, plot_number)
 VALUES ('33333333-3333-4333-8333-333333333333', 'QA-2');
END $$;

-- A inspector can record complete checklist answers, but not create projects.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $$ BEGIN
 BEGIN
   INSERT INTO public.projects (organisation_id, name)
   VALUES ('11111111-1111-4111-8111-111111111111', 'SHOULD FAIL');
   RAISE EXCEPTION 'FAIL: inspector created a project';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT public.qa_submit_stage_checklist(
 '44444444-4444-4444-8444-444444444444'::uuid,
 1::smallint,
 (SELECT jsonb_agg(jsonb_build_object(
     'check_number', check_number,
     'result', CASE WHEN check_number = 1 THEN 'fail' ELSE 'pass' END,
     'notes', CASE WHEN check_number = 1 THEN 'Test defect description' ELSE NULL END
   ) ORDER BY check_number)
  FROM public.qa_checklist_templates WHERE stage_number = 1)
);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.qa_check_answers) <> 5
 THEN RAISE EXCEPTION 'FAIL: atomic checklist did not save five answers'; END IF;
 IF (SELECT count(*) FROM public.qa_snags) <> 1
 THEN RAISE EXCEPTION 'FAIL: failed checklist did not generate one snag'; END IF;
 BEGIN
   UPDATE public.qa_inspections SET notes = 'TAMPERED';
   RAISE EXCEPTION 'FAIL: inspector altered immutable inspection';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

-- A viewer may read inspection evidence, but cannot submit a new attempt.
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.qa_check_answers) <> 5
 THEN RAISE EXCEPTION 'FAIL: A viewer cannot read organisation checklist'; END IF;
 BEGIN
   PERFORM public.qa_submit_stage_checklist(
     '44444444-4444-4444-8444-444444444444'::uuid, 1::smallint, '[]'::jsonb);
   RAISE EXCEPTION 'FAIL: viewer submitted an inspection';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

-- B manager must not read A's records or create A's plots/inspections.
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.projects WHERE id = '33333333-3333-4333-8333-333333333333')
 OR EXISTS (SELECT 1 FROM public.plots WHERE id = '44444444-4444-4444-8444-444444444444')
 OR EXISTS (SELECT 1 FROM public.qa_inspections)
 OR EXISTS (SELECT 1 FROM public.qa_check_answers)
 OR EXISTS (SELECT 1 FROM public.qa_snags)
 OR EXISTS (SELECT 1 FROM public.qa_snag_events)
 THEN RAISE EXCEPTION 'FAIL: organisation B can read organisation A records'; END IF;
 BEGIN
   INSERT INTO public.plots (project_id, plot_number)
   VALUES ('33333333-3333-4333-8333-333333333333', 'CROSS-ORG');
   RAISE EXCEPTION 'FAIL: organisation B created plot in A';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.qa_submit_stage_checklist(
     '44444444-4444-4444-8444-444444444444'::uuid, 1::smallint, '[]'::jsonb);
   RAISE EXCEPTION 'FAIL: organisation B submitted inspection for A';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

-- Inactive A member cannot read A's records.
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.projects)
 OR EXISTS (SELECT 1 FROM public.plots)
 OR EXISTS (SELECT 1 FROM public.qa_inspections)
 OR EXISTS (SELECT 1 FROM public.qa_snags)
 THEN RAISE EXCEPTION 'FAIL: inactive member retains access'; END IF;
END $$;

-- Incomplete checklists must be rejected atomically, without creating
-- an inspection, answers or a second snag.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.qa_submit_stage_checklist(
      '44444444-4444-4444-8444-444444444444'::uuid,
      1::smallint,
      '[{"check_number":1,"result":"pass"}]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Exactly one answer%' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: incomplete checklist accepted'; END IF;
  IF (SELECT count(*) FROM public.qa_inspections) <> 1
     OR (SELECT count(*) FROM public.qa_check_answers) <> 5
     OR (SELECT count(*) FROM public.qa_snags) <> 1
  THEN RAISE EXCEPTION 'FAIL: rejected checklist left partial writes'; END IF;
END $$;

-- A complete checklist with a failed check lacking notes must also fail.
DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.qa_submit_stage_checklist(
      '44444444-4444-4444-8444-444444444444'::uuid,
      1::smallint,
      (SELECT jsonb_agg(jsonb_build_object(
        'check_number', check_number,
        'result', CASE WHEN check_number = 1 THEN 'fail' ELSE 'pass' END,
        'notes', CASE WHEN check_number = 1 THEN '' ELSE NULL END
      ) ORDER BY check_number)
      FROM public.qa_checklist_templates WHERE stage_number = 1)
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Checklist contains%' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: failure without notes accepted'; END IF;
END $$;

-- Direct inserts must not bypass the atomic checklist RPC.
DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.qa_inspections (plot_id, stage_number, attempt, result)
    VALUES ('44444444-4444-4444-8444-444444444444', 1, 2, 'pass');
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: direct inspection insert allowed'; END IF;
END $$;

-- A reinspection must append attempt 2 and preserve attempt 1 and its snag.
SELECT public.qa_submit_stage_checklist(
 '44444444-4444-4444-8444-444444444444'::uuid,
 1::smallint,
 (SELECT jsonb_agg(jsonb_build_object('check_number', check_number, 'result', 'pass') ORDER BY check_number)
  FROM public.qa_checklist_templates WHERE stage_number = 1)
);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.qa_inspections WHERE stage_number = 1) <> 2
 OR (SELECT count(*) FROM public.qa_check_answers) <> 10
 OR (SELECT count(*) FROM public.qa_snags) <> 1
 THEN RAISE EXCEPTION 'FAIL: reinspection did not preserve history'; END IF;
END $$;

-- Only a manager can resolve a snag; status changes must be audited.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $$
DECLARE changed integer;
BEGIN
 UPDATE public.qa_snags SET status = 'resolved' WHERE status = 'open';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 1 THEN RAISE EXCEPTION 'FAIL: manager could not resolve snag'; END IF;
 IF (SELECT count(*) FROM public.qa_snag_events
     WHERE previous_status = 'open' AND new_status = 'resolved'
       AND changed_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1
 THEN RAISE EXCEPTION 'FAIL: snag status audit missing'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
DO $$
DECLARE changed integer;
BEGIN
 UPDATE public.qa_snags SET status = 'open' WHERE status = 'resolved';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'FAIL: viewer changed snag status'; END IF;
END $$;

ROLLBACK;
