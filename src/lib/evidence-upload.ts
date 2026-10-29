import {
  EVIDENCE_MIME_BY_EXTENSION,
  evidenceStoragePath,
  validateEvidenceFile,
} from './evidence-path';

/**
 * Metadata validation before any bytes are sent to private Storage.
 * This is a usability check, not a substitute for server-side Storage RLS.
 */
export type PickedPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export function preparePhotoUpload(input: {
  asset: PickedPhoto;
  sizeBytes: number;
  organisationId: string;
  inspectionId: string;
  fileId: string;
}): { path: string; contentType: string; sizeBytes: number } {
  const { asset, sizeBytes, organisationId, inspectionId, fileId } = input;
  if (!asset.uri.startsWith('file://')) {
    throw new Error('The selected photograph must be a local file.');
  }
  // The picker can transcode HEIC originals into a JPEG cache file. The
  // actual cache file extension takes precedence over the original filename.
  const cacheName = asset.uri.split('?')[0];
  const extension = /\.([a-z0-9]+)$/i.exec(cacheName)?.[1]?.toLowerCase()
    ?? /\.([a-z0-9]+)$/i.exec(asset.fileName ?? '')?.[1]?.toLowerCase();
  if (!extension || extension === 'pdf') {
    throw new Error('Select a JPEG, PNG or HEIC photograph.');
  }
  const expectedMime = EVIDENCE_MIME_BY_EXTENSION[extension as keyof typeof EVIDENCE_MIME_BY_EXTENSION];
  const contentType = asset.mimeType?.toLowerCase() ?? expectedMime ?? '';
  const validatedExtension = validateEvidenceFile({ extension, mimeType: contentType, sizeBytes });
  if (validatedExtension === 'pdf') {
    throw new Error('Select a photograph, not a PDF.');
  }
  return {
    path: evidenceStoragePath({ organisationId, inspectionId, fileId, extension: validatedExtension }),
    contentType,
    sizeBytes,
  };
}
