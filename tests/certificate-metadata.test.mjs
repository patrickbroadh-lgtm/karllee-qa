import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFICATE_TYPES, validateCertificateDraft } from '../src/lib/certificate-metadata.ts';

const base = { type: 'electrical-installation', title: 'Electrical installation certificate' };

test('recognised classification remains a controlled list', () => {
  assert.ok(CERTIFICATE_TYPES.includes('ventilation-commissioning'));
  assert.ok(CERTIFICATE_TYPES.includes('building-control'));
  assert.ok(!CERTIFICATE_TYPES.includes('approved'));
});

test('normalises optional metadata without implying certificate approval', () => {
  assert.deepEqual(validateCertificateDraft({ ...base, title: '  Electrical certificate  ', reference: '  EIC-42 ', issuedOn: '2026-11-03', expiresOn: '2027-11-03' }), {
    type: 'electrical-installation', title: 'Electrical certificate',
    reference: 'EIC-42', issuedOn: '2026-11-03', expiresOn: '2027-11-03', notes: null,
  });
});

test('rejects unknown categories, empty titles and oversized fields', () => {
  for (const value of [
    { ...base, type: 'approved' }, { ...base, title: '   ' },
    { ...base, title: 'a'.repeat(121) }, { ...base, reference: 'r'.repeat(101) },
    { ...base, notes: 'n'.repeat(1001) }, { ...base, title: 'bad\nname' },
  ]) assert.throws(() => validateCertificateDraft(value));
});

test('rejects impossible dates and backwards expiry', () => {
  for (const value of [
    { ...base, issuedOn: '2026-02-29' }, { ...base, issuedOn: '2026-13-01' },
    { ...base, issuedOn: '03/11/2026' }, { ...base, issuedOn: '2026-11-03', expiresOn: '2026-11-02' },
  ]) assert.throws(() => validateCertificateDraft(value));
});

test('accepts leap day and undated certificates', () => {
  assert.equal(validateCertificateDraft({ ...base, issuedOn: '2024-02-29' }).issuedOn, '2024-02-29');
  assert.equal(validateCertificateDraft(base).issuedOn, null);
});

test('rejects control characters even at field boundaries or in optional whitespace', () => {
  for (const value of [
    { ...base, title: '\nCertificate' },
    { ...base, title: 'Certificate\t' },
    { ...base, reference: '\n' },
    { ...base, notes: 'Valid notes\r\n' },
    { ...base, reference: 'Ref\u007f' },
  ]) assert.throws(() => validateCertificateDraft(value), /control characters/);
});


test('rejects invisible Unicode and bidirectional spoofing in audit-facing metadata', () => {
  for (const value of [
    { ...base, title: 'Certificate\u202ePDF' },
    { ...base, reference: 'EIC-\u200b42' },
    { ...base, notes: 'Issued\u2066approved\u2069' },
    { ...base, title: '\ufeffCertificate' },
    { ...base, reference: 'REF\u200e42' },
  ]) assert.throws(() => validateCertificateDraft(value), /control characters/);
});

test('rejects other Unicode format controls that disguise certificate metadata', () => {
  for (const value of [
    { ...base, title: 'Cert\u00adificate' },
    { ...base, reference: 'REF\u061c42' },
  ]) assert.throws(() => validateCertificateDraft(value), /control characters/);
});
