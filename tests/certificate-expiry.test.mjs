import assert from 'node:assert/strict';
import test from 'node:test';
import { certificateExpiryStatus } from '../src/lib/certificate-expiry.ts';

const status = (expiresOn, today = '2026-11-14', days = 30) =>
  certificateExpiryStatus({ expiresOn }, today, days);

test('undated certificates are not assumed valid', () => {
  assert.equal(status(null), 'undated');
});
test('expiry date is inclusive and warning threshold is inclusive', () => {
  assert.equal(status('2026-11-13'), 'expired');
  assert.equal(status('2026-11-14'), 'expiring-soon');
  assert.equal(status('2026-12-14'), 'expiring-soon');
  assert.equal(status('2026-12-15'), 'in-date');
});
test('leap days and year transitions use calendar days', () => {
  assert.equal(status('2024-03-01', '2024-02-29', 1), 'expiring-soon');
  assert.equal(status('2027-01-01', '2026-12-31', 0), 'in-date');
});
test('rejects malformed and impossible dates or warning windows', () => {
  for (const [expiry, today, days] of [
    ['2026-02-30', '2026-11-14', 30],
    ['2026-12-01', '2026-13-01', 30],
    ['2026-12-01', '2026-11-14', -1],
    ['2026-12-01', '2026-11-14', 1.5],
    ['2026-12-01', '2026-11-14', 366],
  ]) assert.throws(() => status(expiry, today, days));
});
