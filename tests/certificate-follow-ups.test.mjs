import assert from 'node:assert/strict';
import test from 'node:test';
import { certificateFollowUps } from '../src/lib/certificate-follow-ups.ts';

test('prioritises expired then expiring soon then undated, excluding in-date', () => {
  const records = [
    { title: 'Undated', expiresOn: null },
    { title: 'Soon', expiresOn: '2026-11-20' },
    { title: 'Current', expiresOn: '2027-02-01' },
    { title: 'Old', expiresOn: '2026-10-01' },
    { title: 'Yesterday', expiresOn: '2026-11-16' },
  ];
  assert.deepEqual(certificateFollowUps(records, '2026-11-17').map(x => x.title),
    ['Old', 'Yesterday', 'Soon', 'Undated']);
  assert.equal(certificateFollowUps(records, '2026-11-17')[0].daysUntilExpiry, -47);
  assert.equal(certificateFollowUps(records, '2026-11-17')[3].daysUntilExpiry, null);
  assert.equal(records.length, 5);
});

test('expiry today is a follow-up, not expired', () => {
  assert.deepEqual(certificateFollowUps([{ title: 'Today', expiresOn: '2026-11-17' }], '2026-11-17', 0),
    [{ index: 0, title: 'Today', status: 'expiring-soon', daysUntilExpiry: 0 }]);
});

test('stable original indices break ties without mutating input', () => {
  const records = Object.freeze([
    Object.freeze({ title: 'A', expiresOn: null }),
    Object.freeze({ title: 'B', expiresOn: null }),
  ]);
  assert.deepEqual(certificateFollowUps(records, '2026-11-17').map(x => x.index), [0, 1]);
});

test('validates dates and warning windows even for empty inputs', () => {
  assert.throws(() => certificateFollowUps([], '2026-02-30'));
  assert.throws(() => certificateFollowUps([], '2026-11-17', 366));
  assert.throws(() => certificateFollowUps([{ title: 'Bad', expiresOn: '2026-02-30' }], '2026-11-17'));
});

test('handles leap year and year boundary by calendar day', () => {
  assert.equal(certificateFollowUps([{ title: 'Leap', expiresOn: '2028-02-29' }], '2028-02-28')[0].daysUntilExpiry, 1);
  assert.equal(certificateFollowUps([{ title: 'Year', expiresOn: '2027-01-01' }], '2026-12-31')[0].daysUntilExpiry, 1);
});
