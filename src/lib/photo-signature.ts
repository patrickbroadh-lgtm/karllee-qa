/**
 * Check selected photo bytes against the MIME type before Storage upload.
 * This is a file-format sanity check, not image decoding or malware scanning.
 * The private bucket and Storage RLS remain the security boundary.
 */
export function assertPhotoSignature(bytes: ArrayBuffer, mimeType: string): void {
  const data = new Uint8Array(bytes);
  if (mimeType === 'image/jpeg') {
    // JPEG starts with SOI followed by a marker (APPn, DQT, etc.).
    if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return;
  } else if (mimeType === 'image/png') {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (data.length >= png.length && png.every((value, index) => data[index] === value)) return;
  } else if (mimeType === 'image/heic') {
    // HEIC is ISO BMFF: first box must be ftyp, with a HEIC major or
    // compatible brand. 'mif1' alone is not sufficient (AVIF also uses it).
    if (data.length >= 16) {
      const boxSize = new DataView(bytes).getUint32(0, false);
      const ascii = (start: number) => String.fromCharCode(...data.subarray(start, start + 4));
      if (boxSize >= 16 && boxSize <= data.length && boxSize % 4 === 0 && ascii(4) === 'ftyp') {
        const heicBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);
        if (heicBrands.has(ascii(8))) return;
        for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
          if (heicBrands.has(ascii(offset))) return;
        }
      }
    }
  } else {
    throw new Error('Unsupported photograph content type.');
  }
  throw new Error('Photograph content does not match its declared JPEG, PNG or HEIC format.');
}
