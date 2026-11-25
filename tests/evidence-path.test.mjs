import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceStoragePath, validateEvidenceFile, EVIDENCE_MAX_BYTES } from '../src/lib/evidence-path.ts';

const id = '12345678-1234-4234-8234-123456789abc';
const id2 = 'abcdefab-cdef-4def-8def-abcdefabcdef';

test('evidence path is scoped to organisation and inspection UUIDs', () => {
  assert.equal(evidenceStoragePath({ organisationId: id, inspectionId: id2, fileId: id, extension: 'jpg' }),
    `${id}/${id2}/${id}.jpg`);
});
test('rejects slashes, traversal and non-UUID identifiers', () => {
  assert.throws(() => evidenceStoragePath({ organisationId: '../other', inspectionId: id2, fileId: id, extension: 'jpg' }), /UUIDs/);
  assert.throws(() => evidenceStoragePath({ organisationId: id, inspectionId: 'a/b', fileId: id, extension: 'jpg' }), /UUIDs/);
});
test('rejects unsupported file types and mismatched MIME', () => {
  assert.throws(() => validateEvidenceFile({ extension: 'exe', mimeType: 'application/octet-stream', sizeBytes: 12 }), /Only JPEG/);
  assert.throws(() => validateEvidenceFile({ extension: 'jpg', mimeType: 'application/pdf', sizeBytes: 12 }), /MIME/);
});
test('allows supported photo and PDF files with bounded size', () => {
  assert.equal(validateEvidenceFile({ extension: 'HEIC', mimeType: 'image/heic', sizeBytes: 1 }), 'heic');
  assert.equal(validateEvidenceFile({ extension: 'pdf', mimeType: 'application/pdf', sizeBytes: EVIDENCE_MAX_BYTES }), 'pdf');
});
test('rejects zero, negative, non-integer, and oversized files', () => {
  for (const sizeBytes of [0, -1, 1.5, EVIDENCE_MAX_BYTES + 1, Number.NaN]) {
    assert.throws(() => validateEvidenceFile({ extension: 'png', mimeType: 'image/png', sizeBytes }), /20 MB/);
  }
});
