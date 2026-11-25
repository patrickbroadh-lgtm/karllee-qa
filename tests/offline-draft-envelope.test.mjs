import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOfflineDraftEnvelope, assertOfflineDraftOwner } from '../src/lib/offline-draft-envelope.ts';
const userId = '123e4567-e89b-42d3-a456-426614174000';
const projectId = '123e4567-e89b-42d3-a456-426614174001';
const draft = { id: '123e4567-e89b-42d3-a456-426614174002', userId, projectId, kind: 'inspection-note', createdAt: '2026-11-20T08:00:00Z', payloadRef: 'drafts/note-1' };
test('accepts well-scoped provisional draft', () => assert.deepEqual(validateOfflineDraftEnvelope(draft), draft));
test('rejects unapproved offline actions', () => assert.throws(() => validateOfflineDraftEnvelope({...draft, kind:'inspection-approval'})));
test('rejects unexpected fields and malformed IDs', () => {
  assert.throws(() => validateOfflineDraftEnvelope({...draft, approved:true}));
  assert.throws(() => validateOfflineDraftEnvelope({...draft, userId:'someone'}));
});
test('rejects absolute paths and path traversal', () => {
  for (const payloadRef of ['/tmp/file','drafts/../secret','']) assert.throws(() => validateOfflineDraftEnvelope({...draft, payloadRef}));
});
test('rejects malformed timestamps', () => assert.throws(() => validateOfflineDraftEnvelope({...draft, createdAt:'yesterday'})));
test('blocks cross-user and cross-project replay', () => {
  const valid = validateOfflineDraftEnvelope(draft);
  assert.doesNotThrow(() => assertOfflineDraftOwner(valid,userId,projectId));
  assert.throws(() => assertOfflineDraftOwner(valid,projectId,projectId));
  assert.throws(() => assertOfflineDraftOwner(valid,userId,userId));
});
