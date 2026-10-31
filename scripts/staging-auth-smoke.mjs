// Opt-in, WRITING hosted Supabase smoke test. NEVER run against production.
// Usage and staging-only fixtures: docs/hosted-supabase-smoke.md
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertStagingTarget } from './staging-smoke-guards.mjs';
import { assertStagingFixtureRoles } from './staging-fixture-guards.mjs';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See docs/hosted-supabase-smoke.md`);
  return value;
}
function uuid(name) {
  const value = required(name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid UUID in ${name}`);
  }
  return value.toLowerCase();
}
function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function mustSucceed(response, step) {
  if (response.error) throw new Error(`${step}: ${response.error.message}`);
  return response.data;
}
function mustDeny(response, step) {
  assert.ok(response.error, `${step}: operation was unexpectedly permitted`);
}
function log(step) { process.stdout.write(`PASS ${step}\n`); }

async function main() {
  // Guard MUST execute before creating any client or signing in.
  const url = assertStagingTarget({
    url: required('STAGING_SUPABASE_URL'),
    projectRef: required('STAGING_PROJECT_REF'),
    acknowledgement: required('STAGING_WRITE_ACK'),
  });
  const key = required('STAGING_PUBLISHABLE_KEY'); // Never use service_role.
  const orgA = uuid('STAGING_ORG_A_ID');
  const orgB = uuid('STAGING_ORG_B_ID');
  const plotA = uuid('STAGING_PLOT_A_ID');
  assert.notEqual(orgA, orgB, 'Organisations must differ');

  const roles = [
    ['inspectorA', 'STAGING_INSPECTOR_A'],
    ['viewerA', 'STAGING_VIEWER_A'],
    ['managerB', 'STAGING_MANAGER_B'],
  ];
  const sessions = {};
  try {
    for (const [role, prefix] of roles) {
      const supabase = client(url, key);
      const response = await supabase.auth.signInWithPassword({
        email: required(`${prefix}_EMAIL`),
        password: required(`${prefix}_PASSWORD`),
      });
      mustSucceed(response, `Sign in ${role}`);
      assert.ok(response.data.session?.access_token, `No JWT for ${role}`);
      sessions[role] = { supabase, userId: response.data.user.id };
    }
    assert.equal(new Set(Object.values(sessions).map(x => x.userId)).size, roles.length,
      'Test roles must use distinct real Auth users');
    log('real Supabase Auth password sign-in for three distinct users');

    const a = sessions.inspectorA.supabase;
    const viewer = sessions.viewerA.supabase;
    const b = sessions.managerB.supabase;

    // Fail closed on fixture identity/permissions BEFORE creating immutable records.
    // Each test user must belong to exactly one of the two staging organisations.
    const memberships = {};
    for (const [role] of roles) {
      const { supabase, userId } = sessions[role];
      memberships[role] = mustSucceed(await supabase.from('organisation_members')
        .select('organisation_id,role,active')
        .eq('user_id', userId)
        .in('organisation_id', [orgA, orgB]),
      `Read staging membership for ${role}`);
    }
    assertStagingFixtureRoles({
      orgA, orgB,
      inspectorA: memberships.inspectorA,
      viewerA: memberships.viewerA,
      managerB: memberships.managerB,
    });
    log('dedicated staging roles and no cross-organisation fixture memberships');

    const plot = mustSucceed(await a.from('plots')
      .select('id,project_id').eq('id', plotA).single(), 'Read staging plot A');
    const project = mustSucceed(await a.from('projects')
      .select('id,organisation_id').eq('id', plot.project_id).single(), 'Read staging project A');
    assert.equal(project.organisation_id, orgA, 'Staging plot is not owned by organisation A');
    const bProjects = mustSucceed(await b.from('projects')
      .select('id').eq('organisation_id', orgB).limit(1), 'B organisation visibility');
    assert.ok(bProjects.length, 'B manager has no visible B project fixture');
    const aVisibleToB = mustSucceed(await b.from('projects')
      .select('id').eq('id', project.id), 'B reads A project');
    assert.equal(aVisibleToB.length, 0, 'CROSS-ORG LEAK: B can read A project');
    const plotVisibleToB = mustSucceed(await b.from('plots')
      .select('id').eq('id', plotA), 'B reads A plot');
    assert.equal(plotVisibleToB.length, 0, 'CROSS-ORG LEAK: B can read A plot');
    log('real PostgREST organisation and plot isolation');

    const templates = mustSucceed(await a.from('qa_checklist_templates')
      .select('check_number,check_text').eq('stage_number', 1)
      .order('check_number'), 'Read stage 1 template');
    assert.equal(templates.length, 5, 'Expected five stage 1 checklist items');
    const answers = templates.map(({ check_number }) => ({
      check_number, result: 'pass', notes: null,
    }));
    const params = { p_plot_id: plotA, p_stage_number: 1, p_answers: answers };
    mustDeny(await viewer.rpc('qa_submit_stage_checklist', params), 'Viewer submits checklist');
    mustDeny(await b.rpc('qa_submit_stage_checklist', params), 'B submits A checklist');
    log('real JWT RPC denies viewer and cross-organisation caller');

    // Verify invalid checklists fail atomically, without consuming an attempt.
    const countAttempts = async () => {
      const response = await a.from('qa_inspections')
        .select('id', { count: 'exact', head: true })
        .eq('plot_id', plotA).eq('stage_number', 1);
      if (response.error) throw new Error(`Count staging inspections: ${response.error.message}`);
      assert.equal(typeof response.count, 'number', 'Missing inspection count');
      return response.count;
    };
    const attemptsBefore = await countAttempts();
    mustDeny(await a.rpc('qa_submit_stage_checklist', {
      ...params, p_answers: answers.slice(0, -1),
    }), 'Incomplete checklist');
    mustDeny(await a.rpc('qa_submit_stage_checklist', {
      ...params, p_answers: answers.map((answer, index) => index === 0
        ? { ...answer, result: 'fail', notes: '   ' } : answer),
    }), 'Failure without description');
    mustDeny(await a.rpc('qa_submit_stage_checklist', {
      ...params, p_answers: answers.map((answer, index) => index === 0
        ? { ...answer, check_number: 999 } : answer),
    }), 'Unknown checklist item');
    assert.equal(await countAttempts(), attemptsBefore,
      'SECURITY FAILURE: invalid checklist created an inspection attempt');
    log('real RPC rejects invalid checklists without partial inspection writes');

    // Creates ONE additional pass inspection attempt on a DEDICATED staging plot.
    const inspectionId = mustSucceed(await a.rpc('qa_submit_stage_checklist', params),
      'Inspector submits complete checklist');
    assert.match(inspectionId, /^[0-9a-f-]{36}$/i);
    const inspectorAnswers = mustSucceed(await a.from('qa_check_answers')
      .select('check_number,result').eq('inspection_id', inspectionId),
    'Read submitted answers');
    assert.equal(inspectorAnswers.length, 5);
    assert.ok(inspectorAnswers.every(x => x.result === 'pass'));
    const viewerAnswers = mustSucceed(await viewer.from('qa_check_answers')
      .select('id').eq('inspection_id', inspectionId), 'Viewer reads A answers');
    assert.equal(viewerAnswers.length, 5);
    const bAnswers = mustSucceed(await b.from('qa_check_answers')
      .select('id').eq('inspection_id', inspectionId), 'B reads A answers');
    assert.equal(bAnswers.length, 0, 'CROSS-ORG LEAK: B can read A answers');
    log('authenticated atomic checklist submission and answer RLS');

    // One tiny non-personal test image; append-only, deliberately not deleted.
    const path = `${orgA}/${inspectionId}/${randomUUID()}.png`;
    const png = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
      'base64'));
    mustSucceed(await a.storage.from('qa-evidence').upload(path, png, {
      contentType: 'image/png', upsert: false,
    }), 'Inspector uploads staging PNG');
    const prefix = `${orgA}/${inspectionId}`;
    const visible = mustSucceed(await viewer.storage.from('qa-evidence')
      .list(prefix), 'Viewer lists A evidence');
    assert.ok(visible.some(x => path.endsWith('/' + x.name)),
      'Viewer cannot list uploaded staging evidence');
    const signed = mustSucceed(await viewer.storage.from('qa-evidence')
      .createSignedUrl(path, 60), 'Viewer signs A evidence');
    assert.ok(signed.signedUrl);
    const bList = await b.storage.from('qa-evidence').list(prefix);
    if (!bList.error) assert.equal(bList.data?.length ?? 0, 0,
      'CROSS-ORG LEAK: B can list A evidence');
    mustDeny(await b.storage.from('qa-evidence').createSignedUrl(path, 60),
      'B signs A evidence');
    log('real Storage upload, member list/sign and cross-org isolation');

    mustDeny(await viewer.storage.from('qa-evidence').upload(
      `${orgA}/${inspectionId}/${randomUUID()}.png`, png,
      { contentType: 'image/png', upsert: false }), 'Viewer uploads A evidence');
    mustDeny(await b.storage.from('qa-evidence').upload(
      `${orgA}/${inspectionId}/${randomUUID()}.png`, png,
      { contentType: 'image/png', upsert: false }), 'B uploads A evidence');
    mustDeny(await a.storage.from('qa-evidence').upload(path, png,
      { contentType: 'image/png', upsert: true }), 'Overwrite evidence');
    const deletion = await a.storage.from('qa-evidence').remove([path]);
    // Some Storage API versions return an empty success when RLS hides the
    // target instead of reporting a permission error. Verify the object survives.
    const afterDelete = mustSucceed(await viewer.storage.from('qa-evidence')
      .list(prefix), 'Confirm evidence survives delete attempt');
    assert.ok(afterDelete.some(x => path.endsWith('/' + x.name)),
      'SECURITY FAILURE: evidence was deleted');
    if (!deletion.error) assert.equal(deletion.data?.length ?? 0, 0,
      'Delete API reported a removed object');
    log('real Storage rejects viewer/cross-org uploads, overwrite and delete');

    process.stdout.write(`STAGING SMOKE PASSED. Inspection: ${inspectionId}; evidence: ${path}\n`);
    process.stdout.write('Test records intentionally remain in staging. No live project was changed.\n');
  } finally {
    await Promise.allSettled(Object.values(sessions).map(x => x.supabase.auth.signOut()));
  }
}
main().catch(error => {
  // No passwords, JWTs or signed URLs are ever printed.
  process.stderr.write(`STAGING SMOKE FAILED: ${error.message}\n`);
  process.exitCode = 1;
});
