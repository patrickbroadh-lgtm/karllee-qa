import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFICATE_REVIEW_STATES, planCertificateReviewTransition as plan } from '../src/lib/certificate-review.ts';

// Exhaustively exercise the local state machine. These are NOT database RLS tests.
const submitterId = '11111111-1111-4111-8111-111111111111';
const reviewerId = '22222222-2222-4222-8222-222222222222';
const actions = ['submit', 'resubmit', 'request-changes', 'verify', 'reject'];
const allowed = {
  draft: ['submit'],
  submitted: ['request-changes', 'verify', 'reject'],
  'changes-requested': ['resubmit'],
  verified: [],
  rejected: [],
};
const reasonFor = (action) => ['request-changes', 'reject'].includes(action) ? 'Insufficient evidence' : undefined;

test('every state/action pair is explicitly permitted or denied', () => {
  for (const state of CERTIFICATE_REVIEW_STATES) {
    for (const action of actions) {
      const actorId = ['submit', 'resubmit'].includes(action) ? submitterId : reviewerId;
      const input = { state, action, role: 'site_manager', activeMember: true, actorId, submitterId, reason: reasonFor(action) };
      if (allowed[state].includes(action)) {
        assert.ok(CERTIFICATE_REVIEW_STATES.includes(plan(input).nextState), state + '/' + action);
      } else {
        assert.throws(() => plan(input), undefined, state + '/' + action);
      }
    }
  }
});

test('all actions fail closed for inactive staff and viewers', () => {
  for (const state of CERTIFICATE_REVIEW_STATES) {
    for (const action of actions) {
      const input = { state, action, role: 'site_manager', activeMember: true, actorId: submitterId, submitterId, reason: reasonFor(action) };
      assert.throws(() => plan({ ...input, activeMember: false }), undefined, state + '/' + action + ' inactive');
      assert.throws(() => plan({ ...input, role: 'viewer' }), undefined, state + '/' + action + ' viewer');
    }
  }
});

test('inspectors cannot independently review any submitted certificate', () => {
  for (const action of ['request-changes', 'verify', 'reject']) {
    assert.throws(() => plan({ state: 'submitted', action, role: 'inspector', activeMember: true, actorId: reviewerId, submitterId, reason: reasonFor(action) }));
  }
});

test('two-person safeguard applies to every reviewer role and review decision', () => {
  for (const role of ['site_manager', 'admin', 'director']) {
    for (const action of ['request-changes', 'verify', 'reject']) {
      assert.throws(() => plan({ state: 'submitted', action, role, activeMember: true, actorId: submitterId, submitterId, reason: reasonFor(action) }), /separate reviewer/);
    }
  }
});
