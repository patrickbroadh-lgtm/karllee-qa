import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStagingFixtureRoles } from '../scripts/staging-fixture-guards.mjs';

const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const member = (organisation_id, role, active = true) => ({ organisation_id, role, active });
const valid = {
  orgA, orgB,
  inspectorA: [member(orgA, 'inspector')],
  viewerA: [member(orgA, 'viewer')],
  managerB: [member(orgB, 'site_manager')],
};

test('accepts isolated active inspector/viewer/manager staging users', () => {
  assert.equal(assertStagingFixtureRoles(valid), true);
  for (const role of ['director', 'admin', 'site_manager']) {
    assert.equal(assertStagingFixtureRoles({ ...valid, managerB: [member(orgB, role)] }), true);
  }
});

test('rejects missing, inactive or wrong-role fixture memberships', () => {
  for (const change of [
    { inspectorA: [] },
    { viewerA: [member(orgA, 'viewer', false)] },
    { inspectorA: [member(orgA, 'site_manager')] },
    { viewerA: [member(orgA, 'inspector')] },
    { managerB: [member(orgB, 'viewer')] },
    { managerB: null },
  ]) {
    assert.throws(() => assertStagingFixtureRoles({ ...valid, ...change }), /Staging/);
  }
});

test('rejects cross-org memberships and swapped organisation fixtures', () => {
  for (const change of [
    { inspectorA: [member(orgA, 'inspector'), member(orgB, 'viewer')] },
    { viewerA: [member(orgB, 'viewer')] },
    { managerB: [member(orgA, 'site_manager')] },
    { orgB: orgA },
  ]) {
    assert.throws(() => assertStagingFixtureRoles({ ...valid, ...change }), /Staging/);
  }
});
