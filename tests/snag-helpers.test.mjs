import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageSnag, snagStatusLabel, SNAG_STATUSES } from '../src/lib/snag-helpers.ts';

test('snag status options match the planned database constraint', () => {
  assert.deepEqual(SNAG_STATUSES, ['open', 'in_progress', 'resolved']);
});

test('only project management roles can change snag status', () => {
  for (const role of ['director', 'admin', 'site_manager']) {
    assert.equal(canManageSnag(role), true, role);
  }
  for (const role of ['inspector', 'subcontractor', 'viewer', 'contracts_manager', '', null]) {
    assert.equal(canManageSnag(role), false, String(role));
  }
});

test('snag statuses are human-readable', () => {
  assert.equal(snagStatusLabel('open'), 'Open');
  assert.equal(snagStatusLabel('in_progress'), 'In progress');
  assert.equal(snagStatusLabel('resolved'), 'Resolved');
});
