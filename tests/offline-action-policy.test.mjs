import assert from 'node:assert/strict';
import test from 'node:test';
import { offlineActionDecision } from '../src/lib/offline-action-policy.ts';

test('offline draft actions are provisional and require server revalidation', () => {
  for (const action of ['save-checklist-draft', 'save-inspection-notes', 'queue-photo-evidence', 'queue-pdf-evidence']) {
    assert.deepEqual(offlineActionDecision(action), { allowed: true, requiresServerRevalidation: true });
  }
});

test('security-sensitive mutations cannot be completed offline', () => {
  for (const action of ['submit-checklist', 'approve-inspection', 'sign-off-inspection', 'change-user-role', 'delete-evidence']) {
    assert.deepEqual(offlineActionDecision(action), { allowed: false, reason: 'online-required' });
  }
});
