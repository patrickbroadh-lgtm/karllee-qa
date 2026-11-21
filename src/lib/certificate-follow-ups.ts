import { certificateExpiryStatus } from './certificate-expiry.ts';
import type { CertificateDraft } from './certificate-metadata.ts';

/**
 * Local, read-only triage for certificate follow-up. A valid expiry date does
 * not establish authenticity, approval or regulatory compliance.
 * No network calls, persistence, permissions or approval transitions.
 */
export type CertificateFollowUp = {
  index: number;
  title: string;
  status: 'expired' | 'expiring-soon' | 'undated';
  daysUntilExpiry: number | null;
};

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function certificateFollowUps(
  certificates: readonly Pick<CertificateDraft, 'title' | 'expiresOn'>[],
  today: string,
  warningDays = 30,
): CertificateFollowUp[] {
  // Validate even for an empty register, preventing silent invalid inputs.
  certificateExpiryStatus({ expiresOn: null }, today, warningDays);
  const followUps: CertificateFollowUp[] = [];
  certificates.forEach((certificate, index) => {
    const status = certificateExpiryStatus(certificate, today, warningDays);
    if (status === 'in-date') return;
    followUps.push({
      index,
      title: certificate.title,
      status,
      daysUntilExpiry: certificate.expiresOn === null
        ? null
        : dayNumber(certificate.expiresOn) - dayNumber(today),
    });
  });
  const priority = { expired: 0, 'expiring-soon': 1, undated: 2 };
  return followUps.sort((a, b) =>
    priority[a.status] - priority[b.status] ||
    (a.daysUntilExpiry ?? Infinity) - (b.daysUntilExpiry ?? Infinity) ||
    a.index - b.index
  );
}
