import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { QA_STAGE_TEMPLATES } from '../src/lib/qa-template.ts';

const sql = readFileSync(new URL('../supabase/migrations/202610220001_checklist_answers.sql', import.meta.url), 'utf8');

test('database template exactly matches all 48 reference checks', () => {
  const actual = [...sql.matchAll(/^  \((\d+), (\d+), '((?:[^']|'')*)'\)[,;]?$/gm)]
    .map(([, stage, number, label]) => [Number(stage), Number(number), label.replaceAll("''", "'")]);
  const expected = Object.entries(QA_STAGE_TEMPLATES)
    .flatMap(([stage, entry]) => entry.checks.map((label, index) => [Number(stage), index + 1, label]));
  assert.equal(actual.length, 48);
  assert.deepEqual(actual, expected);
});

test('checklist submission is a single atomic RPC with per-plot attempt locking', () => {
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.match(sql, /security definer set search_path = ''/i);
  assert.match(sql, /qa_can_inspect\(v_org_id\)/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /insert into public\.qa_inspections/i);
  assert.match(sql, /insert into public\.qa_check_answers/i);
  assert.match(sql, /count\(distinct a\.check_number\)/i);
});

test('direct client inspection inserts and checklist mutations are not granted', () => {
  assert.match(sql, /revoke insert on public\.qa_inspections from authenticated/i);
  assert.match(sql, /grant select on public\.qa_checklist_templates, public\.qa_check_answers to authenticated/i);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete) on public\.qa_check_answers to authenticated/i);
  assert.match(sql, /alter table public\.qa_check_answers enable row level security/i);
  assert.match(sql, /qa_is_member\(p\.organisation_id\)/i);
});

test('historical inspection answers preserve the exact checklist text', () => {
  assert.match(sql, /check_text text not null/i);
  assert.match(sql, /select v_inspection_id, t\.check_number, t\.check_text/i);
  assert.match(sql, /qa_check_failure_requires_notes/i);
});
