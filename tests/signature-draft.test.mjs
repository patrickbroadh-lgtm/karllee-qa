import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSignatureDraft } from '../src/lib/signature-draft.ts';

const valid = () => ({ width: 300, height: 100, strokes: [[{ x: 1, y: 2, t: 0 }, { x: 3, y: 4, t: 10 }]] });

test('accepts bounded, ordered offline draft without approving anything', () => {
  assert.deepEqual(validateSignatureDraft(valid()), valid());
});
test('rejects empty, malformed and oversized canvases', () => {
  for (const value of [null, [], {}, { ...valid(), width: 0 }, { ...valid(), height: 8193 }, { ...valid(), width: Infinity }])
    assert.throws(() => validateSignatureDraft(value));
});
test('rejects out-of-bounds, nonfinite and time-reversed points', () => {
  for (const point of [{ x: -1, y: 2, t: 10 }, { x: 301, y: 2, t: 10 }, { x: NaN, y: 2, t: 10 }, { x: 2, y: 2, t: -1 }]) {
    const draft = valid();
    draft.strokes[0][1] = point;
    assert.throws(() => validateSignatureDraft(draft));
  }
  const reversed = valid();
  reversed.strokes[0][1].t = -2;
  assert.throws(() => validateSignatureDraft(reversed));
});
test('rejects unbounded stroke and point counts', () => {
  assert.throws(() => validateSignatureDraft({ ...valid(), strokes: Array.from({ length: 129 }, () => valid().strokes[0]) }));
  assert.throws(() => validateSignatureDraft({ ...valid(), strokes: [Array.from({ length: 12001 }, (_, t) => ({ x: 1, y: 1, t }))] }));
});
