import assert from 'node:assert/strict';
import test from 'node:test';
import { planCertificateReviewTransition as plan } from '../src/lib/certificate-review.ts';

const submitterId = '11111111-1111-4111-8111-111111111111';
const reviewerId = '22222222-2222-4222-8222-222222222222';
const base = { state: 'submitted', action: 'verify', role: 'site_manager', activeMember: true, actorId: reviewerId, submitterId };

test('independent active manager may verify submitted certificate', () => {
  assert.deepEqual(plan(base), { nextState: 'verified', requiresReason: false });
});
test('viewer, inactive member and submitter cannot approve', () => {
  for (const patch of [{ role: 'viewer' }, { activeMember: false }, { actorId: submitterId }])
    assert.throws(() => plan({ ...base, ...patch }));
});
test('reason required for rejection or changes and separate reviewer', () => {
  for (const action of ['reject', 'request-changes']) {
    assert.throws(() => plan({ ...base, action }), /reason/);
    assert.throws(() => plan({ ...base, action, reason: 'Please correct', actorId: submitterId }), /separate reviewer/);
    assert.equal(plan({ ...base, action, reason: 'Please correct' }).requiresReason, true);
  }
});
test('review reason rejects controls and oversize text', () => {
  for (const reason of ['  ', 'bad\nreason', 'bad\u202e', 'a'.repeat(1001)])
    assert.throws(() => plan({ ...base, action: 'reject', reason }));
});
test('cannot skip submission, re-approve, or resubmit rejected certificates', () => {
  for (const patch of [
    { state: 'draft' }, { state: 'verified' },
    { state: 'rejected', action: 'resubmit' },
    { state: 'draft', action: 'resubmit' },
  ]) assert.throws(() => plan({ ...base, ...patch }));
});
test('draft submission and changes-requested resubmission are allowed for inspectors', () => {
  assert.equal(plan({ ...base, state: 'draft', action: 'submit', role: 'inspector', actorId: submitterId }).nextState, 'submitted');
  assert.equal(plan({ ...base, state: 'changes-requested', action: 'resubmit', role: 'inspector', actorId: submitterId }).nextState, 'submitted');
});
test('invalid identities and unknown actions fail closed', () => {
  for (const patch of [{ actorId: 'x' }, { submitterId: '' }, { action: '__proto__' }])
    assert.throws(() => plan({ ...base, ...patch }));
});
