import assert from 'node:assert/strict';
import test from 'node:test';
import { newOfflineOutboxItem, claimOfflineOutboxItem, settleOfflineOutboxItem } from '../src/lib/offline-outbox-state.ts';
const userId='123e4567-e89b-42d3-a456-426614174000';
const projectId='123e4567-e89b-42d3-a456-426614174001';
const draft={id:'123e4567-e89b-42d3-a456-426614174002',userId,projectId,kind:'inspection-note',createdAt:'2026-11-20T08:00:00Z',payloadRef:'drafts/note-1'};
const now=Date.parse('2026-11-22T08:00:00Z');
const claim=()=>claimOfflineOutboxItem(newOfflineOutboxItem(draft),userId,projectId,now);
test('new drafts are provisional and pending',()=>assert.deepEqual(newOfflineOutboxItem(draft),{draft,state:'pending',attempts:0,nextAttemptAt:null}));
test('claim requires matching user and project',()=>{
  assert.throws(()=>claimOfflineOutboxItem(newOfflineOutboxItem(draft),projectId,projectId,now));
  assert.throws(()=>claimOfflineOutboxItem(newOfflineOutboxItem(draft),userId,userId,now));
});
test('successful server confirmation is terminal',()=>{
  const sent=settleOfflineOutboxItem(claim(),{ok:true},now);
  assert.equal(sent.state,'sent');
  assert.throws(()=>claimOfflineOutboxItem(sent,userId,projectId,now));
});
test('network failures wait for bounded retry and cannot claim early',()=>{
  const wait=settleOfflineOutboxItem(claim(),{ok:false,status:null,networkFailure:true},now);
  assert.equal(wait.state,'retry-wait');
  assert.equal(wait.nextAttemptAt,new Date(now+1000).toISOString());
  assert.throws(()=>claimOfflineOutboxItem(wait,userId,projectId,now+999));
  assert.equal(claimOfflineOutboxItem(wait,userId,projectId,now+1000).state,'sending');
});
test('auth failures block automatic replay',()=>{
  const blocked=settleOfflineOutboxItem(claim(),{ok:false,status:403},now);
  assert.equal(blocked.state,'needs-auth');
  assert.throws(()=>claimOfflineOutboxItem(blocked,userId,projectId,now));
});
test('conflicts require explicit resolution',()=>{
  for(const status of [409,412]){
    const blocked=settleOfflineOutboxItem(claim(),{ok:false,status},now);
    assert.equal(blocked.state,'conflict');
    assert.throws(()=>claimOfflineOutboxItem(blocked,userId,projectId,now));
  }
});
test('validation errors are rejected without automatic retry',()=>{
  assert.equal(settleOfflineOutboxItem(claim(),{ok:false,status:422},now).state,'rejected');
});
test('cannot settle an item twice or before claim',()=>{
  assert.throws(()=>settleOfflineOutboxItem(newOfflineOutboxItem(draft),{ok:true},now));
  assert.throws(()=>settleOfflineOutboxItem(settleOfflineOutboxItem(claim(),{ok:true},now),{ok:true},now));
});
test('invalid clock and attempt counter fail closed',()=>{
  assert.throws(()=>claimOfflineOutboxItem(newOfflineOutboxItem(draft),userId,projectId,NaN));
  assert.throws(()=>settleOfflineOutboxItem({...claim(),attempts:-1},{ok:false,status:500},now));
});
