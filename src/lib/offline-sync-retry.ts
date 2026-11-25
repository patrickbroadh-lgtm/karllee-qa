/** Deterministic, conservative retry classification for provisional offline drafts.
 * Never automatically retry auth failures, conflicts, or validation failures.
 * This helper does not persist data or bypass server-side authorisation.
 */
export type OfflineSyncDisposition = 'retry' | 'reauthenticate' | 'resolve-conflict' | 'reject';
export function classifyOfflineSyncFailure(status: number | null, networkFailure = false): OfflineSyncDisposition {
  if (networkFailure || status === null || status === 408 || status === 429 || (status >= 500 && status <= 599)) return 'retry';
  if (status === 401 || status === 403) return 'reauthenticate';
  if (status === 409 || status === 412) return 'resolve-conflict';
  return 'reject';
}
/** Bounded exponential backoff, deterministic so callers can persist next-attempt time. */
export function offlineRetryDelayMs(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 0) throw new RangeError('attempt must be a nonnegative safe integer');
  return Math.min(300_000, 1000 * 2 ** Math.min(attempt, 9));
}
