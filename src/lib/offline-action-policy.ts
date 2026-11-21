/** Pure offline operation eligibility policy. No persistence or network effects.
 * Approval/sign-off and access-control decisions must always be revalidated
 * online by the server; an offline client must never grant them locally.
 */
export type QaOfflineAction =
  | 'save-checklist-draft'
  | 'save-inspection-notes'
  | 'queue-photo-evidence'
  | 'queue-pdf-evidence'
  | 'submit-checklist'
  | 'approve-inspection'
  | 'sign-off-inspection'
  | 'change-user-role'
  | 'delete-evidence';

export type OfflineDecision =
  | { allowed: true; requiresServerRevalidation: true }
  | { allowed: false; reason: 'online-required' };

const QUEUEABLE_DRAFTS: ReadonlySet<QaOfflineAction> = new Set([
  'save-checklist-draft',
  'save-inspection-notes',
  'queue-photo-evidence',
  'queue-pdf-evidence',
]);

/** Queuing is provisional: server-side RLS, validation and upload policies still apply. */
export function offlineActionDecision(action: QaOfflineAction): OfflineDecision {
  return QUEUEABLE_DRAFTS.has(action)
    ? { allowed: true, requiresServerRevalidation: true }
    : { allowed: false, reason: 'online-required' };
}
