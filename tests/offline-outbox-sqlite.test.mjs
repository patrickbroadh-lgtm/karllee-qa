import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteOfflineOutbox } from '../src/lib/offline-outbox-sqlite.ts';
const userId='123e4567-e89b-42d3-a456-426614174000';
const projectId='123e4567-e89b-42d3-a456-426614174001';
const draft={id:'123e4567-e89b-42d3-a456-426614174002',userId,projectId,kind:'inspection-note',createdAt:'2026-11-20T08:00:00Z',payloadRef:'drafts/note-1'};
const now=Date.parse('2026-11-25T08:00:00Z');
// In-memory adapter contract test; not native SQLite integration.
function setup(){
  const rows=new Map();
  const db={
    async execAsync(){},
    async getFirstAsync(sql,...keys){const record=rows.get(keys.join('|'));return record===undefined?null:{record};},
    async runAsync(sql,...args){
      if(sql.startsWith('INSERT')){
        const key=args.slice(0,3).join('|');
        if(rows.has(key))throw new Error('duplicate');
        rows.set(key,args[3]);return {changes:1};
      }
      const [next,u,p,id,previous]=args;
      const key=[u,p,id].join('|');
      if(rows.get(key)!==previous)return {changes:0};
      rows.set(key,next);return {changes:1};
    }
  };
  return {queue:new SQLiteOfflineOutbox(db),db};
}
test('scope mismatch cannot enqueue or claim',async()=>{
  const {queue}=setup();
  await assert.rejects(queue.enqueue(draft,projectId,projectId));
  await queue.enqueue(draft,userId,projectId);
  await assert.rejects(queue.claim(projectId,projectId,draft.id,now));
});
test('duplicate draft cannot replace an existing record',async()=>{
  const {queue}=setup();
  await queue.enqueue(draft,userId,projectId);
  await assert.rejects(queue.enqueue(draft,userId,projectId));
});
test('only one concurrent claim wins',async()=>{
  const {queue}=setup();
  await queue.enqueue(draft,userId,projectId);
  const results=await Promise.allSettled([queue.claim(userId,projectId,draft.id,now),queue.claim(userId,projectId,draft.id,now)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('reopened adapter does not replay an interrupted claim',async()=>{
  const {queue,db}=setup();
  await queue.enqueue(draft,userId,projectId);
  await queue.claim(userId,projectId,draft.id,now);
  await assert.rejects(new SQLiteOfflineOutbox(db).claim(userId,projectId,draft.id,now));
});
