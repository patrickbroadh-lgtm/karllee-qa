import assert from 'node:assert/strict';
import test from 'node:test';
import { planCertificateReviewTransition as plan } from '../src/lib/certificate-review.ts';

// Negative-input tests for the LOCAL UI guard. These are not server/RLS tests.
const submitterId = '11111111-1111-4111-8111-111111111111';
const reviewerId = '22222222-2222-4222-8222-222222222222';
const base = { state: 'submitted', action: 'verify', role: 'site_manager', activeMember: true, actorId: reviewerId, submitterId };

test('runtime payloads cannot smuggle unexpected action keys through object prototypes', () => {
  for (const action of ['constructor', 'prototype', 'toString', 'hasOwnProperty', '__defineGetter__', null, {}, []]) {
    assert.throws(() => plan({ ...base, action }), /not permitted/, String(action));
  }
});

test('runtime role, state and membership payloads fail closed', () => {
  for (const role of ['constructor', '__proto__', null, {}, [], 'SITE_MANAGER']) {
    assert.throws(() => plan({ ...base, role }), /not permitted/);
  }
  for (const state of ['constructor', '__proto__', null, {}, []]) {
    assert.throws(() => plan({ ...base, state }), /not permitted/);
  }
  for (const activeMember of [false, null, 0, '', undefined]) {
    assert.throws(() => plan({ ...base, activeMember }), /not permitted/);
  }
});

test('submitter identity is case-insensitive but must be a valid UUID', () => {
  assert.equal(plan({ ...base, state: 'draft', action: 'submit', role: 'inspector', actorId: submitterId.toUpperCase() }).nextState, 'submitted');
  for (const submitterId of [null, undefined, {}, [], '11111111-1111-4111-8111-11111111111g']) {
    assert.throws(() => plan({ ...base, submitterId }), /Valid actor and submitter identifiers/);
  }
});
