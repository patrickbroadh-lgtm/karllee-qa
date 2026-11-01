import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPdfHeader, prepareCertificateUpload } from '../src/lib/certificate-upload.ts';

const ids = {
  organisationId: '12345678-1234-4234-8234-123456789abc',
  inspectionId: 'abcdefab-cdef-4def-8def-abcdefabcdef',
  fileId: '11111111-2222-4333-8444-555555555555',
};

const pdf = { uri: 'file:///cache/Certificate.pdf', name: 'Electrical Installation Certificate.PDF', mimeType: 'application/pdf' };

test('prepares an inspection-scoped private PDF attachment', () => {
  assert.deepEqual(prepareCertificateUpload({ ...ids, asset: pdf, sizeBytes: 4096 }), {
    path: `${ids.organisationId}/${ids.inspectionId}/${ids.fileId}.pdf`,
    contentType: 'application/pdf', sizeBytes: 4096,
  });
});

test('accepts missing picker MIME when the document is named PDF', () => {
  const result = prepareCertificateUpload({
    ...ids, asset: { uri: pdf.uri, name: 'handover.pdf', mimeType: null }, sizeBytes: 50,
  });
  assert.equal(result.contentType, 'application/pdf');
});

test('rejects remote files, disguised names, mismatched MIME and oversized files', () => {
  for (const [asset, sizeBytes] of [
    [{ ...pdf, uri: 'https://example.com/file.pdf' }, 100],
    [{ ...pdf, name: 'report.pdf.exe' }, 100],
    [{ ...pdf, mimeType: 'image/png' }, 100],
    [pdf, 0],
    [pdf, 20 * 1024 * 1024 + 1],
  ]) {
    assert.throws(() => prepareCertificateUpload({ ...ids, asset, sizeBytes }));
  }
});

test('rejects forged organisation and inspection identifiers', () => {
  assert.throws(() => prepareCertificateUpload({
    ...ids, inspectionId: '../another-inspection', asset: pdf, sizeBytes: 100,
  }), /UUID/);
});

test('checks actual PDF magic bytes before upload', () => {
  const valid = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer;
  assert.doesNotThrow(() => assertPdfHeader(valid));
  for (const bad of [
    new Uint8Array(0).buffer,
    Uint8Array.from([0x25, 0x50, 0x44]).buffer,
    new TextEncoder().encode('not a pdf').buffer,
  ]) {
    assert.throws(() => assertPdfHeader(bad), /PDF header/);
  }
});
