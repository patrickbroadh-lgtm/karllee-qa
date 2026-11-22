/** Pure state machine for a future durable offline draft outbox.
 * The caller must persist each transition atomically and recheck auth/RLS on replay.
 * Never treat local "sent" as server approval or signed-off evidence.
 */
import { assertOfflineDraftOwner, validateOfflineDraftEnvelope, type OfflineDraftEnvelope } from './offline-draft-envelope.ts';
import { classifyOfflineSyncFailure, offlineRetryDelayMs } from './offline-sync-retry.ts';

export type OutboxState = 'pending' | 'sending' | 'retry-wait' | 'needs-auth' | 'conflict' | 'rejected' | 'sent';
export interface OfflineOutboxItem {
  draft: OfflineDraftEnvelope;
  state: OutboxState;
  attempts: number;
  nextAttemptAt: string | null;
}
function assertAttempts(attempts: number): void {
  if (!Number.isSafeInteger(attempts) || attempts < 0) throw new Error('Invalid attempt count');
}
function assertClock(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('Invalid clock');
}
export function newOfflineOutboxItem(value: unknown): OfflineOutboxItem {
  return { draft: validateOfflineDraftEnvelope(value), state: 'pending', attempts: 0, nextAttemptAt: null };
}
/** A single worker may claim an eligible item only after checking active account and project. */
export function claimOfflineOutboxItem(item: OfflineOutboxItem, userId: string, projectId: string, nowMs: number): OfflineOutboxItem {
  assertClock(nowMs);
  assertOfflineDraftOwner(validateOfflineDraftEnvelope(item.draft), userId, projectId);
  assertAttempts(item.attempts);
  if (item.state !== 'pending' && item.state !== 'retry-wait') throw new Error('Draft is not eligible for automatic replay');
  if (item.state === 'retry-wait') {
    const due = item.nextAttemptAt === null ? NaN : Date.parse(item.nextAttemptAt);
    if (!Number.isFinite(due) || nowMs < due) throw new Error('Retry is not due');
  }
  return { ...item, state: 'sending', nextAttemptAt: null };
}
/** A server-confirmed response is required; caller must not infer success from a network timeout. */
export function settleOfflineOutboxItem(item: OfflineOutboxItem, result: { ok: true } | { ok: false; status: number | null; networkFailure?: boolean }, nowMs: number): OfflineOutboxItem {
  assertClock(nowMs);
  assertAttempts(item.attempts);
  if (item.state !== 'sending') throw new Error('Only in-flight drafts can be settled');
  if (result.ok) return { ...item, state: 'sent', nextAttemptAt: null };
  const attempts = item.attempts + 1;
  if (!Number.isSafeInteger(attempts)) throw new Error('Retry limit exceeded');
  const disposition = classifyOfflineSyncFailure(result.status, result.networkFailure ?? false);
  if (disposition === 'retry') return { ...item, attempts, state: 'retry-wait', nextAttemptAt: new Date(nowMs + offlineRetryDelayMs(attempts - 1)).toISOString() };
  const state: OutboxState = disposition === 'reauthenticate' ? 'needs-auth' : disposition === 'resolve-conflict' ? 'conflict' : 'rejected';
  return { ...item, attempts, state, nextAttemptAt: null };
}
