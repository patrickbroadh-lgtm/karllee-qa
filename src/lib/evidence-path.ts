/**
 * Client-side evidence file naming and input validation.
 * IMPORTANT: This is not an authorisation boundary. Storage RLS must validate
 * organisation membership, inspection ownership, MIME type and object path.
 */
export const EVIDENCE_MAX_BYTES = 20 * 1024 * 1024;
export const EVIDENCE_MIME_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  pdf: 'application/pdf',
} as const;
export type EvidenceExtension = keyof typeof EVIDENCE_MIME_BY_EXTENSION;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function evidenceStoragePath(input: {
  organisationId: string;
  inspectionId: string;
  fileId: string;
  extension: EvidenceExtension;
}): string {
  const { organisationId, inspectionId, fileId, extension } = input;
  if (![organisationId, inspectionId, fileId].every((value) => UUID_PATTERN.test(value))) {
    throw new Error('Evidence identifiers must be UUIDs.');
  }
  if (!Object.prototype.hasOwnProperty.call(EVIDENCE_MIME_BY_EXTENSION, extension)) {
    throw new Error('Unsupported evidence file extension.');
  }
  return `${organisationId.toLowerCase()}/${inspectionId.toLowerCase()}/${fileId.toLowerCase()}.${extension}`;
}

export function validateEvidenceFile(input: {
  extension: string;
  mimeType: string;
  sizeBytes: number;
}): EvidenceExtension {
  const extension = input.extension.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(EVIDENCE_MIME_BY_EXTENSION, extension)) {
    throw new Error('Only JPEG, PNG, HEIC and PDF evidence is supported.');
  }
  const allowed = EVIDENCE_MIME_BY_EXTENSION[extension as EvidenceExtension];
  if (input.mimeType.toLowerCase() !== allowed) {
    throw new Error('Evidence MIME type does not match its extension.');
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > EVIDENCE_MAX_BYTES) {
    throw new Error('Evidence must be between 1 byte and 20 MB.');
  }
  return extension as EvidenceExtension;
}
