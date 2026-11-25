import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOfflineSyncFailure, offlineRetryDelayMs } from '../src/lib/offline-sync-retry.ts';

test('temporary failures are retryable', () => {
  for (const status of [null, 408, 429, 500, 502, 503, 599]) {
    assert.equal(classifyOfflineSyncFailure(status), 'retry');
  }
  assert.equal(classifyOfflineSyncFailure(400, true), 'retry');
});
test('authentication and permission failures require renewed server authorisation', () => {
  for (const status of [401, 403]) assert.equal(classifyOfflineSyncFailure(status), 'reauthenticate');
});
test('conflicts are never silently overwritten', () => {
  for (const status of [409, 412]) assert.equal(classifyOfflineSyncFailure(status), 'resolve-conflict');
});
test('invalid submissions are rejected rather than retried', () => {
  for (const status of [400, 404, 413, 415, 422]) assert.equal(classifyOfflineSyncFailure(status), 'reject');
});
test('backoff is exponential and capped at five minutes', () => {
  assert.deepEqual([0, 1, 2, 3, 9, 100].map(offlineRetryDelayMs), [1000, 2000, 4000, 8000, 300000, 300000]);
});
test('invalid retry counts fail closed', () => {
  for (const value of [-1, 0.5, Infinity, NaN]) assert.throws(() => offlineRetryDelayMs(value), RangeError);
});
