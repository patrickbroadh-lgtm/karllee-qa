/** Local-only review workflow design. No certificate is approved by upload or classification.
 * Persist transitions only after an audited, organisation-scoped server RPC exists.
 */
export const CERTIFICATE_REVIEW_STATES = ['draft', 'submitted', 'changes-requested', 'verified', 'rejected'] as const;
export type CertificateReviewState = typeof CERTIFICATE_REVIEW_STATES[number];
export type CertificateReviewRole = 'inspector' | 'site_manager' | 'admin' | 'director' | 'viewer';
export type CertificateReviewAction = 'submit' | 'request-changes' | 'verify' | 'reject' | 'resubmit';
export type CertificateReviewDecision = {
  nextState: CertificateReviewState;
  requiresReason: boolean;
};

const transitions: Record<CertificateReviewAction, { from: readonly CertificateReviewState[]; to: CertificateReviewState; roles: readonly CertificateReviewRole[]; reason: boolean }> = {
  submit: { from: ['draft'], to: 'submitted', roles: ['inspector', 'site_manager', 'admin', 'director'], reason: false },
  'request-changes': { from: ['submitted'], to: 'changes-requested', roles: ['site_manager', 'admin', 'director'], reason: true },
  verify: { from: ['submitted'], to: 'verified', roles: ['site_manager', 'admin', 'director'], reason: false },
  reject: { from: ['submitted'], to: 'rejected', roles: ['site_manager', 'admin', 'director'], reason: true },
  resubmit: { from: ['changes-requested'], to: 'submitted', roles: ['inspector', 'site_manager', 'admin', 'director'], reason: false },
};

/** Pure UI/planning guard, not a substitute for server-side RLS and audited RPC. */
export function planCertificateReviewTransition(input: {
  state: CertificateReviewState;
  action: CertificateReviewAction;
  role: CertificateReviewRole;
  activeMember: boolean;
  actorId: string;
  submitterId: string;
  reason?: string | null;
}): CertificateReviewDecision {
  const { state, action, role, activeMember, actorId, submitterId, reason } = input;
  const rule = Object.prototype.hasOwnProperty.call(transitions, action) ? transitions[action] : undefined;
  if (!rule || !rule.from.includes(state) || !rule.roles.includes(role) || !activeMember)
    throw new Error('Certificate review transition not permitted.');
  if (typeof actorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)
    || typeof submitterId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submitterId))
    throw new Error('Valid actor and submitter identifiers are required.');
  // Only the original submitter may submit or resubmit their certificate.
  if (['submit', 'resubmit'].includes(action) && actorId.toLowerCase() !== submitterId.toLowerCase())
    throw new Error('Only the certificate submitter may submit or resubmit.');
  // Four-eyes principle: no one may approve or reject their own submission.
  if (['verify', 'reject', 'request-changes'].includes(action) && actorId.toLowerCase() === submitterId.toLowerCase())
    throw new Error('A separate reviewer is required.');
  if (rule.reason && (typeof reason !== 'string' || !reason.trim() || reason.length > 1000 || /[\p{Cc}\p{Cf}]/u.test(reason)))
    throw new Error('A valid review reason is required.');
  return { nextState: rule.to, requiresReason: rule.reason };
}
