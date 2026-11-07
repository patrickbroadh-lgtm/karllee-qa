import assert from 'node:assert/strict';
import test from 'node:test';
import { stageAttemptHistory, inspectionAnswers, answerSummary } from '../src/lib/inspection-history.ts';

const attempts = [
  { id: 'one', stage_number: 2, attempt: 1, inspected_at: '2026-10-21T08:00:00Z' },
  { id: 'other', stage_number: 1, attempt: 1, inspected_at: '2026-10-22T08:00:00Z' },
  { id: 'three', stage_number: 2, attempt: 3, inspected_at: '2026-10-20T08:00:00Z' },
  { id: 'two', stage_number: 2, attempt: 2, inspected_at: '2026-10-23T08:00:00Z' },
];
const answers = [
  { inspection_id: 'three', check_number: 2, check_text: 'Wall ties', result: 'fail', notes: 'Missing' },
  { inspection_id: 'other', check_number: 1, check_text: 'Site setup', result: 'pass', notes: null },
  { inspection_id: 'three', check_number: 1, check_text: 'DPC', result: 'pass', notes: null },
  { inspection_id: 'three', check_number: 3, check_text: 'Trays', result: 'not_applicable', notes: null },
];

test('stage history is newest attempt first even if inspection dates are out of order', () => {
  assert.deepEqual(stageAttemptHistory(attempts, 2).map((a) => a.id), ['three', 'two', 'one']);
});
test('stage history does not mutate the source array', () => {
  stageAttemptHistory(attempts, 2);
  assert.deepEqual(attempts.map((a) => a.id), ['one', 'other', 'three', 'two']);
});
test('answers are scoped to a single inspection and ordered by check number', () => {
  assert.deepEqual(inspectionAnswers(answers, 'three').map((a) => a.check_number), [1, 2, 3]);
});
test('legacy inspection has zero item answers; never infer passes', () => {
  assert.deepEqual(inspectionAnswers(answers, 'one'), []);
  assert.deepEqual(answerSummary([]), { passed: 0, failed: 0, notApplicable: 0 });
});
test('summary counts all result categories correctly', () => {
  assert.deepEqual(answerSummary(inspectionAnswers(answers, 'three')), { passed: 1, failed: 1, notApplicable: 1 });
});
