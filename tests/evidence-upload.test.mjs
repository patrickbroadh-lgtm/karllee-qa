import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePhotoUpload } from '../src/lib/evidence-upload.ts';

const organisationId = '12345678-1234-4234-8234-123456789abc';
const inspectionId = 'abcdefab-cdef-4def-8def-abcdefabcdef';
const fileId = '11111111-2222-4333-8444-555555555555';
const ids = { organisationId, inspectionId, fileId };

test('prepares private inspection path for JPEG camera photo', () => {
  const prepared = preparePhotoUpload({
    ...ids, asset: { uri: 'file:///cache/photo.JPG', mimeType: 'image/jpeg' }, sizeBytes: 1024,
  });
  assert.deepEqual(prepared, {
    path: `${organisationId}/${inspectionId}/${fileId}.jpg`,
    contentType: 'image/jpeg', sizeBytes: 1024,
  });
});

test('uses cache file format rather than original photo filename', () => {
  const prepared = preparePhotoUpload({
    ...ids, asset: { uri: 'file:///cache/converted.jpg', fileName: 'IMG_1001.HEIC', mimeType: 'image/jpeg' },
    sizeBytes: 25,
  });
  assert.equal(prepared.contentType, 'image/jpeg');
  assert.ok(prepared.path.endsWith('.jpg'));
});

test('accepts PNG and HEIC with matching MIME', () => {
  for (const [ext, mime] of [['png', 'image/png'], ['heic', 'image/heic']]) {
    const result = preparePhotoUpload({
      ...ids, asset: { uri: `file:///cache/photo.${ext}`, mimeType: mime }, sizeBytes: 1,
    });
    assert.ok(result.path.endsWith(`.${ext}`));
  }
});

test('rejects remote URLs, PDFs, videos and MIME mismatches', () => {
  for (const asset of [
    { uri: 'https://example.com/a.jpg', mimeType: 'image/jpeg' },
    { uri: 'file:///cache/a.pdf', mimeType: 'application/pdf' },
    { uri: 'file:///cache/a.mp4', mimeType: 'video/mp4' },
    { uri: 'file:///cache/a.jpg', mimeType: 'image/png' },
  ]) {
    assert.throws(() => preparePhotoUpload({ ...ids, asset, sizeBytes: 100 }));
  }
});

test('rejects empty and oversized photographs', () => {
  for (const sizeBytes of [0, -1, 20 * 1024 * 1024 + 1]) {
    assert.throws(() => preparePhotoUpload({
      ...ids, asset: { uri: 'file:///cache/a.jpg', mimeType: 'image/jpeg' }, sizeBytes,
    }), /20 MB/);
  }
});

test('rejects non-UUID ownership identifiers', () => {
  assert.throws(() => preparePhotoUpload({
    ...ids, organisationId: '../other',
    asset: { uri: 'file:///cache/a.jpg', mimeType: 'image/jpeg' }, sizeBytes: 10,
  }), /UUID/);
});
