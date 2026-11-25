import type { CertificateDraft } from './certificate-metadata.ts';

/**
 * Display-only expiry indicator for a certificate draft. Never implies that
 * the uploaded document is genuine, approved or legally sufficient.
 * Caller supplies the local calendar date explicitly to avoid UTC drift.
 */
export type CertificateExpiryStatus = 'undated' | 'expired' | 'expiring-soon' | 'in-date';

export function certificateExpiryStatus(
  draft: Pick<CertificateDraft, 'expiresOn'>,
  today: string,
  warningDays = 30,
): CertificateExpiryStatus {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) ||
      !Number.isInteger(warningDays) || warningDays < 0 || warningDays > 365) {
    throw new Error('Provide a YYYY-MM-DD date and a warning window of 0–365 days.');
  }
  const parse = (value: string): number => {
    const [year, month, day] = value.split('-').map(Number);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (year < 100 || date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('Invalid calendar date.');
    }
    return timestamp;
  };
  const current = parse(today);
  if (draft.expiresOn == null) return 'undated';
  const expiry = parse(draft.expiresOn);
  if (expiry < current) return 'expired';
  if ((expiry - current) / 86_400_000 <= warningDays) return 'expiring-soon';
  return 'in-date';
}
