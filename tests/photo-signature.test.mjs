import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPhotoSignature } from '../src/lib/photo-signature.ts';

const asBuffer = (values) => Uint8Array.from(values).buffer;
const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function heicBox(major, compatible = []) {
  const size = 16 + 4 * compatible.length;
  const data = new Uint8Array(size);
  new DataView(data.buffer).setUint32(0, size, false);
  const write = (offset, value) => {
    for (let i = 0; i < 4; i++) data[offset + i] = value.charCodeAt(i);
  };
  write(4, 'ftyp');
  write(8, major);
  for (let i = 0; i < compatible.length; i++) write(16 + i * 4, compatible[i]);
  return data.buffer;
}

test('accepts JPEG signature, including APP and DQT markers', () => {
  for (const marker of [0xe0, 0xdb]) {
    assert.doesNotThrow(() => assertPhotoSignature(asBuffer([0xff, 0xd8, 0xff, marker]), 'image/jpeg'));
  }
});

test('accepts exact PNG signature', () => {
  assert.doesNotThrow(() => assertPhotoSignature(asBuffer([...pngHeader, 0, 0, 0, 13]), 'image/png'));
});

test('accepts HEIC major or compatible brand, including mif1 containers', () => {
  assert.doesNotThrow(() => assertPhotoSignature(heicBox('heic'), 'image/heic'));
  assert.doesNotThrow(() => assertPhotoSignature(heicBox('mif1', ['heix']), 'image/heic'));
});

test('rejects renamed images and cross-format MIME declarations', () => {
  assert.throws(() => assertPhotoSignature(asBuffer([...pngHeader]), 'image/jpeg'), /does not match/);
  assert.throws(() => assertPhotoSignature(asBuffer([0xff, 0xd8, 0xff, 0xe0]), 'image/png'), /does not match/);
  assert.throws(() => assertPhotoSignature(asBuffer([...pngHeader]), 'image/heic'), /does not match/);
});

test('rejects empty, truncated and unsupported images', () => {
  for (const bytes of [asBuffer([]), asBuffer([0xff, 0xd8]), asBuffer([0x89, 0x50])]) {
    assert.throws(() => assertPhotoSignature(bytes, 'image/jpeg'));
  }
  assert.throws(() => assertPhotoSignature(asBuffer([...pngHeader]), 'application/pdf'), /Unsupported/);
});

test('rejects AVIF-only brands and invalid HEIC box sizes', () => {
  assert.throws(() => assertPhotoSignature(heicBox('avif', ['mif1']), 'image/heic'), /does not match/);
  const truncated = heicBox('heic');
  new DataView(truncated).setUint32(0, 32, false);
  assert.throws(() => assertPhotoSignature(truncated, 'image/heic'), /does not match/);
});
