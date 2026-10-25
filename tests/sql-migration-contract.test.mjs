import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Static regression checks only: PostgreSQL RLS tests are still required.
const sql = readFileSync(new URL('../supabase/migrations/202610210001_qa_snags_and_audit.sql', import.meta.url), 'utf8');

test('snag migration is transactional and follows the initial QA schema', () => {
  assert.match(sql, /begin;/i);
  assert.match(sql, /commit;/i);
  assert.match(sql, /202610170001_projects_plots_inspections\.sql/);
});

test('failed inspections create snags automatically, including legacy backfill', () => {
  assert.match(sql, /after insert on public\.qa_inspections/i);
  assert.match(sql, /new\.result = 'fail'/i);
  assert.match(sql, /insert into public\.qa_snags\(inspection_id, title, description\)/i);
  assert.match(sql, /on conflict \(inspection_id\) do nothing/i);
});

test('inspection attempts are append-only to authenticated clients', () => {
  assert.match(sql, /drop policy if exists "qa inspection update"/i);
  assert.match(sql, /revoke update on public\.qa_inspections from authenticated/i);
  assert.match(sql, /qa_failed_inspection_requires_notes/i);
});

test('snag status writes and audit events are restricted by organisation', () => {
  assert.match(sql, /alter table public\.qa_snags enable row level security/i);
  assert.match(sql, /alter table public\.qa_snag_events enable row level security/i);
  assert.match(sql, /qa_can_manage\(p\.organisation_id\)/i);
  assert.match(sql, /qa_is_member\(p\.organisation_id\)/i);
  assert.match(sql, /grant update\(status\) on public\.qa_snags to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+insert\s+on\s+public\.qa_snags\s+to\s+authenticated/i);
});
