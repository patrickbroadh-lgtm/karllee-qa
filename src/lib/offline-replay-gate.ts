/** Conservative decision gate for replaying provisional offline drafts.
 * Never interpret this as permission to write: the server must recheck Auth and RLS.
 */
export type ReplayDecision = 'retry-later' | 'reauthenticate' | 'manual-review' | 'discard-local' | 'ready-for-server-validation';
export interface ReplayContext {
  online: boolean;
  authenticatedUserId: string | null;
  draftUserId: string;
  selectedProjectId: string;
  draftProjectId: string;
  localDeleted: boolean;
  serverRevisionAtCapture: string | null;
  currentServerRevision: string | null;
}
export function decideOfflineReplay(context: ReplayContext): ReplayDecision {
  if (context.localDeleted) return 'discard-local';
  if (!context.authenticatedUserId) return 'reauthenticate';
  if (context.authenticatedUserId !== context.draftUserId ||
      context.selectedProjectId !== context.draftProjectId) return 'manual-review';
  if (!context.online) return 'retry-later';
  // A draft made without a known server revision must not overwrite an existing record.
  if (context.serverRevisionAtCapture !== context.currentServerRevision) return 'manual-review';
  return 'ready-for-server-validation';
}
