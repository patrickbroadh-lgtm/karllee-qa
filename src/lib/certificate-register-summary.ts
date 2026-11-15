import { certificateExpiryStatus, type CertificateExpiryStatus } from './certificate-expiry.ts';
import type { CertificateDraft } from './certificate-metadata.ts';

/**
 * A local, display-only register summary. No approval or compliance inference.
 * Inputs must already be validated certificate drafts; no persistence or RLS bypass.
 * The caller supplies today's local calendar date to avoid device/UTC drift.
 */
export type CertificateRegisterSummary = {
  total: number;
  undated: number;
  expired: number;
  expiringSoon: number;
  inDate: number;
};

export function summarizeCertificateRegister(
  certificates: readonly Pick<CertificateDraft, 'expiresOn'>[],
  today: string,
  warningDays = 30,
): CertificateRegisterSummary {
  const summary: CertificateRegisterSummary = {
    total: 0, undated: 0, expired: 0, expiringSoon: 0, inDate: 0,
  };
  // Validate the calendar date and warning window even for an empty register.
  certificateExpiryStatus({ expiresOn: null }, today, warningDays);
  for (const certificate of certificates) {
    const status: CertificateExpiryStatus = certificateExpiryStatus(certificate, today, warningDays);
    summary.total++;
    switch (status) {
      case 'undated': summary.undated++; break;
      case 'expired': summary.expired++; break;
      case 'expiring-soon': summary.expiringSoon++; break;
      case 'in-date': summary.inDate++; break;
    }
  }
  return summary;
}
