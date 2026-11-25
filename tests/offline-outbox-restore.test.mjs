import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreOfflineOutboxItem } from '../src/lib/offline-outbox-restore.ts';
import { newOfflineOutboxItem, claimOfflineOutboxItem, settleOfflineOutboxItem } from '../src/lib/offline-outbox-state.ts';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const projectId = '123e4567-e89b-42d3-a456-426614174001';
const draft = { id:'123e4567-e89b-42d3-a456-426614174002', userId, projectId, kind:'inspection-note', createdAt:'2026-11-20T08:00:00Z', payloadRef:'drafts/note-1' };
const now = Date.parse('2026-11-22T08:00:00Z');
const pending = () => newOfflineOutboxItem(draft);
const roundtrip = item => JSON.parse(JSON.stringify(item));

test('valid pending record restores without changing its scope', () => assert.deepEqual(restoreOfflineOutboxItem(roundtrip(pending())), pending()));
test('interrupted send is quarantined rather than automatically retried', () => {
  const sending = claimOfflineOutboxItem(pending(), userId, projectId, now);
  const restored = restoreOfflineOutboxItem(roundtrip(sending));
  assert.equal(restored.state, 'conflict');
  assert.throws(() => claimOfflineOutboxItem(restored, userId, projectId, now + 1000));
});
test('retry deadline survives persistence and remains enforced', () => {
  const sending = claimOfflineOutboxItem(pending(), userId, projectId, now);
  const waiting = settleOfflineOutboxItem(sending, {ok:false,status:null,networkFailure:true}, now);
  const restored = restoreOfflineOutboxItem(roundtrip(waiting));
  assert.deepEqual(restored, waiting);
  assert.throws(() => claimOfflineOutboxItem(restored,userId,projectId,now));
});
test('rejects unexpected fields and malformed draft scope', () => {
  assert.throws(() => restoreOfflineOutboxItem({...pending(), approved:true}));
  assert.throws(() => restoreOfflineOutboxItem({...pending(), draft:{...draft,userId:'another'}}));
});
test('rejects invalid state and attempts', () => {
  assert.throws(() => restoreOfflineOutboxItem({...pending(),state:'approved'}));
  assert.throws(() => restoreOfflineOutboxItem({...pending(),attempts:-1}));
  assert.throws(() => restoreOfflineOutboxItem({...pending(),attempts:1}));
});
test('rejects invalid or unexpected retry deadlines', () => {
  assert.throws(() => restoreOfflineOutboxItem({...pending(),nextAttemptAt:'2026-11-22T08:00:00.000Z'}));
  assert.throws(() => restoreOfflineOutboxItem({...pending(),state:'retry-wait',attempts:1,nextAttemptAt:'invalid'}));
  assert.throws(() => restoreOfflineOutboxItem({...pending(),state:'retry-wait',attempts:0,nextAttemptAt:'2026-11-22T08:00:00.000Z'}));
});
test('terminal sent records are not replayable', () => {
  const sent = settleOfflineOutboxItem(claimOfflineOutboxItem(pending(),userId,projectId,now),{ok:true},now);
  assert.equal(restoreOfflineOutboxItem(roundtrip(sent)).state,'sent');
  assert.throws(() => claimOfflineOutboxItem(sent,userId,projectId,now));
});
