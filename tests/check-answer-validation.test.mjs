import assert from 'node:assert/strict';
import test from 'node:test';
import { overallCheckResult, validateCheckAnswers } from '../src/lib/check-answer-validation.ts';

const checks = ['DPC continuity', 'Drainage test', 'Photographic evidence'];
const answer = (check_number, result = 'pass', notes = null) => ({ check_number, result, notes });

test('all checklist answers are mandatory', () => {
  assert.throws(() => validateCheckAnswers(checks, [answer(1)]), /Every checklist item/);
});
test('duplicates and out-of-range numbers cannot be submitted', () => {
  assert.throws(() => validateCheckAnswers(checks, [answer(1), answer(1), answer(2)]), /duplicate/);
  assert.throws(() => validateCheckAnswers(checks, [answer(1), answer(2), answer(4)]), /Invalid/);
});
test('failed items require a meaningful defect description', () => {
  assert.throws(() => validateCheckAnswers(checks, [answer(1, 'fail', '   '), answer(2), answer(3)]), /requires/);
});
test('results are sorted and source text is snapshotted', () => {
  const results = validateCheckAnswers(checks, [answer(3, 'not_applicable'), answer(1, 'fail', '  torn membrane  '), answer(2)]);
  assert.deepEqual(results.map((item) => item.check_number), [1, 2, 3]);
  assert.equal(results[0].check_text, 'DPC continuity');
  assert.equal(results[0].notes, 'torn membrane');
  assert.equal(overallCheckResult(results), 'fail');
});
test('stage result is pass for mixed pass/NA and NA if all not applicable', () => {
  assert.equal(overallCheckResult(validateCheckAnswers(checks, [answer(1), answer(2), answer(3, 'not_applicable')])), 'pass');
  assert.equal(overallCheckResult(validateCheckAnswers(checks, [answer(1, 'not_applicable'), answer(2, 'not_applicable'), answer(3, 'not_applicable')])), 'not_applicable');
});
test('unknown results and empty checklists are rejected', () => {
  assert.throws(() => validateCheckAnswers([], []), /non-empty/);
  assert.throws(() => validateCheckAnswers(checks, [answer(1), answer(2, 'maybe'), answer(3)]), /Invalid checklist result/);
});
