import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCertificateRegister } from '../src/lib/certificate-register-summary.ts';

test('empty register returns zero counts but validates inputs', () => {
  assert.deepEqual(summarizeCertificateRegister([], '2026-11-15'), {
    total: 0, undated: 0, expired: 0, expiringSoon: 0, inDate: 0,
  });
  assert.throws(() => summarizeCertificateRegister([], '2026-02-30'));
  assert.throws(() => summarizeCertificateRegister([], '2026-11-15', -1));
});

test('counts expiry categories without treating undated as approved', () => {
  const certificates = [
    { expiresOn: null },
    { expiresOn: '2026-11-14' },
    { expiresOn: '2026-11-15' },
    { expiresOn: '2026-12-15' },
    { expiresOn: '2026-12-16' },
  ];
  assert.deepEqual(summarizeCertificateRegister(certificates, '2026-11-15'), {
    total: 5, undated: 1, expired: 1, expiringSoon: 2, inDate: 1,
  });
  assert.equal(certificates.length, 5);
});

test('invalid expiry is rejected rather than silently omitted', () => {
  assert.throws(() => summarizeCertificateRegister([{ expiresOn: '2026-02-30' }], '2026-11-15'));
});

test('custom warning windows apply consistently across year boundary', () => {
  assert.deepEqual(summarizeCertificateRegister([
    { expiresOn: '2027-01-01' }, { expiresOn: '2027-01-02' },
  ], '2026-12-31', 1), {
    total: 2, undated: 0, expired: 0, expiringSoon: 1, inDate: 1,
  });
});
