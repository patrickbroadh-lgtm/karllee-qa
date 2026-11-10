import assert from 'node:assert/strict';
import test from 'node:test';
import { planCertificateReviewTransition as plan } from '../src/lib/certificate-review.ts';

// Boundary/security regression cases for the LOCAL planning guard only.
// These do not prove database enforcement, authenticated RPCs or hosted Supabase RLS.
const submitterId = '11111111-1111-4111-8111-111111111111';
const reviewerId = '22222222-2222-4222-8222-222222222222';
const base = { state: 'submitted', action: 'request-changes', role: 'site_manager', activeMember: true, actorId: reviewerId, submitterId, reason: 'Please attach commissioning results' };

test('review reasons reject blank, oversized and control-character payloads', () => {
  for (const reason of ['', '  \t  ', '\n', 'x'.repeat(1001), 'OK\u202e', 'OK\u200b', 'OK\u00ad']) {
    assert.throws(() => plan({ ...base, reason }), /valid review reason/, JSON.stringify(reason));
  }
  assert.equal(plan({ ...base, reason: 'x'.repeat(1000) }).nextState, 'changes-requested');
});

test('reason is mandatory for rejection but not verification', () => {
  assert.throws(() => plan({ ...base, action: 'reject', reason: undefined }), /valid review reason/);
  assert.equal(plan({ ...base, action: 'verify', reason: undefined }).nextState, 'verified');
});

test('unrecognised runtime actions, roles and states fail closed', () => {
  for (const patch of [{ action: '__proto__' }, { action: 'approve' }, { role: 'viewer' }, { role: 'owner' }, { state: 'archived' }]) {
    assert.throws(() => plan({ ...base, ...patch }), undefined, JSON.stringify(patch));
  }
});

test('invalid UUIDs cannot bypass the separate reviewer safeguard', () => {
  for (const bad of ['not-a-uuid', '', '11111111-1111-1111-1111-111111111111', '11111111-1111-4111-0111-111111111111']) {
    assert.throws(() => plan({ ...base, actorId: bad }), /Valid actor and submitter identifiers/);
    assert.throws(() => plan({ ...base, submitterId: bad }), /Valid actor and submitter identifiers/);
  }
  assert.throws(() => plan({ ...base, actorId: submitterId.toUpperCase() }), /separate reviewer/);
});

test('terminal verified and rejected states cannot be reopened locally', () => {
  for (const state of ['verified', 'rejected']) {
    for (const action of ['submit', 'resubmit', 'request-changes', 'verify', 'reject']) {
      assert.throws(() => plan({ ...base, state, action }), /not permitted/);
    }
  }
});
