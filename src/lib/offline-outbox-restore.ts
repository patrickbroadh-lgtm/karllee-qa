/** Validate records loaded from durable storage before they can enter replay logic.
 * In-flight writes are ambiguous after a crash: do not automatically resend them.
 * A real queue must use atomic writes, server idempotency and RLS before enabling replay.
 */
import { validateOfflineDraftEnvelope } from './offline-draft-envelope.ts';
import type { OfflineOutboxItem, OutboxState } from './offline-outbox-state.ts';

const STATES: readonly OutboxState[] = ['pending','sending','retry-wait','needs-auth','conflict','rejected','sent'];
const FIELDS = ['attempts','draft','nextAttemptAt','state'].sort().join(',');
const ISO = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/;

export function restoreOfflineOutboxItem(value: unknown): OfflineOutboxItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved outbox record');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join(',') !== FIELDS) throw new Error('Unexpected saved outbox fields');
  const draft = validateOfflineDraftEnvelope(item.draft);
  if (typeof item.state !== 'string' || !STATES.includes(item.state as OutboxState)) throw new Error('Invalid saved outbox state');
  if (typeof item.attempts !== 'number' || !Number.isSafeInteger(item.attempts) || item.attempts < 0) throw new Error('Invalid saved attempt count');
  const state = item.state as OutboxState;
  if (state === 'retry-wait') {
    if (typeof item.nextAttemptAt !== 'string' || !ISO.test(item.nextAttemptAt) || !Number.isFinite(Date.parse(item.nextAttemptAt)) || new Date(item.nextAttemptAt).toISOString() !== item.nextAttemptAt) throw new Error('Invalid saved retry deadline');
    if (item.attempts === 0) throw new Error('Retry requires prior attempt');
  } else if (item.nextAttemptAt !== null) {
    throw new Error('Unexpected saved retry deadline');
  }
  if (state === 'pending' && item.attempts !== 0) throw new Error('Invalid pending attempt count');
  // Sending may have reached the server before the app crashed. Require reconciliation,
  // not a blind retry that could duplicate evidence or inspection writes.
  return { draft, state: state === 'sending' ? 'conflict' : state, attempts: item.attempts, nextAttemptAt: item.nextAttemptAt as string | null };
}
