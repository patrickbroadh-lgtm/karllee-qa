/** Validation boundary for provisional, user-scoped offline drafts.
 * This is not a persistent queue. Recheck auth, project access and RLS on replay.
 */
export type OfflineDraftKind = 'inspection-note' | 'checklist-draft' | 'photo-evidence' | 'pdf-evidence';
export interface OfflineDraftEnvelope {
  id: string;
  userId: string;
  projectId: string;
  kind: OfflineDraftKind;
  createdAt: string;
  payloadRef: string;
}
const KINDS: readonly string[] = ['inspection-note', 'checklist-draft', 'photo-evidence', 'pdf-evidence'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateOfflineDraftEnvelope(value: unknown): OfflineDraftEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid offline draft');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== ['createdAt','id','kind','payloadRef','projectId','userId'].sort().join(',')) throw new Error('Unexpected offline draft fields');
  for (const key of ['id','userId','projectId'] as const) {
    if (typeof record[key] !== 'string' || !UUID.test(record[key])) throw new Error('Invalid offline draft identifier');
  }
  if (typeof record.kind !== 'string' || !KINDS.includes(record.kind)) throw new Error('Offline operation cannot be queued');
  if (typeof record.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(record.createdAt) || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid draft timestamp');
  if (typeof record.payloadRef !== 'string' || record.payloadRef.length < 1 || record.payloadRef.length > 256 || !/^[a-zA-Z0-9_./-]+$/.test(record.payloadRef) || record.payloadRef.startsWith('/') || record.payloadRef.split('/').includes('..')) throw new Error('Invalid local payload reference');
  return record as unknown as OfflineDraftEnvelope;
}
/** Prevent one signed-in account from replaying another account's queued drafts. */
export function assertOfflineDraftOwner(draft: OfflineDraftEnvelope, activeUserId: string, activeProjectId: string): void {
  if (draft.userId !== activeUserId || draft.projectId !== activeProjectId) throw new Error('Offline draft scope mismatch');
}
