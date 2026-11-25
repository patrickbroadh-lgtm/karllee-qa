import { evidenceStoragePath, validateEvidenceFile } from './evidence-path.ts';

/**
 * Preflight for a PDF selected from the native document picker.
 * Server-side private Storage bucket limits and RLS remain authoritative.
 * The file is an attachment, not a verified statutory certificate.
 */
export type PickedCertificate = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export function prepareCertificateUpload(input: {
  asset: PickedCertificate;
  sizeBytes: number;
  organisationId: string;
  inspectionId: string;
  fileId: string;
}): { path: string; contentType: 'application/pdf'; sizeBytes: number } {
  const { asset, sizeBytes, organisationId, inspectionId, fileId } = input;
  if (!asset.uri.startsWith('file://')) {
    throw new Error('The selected certificate must be copied to a local file.');
  }
  if (!/\.pdf$/i.test(asset.name)) {
    throw new Error('Choose a PDF document. Other file types are not supported.');
  }
  const contentType = asset.mimeType?.toLowerCase() ?? 'application/pdf';
  validateEvidenceFile({ extension: 'pdf', mimeType: contentType, sizeBytes });
  return {
    path: evidenceStoragePath({ organisationId, inspectionId, fileId, extension: 'pdf' }),
    contentType: 'application/pdf',
    sizeBytes,
  };
}

/** Reject renamed non-PDF files before uploading. This is not malware scanning. */
export function assertPdfHeader(bytes: ArrayBuffer): void {
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 5));
  if (header.length !== 5 || header[0] !== 0x25 || header[1] !== 0x50 ||
      header[2] !== 0x44 || header[3] !== 0x46 || header[4] !== 0x2d) {
    throw new Error('This file does not have a valid PDF header.');
  }
}
