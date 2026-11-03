/** Draft-only certificate metadata. This is NOT evidence of regulatory approval.
 * Keep classification local until an audited, RLS-protected metadata table exists.
 * Never infer certificate validity from a PDF filename or upload success.
 */
export const CERTIFICATE_TYPES = [
  'electrical-installation', 'electrical-minor-works', 'gas-safety',
  'air-tightness', 'sap-epc', 'ventilation-commissioning',
  'heat-pump-commissioning', 'fire-safety', 'building-control',
  'warranty', 'other',
] as const;

export type CertificateType = typeof CERTIFICATE_TYPES[number];
export type CertificateDraft = {
  type: CertificateType;
  title: string;
  reference: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
};

function optionalText(value: unknown, label: string, max: number): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max || /[\u0000-\u001f\u007f]/.test(trimmed))
    throw new Error(`${label} contains invalid characters or exceeds ${max} characters.`);
  return trimmed;
}

function date(value: unknown, label: string): string | null {
  const text = optionalText(value, label, 10);
  if (text == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    throw new Error(`${label} is not a valid calendar date.`);
  return text;
}

/** Validation for an eventual certificate metadata form, not an upload approval. */
export function validateCertificateDraft(input: {
  type: unknown; title: unknown; reference?: unknown; issuedOn?: unknown;
  expiresOn?: unknown; notes?: unknown;
}): CertificateDraft {
  if (typeof input.type !== 'string' || !CERTIFICATE_TYPES.some(type => type === input.type))
    throw new Error('Choose a recognised certificate category.');
  const title = optionalText(input.title, 'Certificate title', 120);
  if (!title) throw new Error('Certificate title is required.');
  const issuedOn = date(input.issuedOn, 'Issue date');
  const expiresOn = date(input.expiresOn, 'Expiry date');
  if (issuedOn && expiresOn && expiresOn < issuedOn)
    throw new Error('Expiry date cannot precede issue date.');
  return {
    type: input.type as CertificateType, title,
    reference: optionalText(input.reference, 'Certificate reference', 100),
    issuedOn, expiresOn, notes: optionalText(input.notes, 'Notes', 1000),
  };
}
